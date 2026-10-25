/** Tools that run Jarvis's pipeline and change the simulated world (sync, close, scenarios, faults, reset). */
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { API_BASE_URL, api, type JobName, type JobResult, runJob } from "../api.js";
import { text, type ToolResult } from "../format.js";
import { getState, statusMarkdown } from "./read.js";

const waitFields = {
  wait: z.boolean().default(true).describe("Wait for the job to finish and return the resulting status (recommended)"),
  timeout_seconds: z.number().int().min(5).max(900).default(300).describe("Give up waiting after this many seconds; the job keeps running")
};

async function finishJob(r: JobResult, signal: AbortSignal, wait: boolean, extra = ""): Promise<ToolResult> {
  if (!wait) {
    return text(`Started '${r.job}' in the background. Call jarvis_get_status until "busy" is empty to see the result.`);
  }
  const s = await getState(signal);
  const head = r.finished
    ? `'${r.job}' finished in ${r.seconds}s.`
    : `Stopped waiting for '${r.job}' after ${r.seconds}s; it is ${s.busy ? `still running (busy: ${s.busy})` : "no longer running"}.`;
  const errs = r.errors.length ? `\n\n**Errors reported by JarvisERP:**\n${r.errors.map(e => `- ${e}`).join("\n")}` : "";
  return {
    content: [{ type: "text", text: `${head}${errs}${extra ? `\n\n${extra}` : ""}\n\n${statusMarkdown(s)}` }],
    ...(r.errors.length > 0 ? { isError: true } : {})
  };
}

const STEP_PATHS: Record<string, { job: JobName; path: string }> = {
  connect: { job: "connect", path: "/api/connect" },
  onboard: { job: "onboard", path: "/api/onboard" },
  close: { job: "close", path: "/api/close" },
  october: { job: "october", path: "/api/october" },
  controller_persona: { job: "controller", path: "/api/controller/run" }
};

