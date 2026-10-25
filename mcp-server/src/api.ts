/**
 * Client for the JarvisERP FastAPI backend (jarvis/api/server.py).
 * One place for the base URL, timeouts, error mapping and background-job waiting.
 */

export const API_BASE_URL = (process.env.JARVIS_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown
  ) {
    super(message);
  }
}

/** The backend refused an action in code (segregation of duties, locked period, wrong state...). */
export class DeniedError extends Error {}

function describeBody(body: unknown): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.error === "string") return b.error;
    if (typeof b.reason === "string") return b.reason;
  }
  return typeof body === "string" ? body.slice(0, 300) : "";
}

function httpErrorMessage(status: number, path: string, body: unknown): string {
  const detail = describeBody(body);
  switch (status) {
    case 404:
      return `Not found: ${path}. Check the ID; jarvis_list_work_items returns valid item IDs (WI-XXXXXXXX).`;
    case 409:
      return `JarvisERP is busy (${detail || "another job is running"}). Call jarvis_get_status until "busy" is empty, then retry.`;
    case 422:
      return `JarvisERP rejected the request body: ${JSON.stringify(body).slice(0, 400)}`;
    case 400:
      return `JarvisERP refused the action: ${detail || "bad request"}. Check the item's state with jarvis_get_work_item; most actions need a PROPOSED or NEEDS_INFO item.`;
    default:
      return `JarvisERP returned HTTP ${status} for ${path}${detail ? `: ${detail}` : ""}.`;
  }
}

function connectionHint(): string {
  return (
    `Cannot reach the JarvisERP backend at ${API_BASE_URL}. Start it from the repo root with ` +
    "`make up` (or `python -m jarvis.api.server --seed 2026 --port 8000`), or set JARVIS_API_URL."
  );
}

export interface RequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Return text instead of parsing JSON (CSV / Beancount exports). */
  text?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const signals = [AbortSignal.timeout(opts.timeoutMs ?? REQUEST_TIMEOUT_MS)];
  if (opts.signal) signals.push(opts.signal);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        Accept: opts.text ? "text/plain" : "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.any(signals)
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(`JarvisERP did not answer ${path} within ${(opts.timeoutMs ?? REQUEST_TIMEOUT_MS) / 1000}s.`);
    }
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error(connectionHint());
  }

  const raw = await res.text();
  let parsed: unknown = raw;
  if (!opts.text) {
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }
  }

  if (res.status === 403 && parsed && typeof parsed === "object" && (parsed as { denied?: boolean }).denied) {
    const reason = (parsed as { reason?: string }).reason ?? "not permitted";
    const st = /^no transition '(\w+)' from state (\w+)/.exec(reason);
    throw new DeniedError(
      st
        ? `Can't '${st[1]}' this item: it is already ${st[2]}. Check its current state with jarvis_get_work_item. (The refused attempt is logged.)`
        : `DENIED by JarvisERP's controls: ${reason}. The attempt is recorded in the audit log. ` +
            "This is a limit enforced in code; do not try to work around it."
    );
  }
  if (!res.ok) throw new ApiError(res.status, httpErrorMessage(res.status, path, parsed), parsed);
  return parsed as T;
}

// ---------------------------------------------------------------- background jobs

export type JobName = "connect" | "onboard" | "close" | "october" | "controller" | "inject";

interface JarvisEvent {
  type: string;
  name?: string;
  on?: boolean;
  where?: string;
  error?: string;
  result?: unknown;
  [k: string]: unknown;
}

export interface JobResult {
  job: JobName;
  finished: boolean;
  seconds: number;
  errors: string[];
  /** Payload of the inject_done event, for scenario injection. */
  injectResult?: unknown;
  /** Notable events seen while the job ran (counts by type). */
  eventCounts: Record<string, number>;
}

/**
 * Starts a background job and (optionally) waits for it, listening on the backend's SSE stream.
 * The backend reports job failures only as SSE "error" events, so listening is the only way to see them.
 */
export async function runJob(
  job: JobName,
  start: () => Promise<unknown>,
  opts: { wait: boolean; timeoutSeconds: number; signal: AbortSignal }
): Promise<JobResult> {
  const t0 = Date.now();
  const result: JobResult = { job, finished: false, seconds: 0, errors: [], eventCounts: {} };

  if (!opts.wait) {
    await start();
    result.seconds = (Date.now() - t0) / 1000;
    return result;
  }

  const abort = new AbortController();
  const stop = () => abort.abort();
  opts.signal.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, opts.timeoutSeconds * 1000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/events`, { headers: { Accept: "text/event-stream" }, signal: abort.signal });
  } catch {
    clearTimeout(timer);
    throw new Error(connectionHint());
  }
  if (!res.ok || !res.body) {
    clearTimeout(timer);
    throw new Error(`Could not open the JarvisERP event stream (HTTP ${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  let seenBusy = false;

  try {
    outer: while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const data = chunk
          .split("\n")
          .filter(l => l.startsWith("data:"))
          .map(l => l.slice(5).trim())
          .join("");
        if (!data) continue;
        let ev: JarvisEvent;
        try {
          ev = JSON.parse(data) as JarvisEvent;
        } catch {
          continue;
        }
        if (ev.type === "hello" && !started) {
          started = true;
          await start(); // subscribed first, so no event can be missed
          continue;
        }
        result.eventCounts[ev.type] = (result.eventCounts[ev.type] ?? 0) + 1;
        if (ev.type === "error") result.errors.push(`${ev.where ?? job}: ${ev.error ?? "unknown error"}`);
        if (ev.type === "inject_done") result.injectResult = ev.result;
        if (ev.type === "busy" && ev.name === job) {
          if (ev.on) seenBusy = true;
          else if (seenBusy) {
            result.finished = true;
            break outer;
          }
        }
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
  } finally {
    clearTimeout(timer);
    opts.signal.removeEventListener("abort", stop);
    abort.abort();
  }
  if (!started) throw new Error("The JarvisERP event stream closed before the job could start.");
  result.seconds = Math.round((Date.now() - t0) / 100) / 10;
  return result;
}
