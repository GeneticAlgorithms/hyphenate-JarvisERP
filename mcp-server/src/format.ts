/** Shared types, formatting helpers and the response-size guard. */
import * as z from "zod/v4";

export const CHARACTER_LIMIT = 25_000;

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

export const responseFormatField = z
  .enum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("'markdown' for a readable summary, 'json' for the complete structured data");

export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function text(t: string): ToolResult {
  return { content: [{ type: "text", text: t }] };
}

export function json(data: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

export function respond(format: ResponseFormat, data: Record<string, unknown>, markdown: () => string): ToolResult {
  return format === ResponseFormat.JSON ? json(data) : text(markdown());
}

/** cents -> "$1,234.56" / "-$1,234.56" */
export function usd(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "n/a";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseJsonField<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return (v as T) ?? fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/**
 * Paginate a list and keep the rendered text under CHARACTER_LIMIT by returning fewer items
 * (never by cutting text), so next_offset always points at the first item left out.
 */
export function paginate<T>(
  all: T[],
  offset: number,
  limit: number,
  format: ResponseFormat,
  key: string,
  renderMarkdown: (items: T[], page: PageInfo) => string
): ToolResult {
  const render = (items: T[]) => {
    const nextOffset = offset + items.length;
    const hasMore = all.length > nextOffset;
    const page: PageInfo = {
      total: all.length,
      count: items.length,
      offset,
      has_more: hasMore,
      ...(hasMore ? { next_offset: nextOffset } : {})
    };
    const data = { ...page, [key]: items };
    if (format === ResponseFormat.JSON) return { data, out: JSON.stringify(data, null, 2) };
    let md = renderMarkdown(items, page);
    if (hasMore) md += `\n\nMore results: call again with offset=${nextOffset}.`;
    return { data, out: md };
  };

  let items = all.slice(offset, offset + limit);
  let r = render(items);
  while (items.length > 1 && r.out.length > CHARACTER_LIMIT) {
    items = items.slice(0, Math.ceil(items.length / 2));
    r = render(items);
  }
  if (format === ResponseFormat.JSON) return { content: [{ type: "text", text: r.out }], structuredContent: r.data };
  return text(r.out);
}

export interface PageInfo {
  total: number;
  count: number;
  offset: number;
  has_more: boolean;
  next_offset?: number;
}

// ---------------------------------------------------------------- backend shapes (loose: the backend owns them)

export interface EvidenceRef {
  id: string;
  type: string;
  label?: string;
  detail?: string;
  relation?: string;
}

export interface ProposalLine {
  acct: string;
  cents: number;
  memo?: string;
  vendor_id?: string;
}

export interface WorkItem {
  item_id: string;
  kind: string;
  anchor: string;
  state: string;
  title: string;
  period: string;
  confidence: number | null;
  rationale: string;
  question: string;
  answer: string;
  policy_id: string;
  precedent_ids: string[] | null;
  proposed_by: string | null;
  approved_by: string | null;
  parent_id: string | null;
  review: { verdict?: string; note?: string; checks?: Record<string, boolean> } | null;
  evidence: EvidenceRef[] | null;
  proposal: { lines?: ProposalLine[]; memo?: string; date?: string; [k: string]: unknown } | null;
  source_refs: unknown;
}

export interface AuditRow {
  seq: number;
  at: string;
  actor: string;
  actor_role: string;
  action: string;
  subject?: string;
  allowed: number;
  reason: string;
  diff?: string;
  evidence?: string;
  hash?: string;
  prev_hash?: string;
}

export function formatProposalLines(lines: ProposalLine[] | undefined): string {
  if (!lines?.length) return "_No journal lines proposed._";
  const rows = lines.map(l => {
    const dr = l.cents > 0 ? usd(l.cents) : "";
    const cr = l.cents < 0 ? usd(-l.cents) : "";
    return `| ${l.acct} | ${(l.memo ?? "").replace(/\|/g, "/")} | ${dr} | ${cr} |`;
  });
  return ["| Account | Memo | Dr | Cr |", "|---|---|---:|---:|", ...rows].join("\n");
}

export function formatItemSummary(it: WorkItem): string {
  const conf = it.confidence !== null && it.confidence !== undefined ? ` · confidence ${Math.round(it.confidence * 100)}%` : "";
  const review = it.review?.verdict ? ` · reviewer: ${it.review.verdict}` : "";
  const lines = [`### ${it.item_id} · ${it.state} · ${it.kind}`, `${it.title}${conf}${review}`];
  if (it.state === "NEEDS_INFO" && it.question) lines.push(`**Question:** ${it.question}`);
  return lines.join("\n");
}

export function formatAuditRow(r: Pick<AuditRow, "seq" | "at" | "actor" | "actor_role" | "action" | "subject" | "allowed" | "reason">): string {
  const flag = r.allowed ? "" : " **DENIED**";
  const subj = r.subject ? ` [${r.subject}]` : "";
  const reason = r.reason.length > 240 ? `${r.reason.slice(0, 240)}…` : r.reason;
  return `- #${r.seq} ${r.at.slice(0, 19).replace("T", " ")} · ${r.actor} (${r.actor_role}) · ${r.action}${subj}${flag}: ${reason}`;
}