export function registerWorkflowTools(server: McpServer): void {
  server.registerTool(
    "jarvis_run_step",
    {
      title: "Run a close step",
      description: `Run one stage of Jarvis's pipeline. Stages, in demo order:
  - connect: sync bank, PayPal, Ramp, docs and the existing ledger into the system of work (stateful; re-syncs never duplicate)
  - onboard: mine Jan-Aug precedents and propose versioned policies for the Controller
  - close: run the September cash & expense close: match, split PayPal transfers, FX, cut-off, accruals, vendor dedupe; proposes entries and asks questions
  - october: sync October, reverse September accruals and true them up against actual invoices
  - controller_persona: let the scripted/LLM Controller persona (Maya Chen) decide everything pending, instead of the user

Waits for the job (via the backend's event stream) and returns the new status, including any errors. Only one job runs at a time.
Prefer letting the user make Controller decisions with jarvis_approve_item / jarvis_reject_item / jarvis_answer_question; use controller_persona only when they ask to auto-approve or run the full demo.`,
      inputSchema: z.strictObject({
        step: z.enum(["connect", "onboard", "close", "october", "controller_persona"]).describe("Pipeline stage to run"),
        ...waitFields
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ step, wait, timeout_seconds }, ctx) => {
      const { job, path } = STEP_PATHS[step];
      const r = await runJob(job, () => api(path, { method: "POST", signal: ctx.mcpReq.signal }), {
        wait,
        timeoutSeconds: timeout_seconds,
        signal: ctx.mcpReq.signal
      });
      return finishJob(r, ctx.mcpReq.signal, wait);
    }
  );

  server.registerTool(
    "jarvis_resync",
    {
      title: "Re-sync sources",
      description:
        "Re-run the sync of every source system for the current phase. Sync is cursor-based with stable ids, so a re-sync creates zero duplicates; use it after changing the PayPal fault mode to show recovery (the API outage falls back to the CSV export, and the fallback is logged). Returns per-source sync results.",
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (_args, ctx) => {
      const r = await api<Record<string, unknown>>("/api/resync", { method: "POST", signal: ctx.mcpReq.signal });
      return { content: [{ type: "text", text: `Re-sync done:\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`` }], structuredContent: r };
    }
  );

  server.registerTool(
    "jarvis_inject_scenario",
    {
      title: "Inject a test scenario",
      description: `Inject a new transaction into the closed world from outside the generator and let Jarvis handle it, the way a judge would test it. Either describe it in free text, or pick a template with optional params:
  - unknown_debit: amount, description, date (an unexplained bank debit)
  - invoice_over_accrual: vendor, amount (a vendor bills more than was accrued)
  - personal_card: merchant, amount, cardholder, date (personal purchase on a company card)
  - duplicate_bill: vendor, amount, date (same purchase in Ramp and as a bill)
  - paypal_bundle: date, payments[{name, eur|usd}] (one PayPal transfer funding several payments)
Free text is parsed into one of these (by Claude if ANTHROPIC_API_KEY is set on the backend, otherwise by rules).

Examples: text="a $96.40 Sephora charge on J. Ortiz's card on Sep 22"; template="unknown_debit", params={"amount": 742.18, "description": "SQ *MOONLIGHT GEAR CO"}.
Returns what was injected and the work items it produced; then inspect them with jarvis_get_work_item.`,
      inputSchema: z
        .strictObject({
          text: z.string().min(5).max(500).optional().describe("Free-text description of the scenario"),
          template: z
            .enum(["unknown_debit", "invoice_over_accrual", "personal_card", "duplicate_bill", "paypal_bundle"])
            .optional()
            .describe("Scenario template (alternative to text)"),
          params: z.record(z.string(), z.unknown()).optional().describe("Template params overriding the defaults"),
          ...waitFields
        })
        .refine(a => Boolean(a.text) !== Boolean(a.template), { message: "Give exactly one of 'text' or 'template'." }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ text: scenario, template, params, wait, timeout_seconds }, ctx) => {
      const r = await runJob(
        "inject",
        () => api("/api/inject", { method: "POST", body: { text: scenario, template, params }, signal: ctx.mcpReq.signal }),
        { wait, timeoutSeconds: timeout_seconds, signal: ctx.mcpReq.signal }
      );
      const extra = r.injectResult ? `**Injected:**\n\`\`\`json\n${JSON.stringify(r.injectResult, null, 2)}\n\`\`\`` : "";
      return finishJob(r, ctx.mcpReq.signal, wait, extra);
    }
  );

  server.registerTool(
    "jarvis_set_paypal_fault",
    {
      title: "Set PayPal API fault",
      description:
        "Make the mock PayPal API misbehave on the next sync, to demonstrate recovery: 'flaky' fails twice then works, 'down' always fails (sync falls back to the CSV export), 'ratelimit' returns 429 three times, 'none' restores normal service. Follow with jarvis_resync.",
      inputSchema: z.strictObject({
        mode: z.enum(["none", "flaky", "down", "ratelimit"]).describe("Fault mode for the mock PayPal API")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ mode }, ctx) => {
      await api("/api/fault", { method: "POST", body: { mode: mode === "none" ? null : mode }, signal: ctx.mcpReq.signal });
      return text(`PayPal API fault set to '${mode}'.${mode === "none" ? "" : " Run jarvis_resync to see how sync recovers."}`);
    }
  );

  server.registerTool(
    "jarvis_build_close_pack",
    {
      title: "Build close evidence pack",
      description:
        "Assemble the month-end close evidence folder (bank statement, bank reconciliation, one JE-support document per posted entry, policies, audit extract) on the backend machine, and report each document with its verification check. Returns the folder path and the download URL of the zip.",
      inputSchema: z.strictObject({}),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (_args, ctx) => {
      const r = await api<{ period: string; root: string; documents: { doc: string; type: string; verified: boolean; check: string }[]; zip?: string }>(
        "/api/closepack",
        { method: "POST", signal: ctx.mcpReq.signal }
      );
      const unverified = r.documents.filter(d => !d.verified);
      const lines = [
        `# Close pack ${r.period}: ${r.documents.length} documents (${unverified.length} not verified)`,
        `Folder: ${r.root}`,
        `Zip download: ${API_BASE_URL}/api/closepack.zip`,
        "",
        ...r.documents.map(d => `- ${d.verified ? "✓" : "✗"} ${d.doc} (${d.check})`)
      ];
      return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: r };
    }
  );

  server.registerTool(
    "jarvis_reset_world",
    {
      title: "Reset world",
      description:
        "Throw away the current system-of-work database (all work items, approvals, ledger postings and the audit log) and start a fresh world for a seed. Irreversible: only call when the user explicitly asks to reset or start over. Seed 2026 reproduces the README numbers.",
      inputSchema: z.strictObject({
        seed: z.number().int().min(0).max(1_000_000).optional().describe("World seed; defaults to the current one")
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async ({ seed }, ctx) => {
      const r = await api<{ reset: boolean; seed: number }>("/api/reset", {
        method: "POST",
        body: seed === undefined ? {} : { seed },
        signal: ctx.mcpReq.signal,
        timeoutMs: 180_000
      });
      return text(`World reset to seed ${r.seed}. Nothing is synced yet; run jarvis_run_step with step='connect' or 'close'.`);
    }
  );
}
