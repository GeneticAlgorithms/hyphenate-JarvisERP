/** Read-only tools: status, work items, evidence, policies, audit trail, reconciliation, exports, score. */
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { api } from "../api.js";
import {
  type AuditRow,
  CHARACTER_LIMIT,
  formatAuditRow,
  formatItemSummary,
  formatProposalLines,
  paginate,
  parseJsonField,
  respond,
  responseFormatField,
  text,
  usd,
  type WorkItem
} from "../format.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export const ITEM_STATES = ["NEW", "PROPOSED", "NEEDS_INFO", "APPROVED", "REJECTED", "POSTED", "DISMISSED"] as const;

export interface JarvisState {
  seed: number;
  company: string;
  period: string;
  bootstrapped: boolean;
  phase: string | null;
  world_date: string | null;
  busy: string | null;
  auto_controller: boolean;
  llm: boolean;
  search: { backend?: string; [k: string]: unknown };
  paypal_fault: string | null;
  status: {
    states?: Record<string, number>;
    bank_rec?: { period: string; difference_cents: number; ties: boolean; explained: boolean; statement_ending_cents: number; ledger_cash_cents: number };
    unreconciled?: { record_id: string; txn_date: string; amount_cents: number; description: string }[];
    trial_balance_ok?: boolean;
    pending_controller?: number;
    [k: string]: unknown;
  };
  policies: { policy_id: string; version: number; title: string; status: string; evidence: string[]; approved_by: string | null; rule_text: string }[];
  counts: Record<string, number>;
  templates: Record<string, string>;
}

export function getState(signal?: AbortSignal): Promise<JarvisState> {
  return api<JarvisState>("/api/state", { signal });
}

export function statusMarkdown(s: JarvisState): string {
  const L: string[] = [`# ${s.company} · close period ${s.period}`];
  L.push(
    `- Seed ${s.seed} · phase: ${s.phase ?? "not started"} · connected: ${s.bootstrapped ? "yes" : "no"}` +
      (s.busy ? ` · **busy: ${s.busy}**` : "")
  );
  L.push(
    `- Claude layer: ${s.llm ? "on" : "off (deterministic, scripted personas)"} · search: ${s.search?.backend ?? "?"}` +
      ` · PayPal fault: ${s.paypal_fault ?? "none"} · auto-Controller: ${s.auto_controller ? "on" : "off"}`
  );
  const c = s.counts;
  L.push(
    `- Records ${c.records} · docs ${c.docs} · precedents ${c.precedents} · ledger entries ${c.ledger_entries}` +
      ` · audit rows ${c.audit} (${c.denied} denied)`
  );
  if (!s.bootstrapped) {
    L.push("", "Nothing synced yet. Next step: jarvis_run_step with step='connect' (or 'close', which connects first).");
    return L.join("\n");
  }
  const st = s.status ?? {};
  if (st.states) {
    L.push("", "## Work items", Object.entries(st.states).map(([k, v]) => `${k}: ${v}`).join(" · "));
  }
  if (st.pending_controller !== undefined) L.push(`Awaiting the Controller: **${st.pending_controller}**`);
  if (st.bank_rec) {
    const b = st.bank_rec;
    L.push(
      "",
      `## Bank reconciliation ${b.period}`,
      `Statement ${usd(b.statement_ending_cents)} vs ledger cash ${usd(b.ledger_cash_cents)} → difference ${usd(b.difference_cents)}` +
        ` · ${b.ties ? "ties to $0.00" : b.explained ? "difference fully explained by pending items" : "UNEXPLAINED difference"}`
    );
    for (const u of st.unreconciled ?? []) L.push(`- ${u.txn_date} ${usd(u.amount_cents)} ${u.description} (record ${u.record_id})`);
  }
  if (st.trial_balance_ok !== undefined) L.push(`Trial balance: ${st.trial_balance_ok ? "balances" : "**DOES NOT BALANCE**"}`);
  const proposed = s.policies.filter(p => p.status === "proposed");
  if (s.policies.length) {
    L.push("", `## Policies: ${s.policies.length} (${proposed.length} awaiting Controller decision)`);
    for (const p of proposed) L.push(`- ${p.policy_id} v${p.version}: ${p.title}`);
  }
  return L.join("\n");
}

export function itemDetailMarkdown(d: WorkItem & { audit?: AuditRow[]; ledger_entry?: unknown; messages?: Record<string, unknown>[] }, includeAudit: boolean): string {
  const L: string[] = [formatItemSummary(d), ""];
  L.push(`- Anchor: ${d.anchor} · period ${d.period} · proposed by ${d.proposed_by ?? "—"} · approved by ${d.approved_by ?? "—"}`);
  if (d.policy_id) L.push(`- Policy: ${d.policy_id}`);
  if (d.precedent_ids?.length) L.push(`- Precedents: ${d.precedent_ids.join(", ")}`);
  if (d.parent_id) L.push(`- Parent item: ${d.parent_id}`);
  if (d.rationale) L.push("", "## Rationale", d.rationale);
  if (d.answer) L.push("", `**Human answer/decision:** ${d.answer}`);
  if (d.proposal?.lines?.length) {
    L.push("", `## Proposed entry${d.proposal.date ? ` (${d.proposal.date})` : ""}`);
    if (d.proposal.memo) L.push(String(d.proposal.memo));
    L.push(formatProposalLines(d.proposal.lines));
  }
  if (d.review?.checks) {
    L.push("", `## Reviewer: ${d.review.verdict ?? "?"}${d.review.note ? ` (${d.review.note})` : ""}`);
    L.push(Object.entries(d.review.checks).map(([k, v]) => `${v ? "✓" : "✗"} ${k}`).join(" · "));
  }
  if (d.evidence?.length) {
    L.push("", "## Evidence (use jarvis_get_evidence with type + id to open one)");
    for (const e of d.evidence) {
      L.push(`- [${e.relation ?? "supports"}] ${e.type}:${e.id} · ${e.label ?? ""}${e.detail ? ` · ${e.detail}` : ""}`);
    }
  }
  if (d.ledger_entry) L.push("", "## Posted ledger entry", "```json", JSON.stringify(d.ledger_entry, null, 2), "```");
  if (d.messages?.length) {
    L.push("", "## Messages");
    for (const m of d.messages) L.push(`- ${m.at} ${m.from_actor} → ${m.to_actor}: ${m.subject}`);
  }
  if (includeAudit && d.audit?.length) {
    L.push("", "## Audit trail (why?)");
    for (const r of d.audit) L.push(formatAuditRow(r));
  }
  return L.join("\n");
}

const EVIDENCE_PREFIX: Record<string, string> = {
  record: "rec",
  doc: "doc",
  precedent: "prec",
  policy: "pol",
  ledger: "je",
  vendor: "vendor",
  denied: "denied"
};

export function registerReadTools(server: McpServer): void {
  server.registerTool(
    "jarvis_get_status",
    {
      title: "Get close status",
      description: `Overview of the JarvisERP world: phase, whether a job is running, work items by state, bank reconciliation (difference and unreconciled lines), trial balance, policies awaiting the Controller, and record/audit counts.

Call this first in any session, and after any action to see its effect.
Examples: "where are we on the September close?", "is the bank rec tied out?", "is Jarvis still running?"`,
      inputSchema: z.strictObject({ response_format: responseFormatField }),
      annotations: READ
    },
    async ({ response_format }, ctx) => {
      const s = await getState(ctx.mcpReq.signal);
      return respond(response_format, s as unknown as Record<string, unknown>, () => statusMarkdown(s));
    }
  );

  server.registerTool(
    "jarvis_list_work_items",
    {
      title: "List work items",
      description: `List Jarvis's work items (one per bank line, bill, card charge, accrual, question...), oldest first, with state, kind, title and confidence.

States: PROPOSED = an entry waiting for human approval; NEEDS_INFO = Jarvis asked a question; POSTED = in the ledger; also NEW, APPROVED, REJECTED, DISMISSED.
Filter by state, kind (e.g. paypal_split, accrual, match, unknown, personal) or free text in the title/rationale.
Examples: "what's waiting for my approval?" -> state="PROPOSED"; "what questions does Jarvis have?" -> state="NEEDS_INFO"; "find the Kraftwerk deposit" -> query="Kraftwerk".
Use jarvis_get_work_item for the full dossier of one item.`,
      inputSchema: z.strictObject({
        state: z.enum(ITEM_STATES).optional().describe("Only items in this state"),
        kind: z.string().max(60).optional().describe("Only items of this kind, e.g. 'paypal_split', 'accrual', 'unknown'"),
        query: z.string().min(2).max(120).optional().describe("Case-insensitive text to match in title, rationale, question or anchor"),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum items to return"),
        offset: z.number().int().min(0).default(0).describe("Items to skip, for pagination"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ state, kind, query, limit, offset, response_format }, ctx) => {
      let items = await api<WorkItem[]>("/api/items", { query: { state }, signal: ctx.mcpReq.signal });
      if (kind) items = items.filter(i => i.kind === kind);
      if (query) {
        const q = query.toLowerCase();
        items = items.filter(i => [i.title, i.rationale, i.question, i.anchor, i.item_id].some(f => f?.toLowerCase().includes(q)));
      }
      if (items.length === 0) {
        return text(
          `No work items match${state ? ` state=${state}` : ""}${kind ? ` kind=${kind}` : ""}${query ? ` query='${query}'` : ""}.` +
            " If nothing has run yet, call jarvis_run_step with step='close'."
        );
      }
      const slim = items.map(i => ({
        item_id: i.item_id,
        state: i.state,
        kind: i.kind,
        title: i.title,
        period: i.period,
        confidence: i.confidence,
        reviewer: i.review?.verdict ?? null,
        question: i.question || null
      }));
      return paginate(slim, offset, limit, response_format, "items", (page, info) =>
        [
          `# Work items (${info.count} of ${info.total})`,
          ...page.map(i => formatItemSummary(items.find(x => x.item_id === i.item_id)!))
        ].join("\n\n")
      );
    }
  );

  server.registerTool(
    "jarvis_get_work_item",
    {
      title: "Get work item dossier",
      description: `Full dossier for one work item: rationale, proposed journal entry (account, memo, Dr/Cr), reviewer checks, cited evidence, precedents/policy, messages sent, the posted ledger entry if any, and the hash-chained audit trail ("why?").

Use before approving, rejecting, answering or challenging an item, so you can show the user what they're signing off on.
Example: "show me the -$3,912.44 PayPal decision" -> find its ID with jarvis_list_work_items(query="3,912"), then call this.`,
      inputSchema: z.strictObject({
        item_id: z.string().regex(/^WI-[0-9A-F]+$/i, "Work item IDs look like WI-8A4D923C").describe("Work item ID, e.g. 'WI-8A4D923C'"),
        include_audit: z.boolean().default(true).describe("Include the audit trail of every transition and tool call on this item"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ item_id, include_audit, response_format }, ctx) => {
      const d = await api<WorkItem & { audit?: AuditRow[]; ledger_entry?: unknown; messages?: Record<string, unknown>[] }>(
        `/api/item/${encodeURIComponent(item_id.toUpperCase())}`,
        { signal: ctx.mcpReq.signal }
      );
      const data = include_audit ? d : { ...d, audit: undefined };
      return respond(response_format, data as unknown as Record<string, unknown>, () => itemDetailMarkdown(d, include_audit));
    }
  );

  server.registerTool(
    "jarvis_get_evidence",
    {
      title: "Open evidence node",
      description: `Open one piece of evidence a decision cites: a source record (bank/PayPal/Ramp row, with its raw export payload), a document (SOW, invoice, run sheet, email), a precedent, a policy (all versions), a ledger entry, a vendor (with aliases) or a denied attempt.

Take type and id from a work item's evidence list (shown as type:id). Evidence of type 'fx' is an ECB rate already summarized in the item and has no node to open.
Examples: type="doc", id="SOW-KRW-2026-11"; type="record", id="dbb14242be2a1096"; type="vendor", id="V-ANTHROPIC"; type="policy", id="pol-002".`,
      inputSchema: z.strictObject({
        type: z.enum(["record", "doc", "precedent", "policy", "ledger", "vendor", "denied"]).describe("Kind of node"),
        id: z.string().min(1).max(120).describe("The node's id, e.g. 'SOW-KRW-2026-11' or a record hash"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ type, id, response_format }, ctx) => {
      const node = await api<{ type: string; data: unknown; [k: string]: unknown }>(
        `/api/node/${EVIDENCE_PREFIX[type]}:${encodeURIComponent(id)}`,
        { signal: ctx.mcpReq.signal }
      );
      if (node.data === null || node.data === undefined || (Array.isArray(node.data) && node.data.length === 0)) {
        return text(`No ${type} with id '${id}'. Copy the id exactly from a work item's evidence list.`);
      }
      return respond(response_format, node, () =>
        [`# ${type} ${id}`, "```json", JSON.stringify(node, null, 2).slice(0, CHARACTER_LIMIT - 200), "```"].join("\n")
      );
    }
  );

  server.registerTool(
    "jarvis_list_policies",
    {
      title: "List accounting policies",
      description: `Accounting policies Jarvis has learned from precedents (e.g. "pol-002: EUR payments at ECB rate; PayPal spread -> 6810"), with version, status (proposed / approved / rejected), the rule text and the precedents behind it.

Proposed policies need a Controller decision via jarvis_decide_policy.
Example: "what rules did Jarvis learn during onboarding?"`,
      inputSchema: z.strictObject({
        status: z.enum(["proposed", "approved", "rejected"]).optional().describe("Only policies with this status"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ status, response_format }, ctx) => {
      const s = await getState(ctx.mcpReq.signal);
      const pols = s.policies.filter(p => !status || p.status === status);
      if (!pols.length) {
        return text(`No ${status ?? ""} policies yet. Policies are proposed by jarvis_run_step with step='onboard'.`);
      }
      return respond(response_format, { policies: pols }, () =>
        [
          `# Policies (${pols.length})`,
          ...pols.map(
            p =>
              `## ${p.policy_id} v${p.version} · ${p.status}${p.approved_by ? ` by ${p.approved_by}` : ""}\n**${p.title}**\n${p.rule_text}\nEvidence: ${p.evidence.join(", ") || "—"}`
          )
        ].join("\n\n")
      );
    }
  );

  server.registerTool(
    "jarvis_get_audit_log",
    {
      title: "Get audit log",
      description: `Read the append-only, hash-chained audit log, newest first: every sync, tool call, proposal, review, approval, rejection, posting and denied attempt, with actor and role.

Filter to denied attempts (segregation-of-duties violations), one actor (jarvis, jarvis-reviewer, maya, dev, gateway, sync, policy:P-001) or one subject (a work item or policy id).
Examples: "show me every denied action" -> denied_only=true; "what did the Controller do?" -> actor="maya".
Use jarvis_verify_audit_chain to check the chain hasn't been tampered with.`,
      inputSchema: z.strictObject({
        denied_only: z.boolean().default(false).describe("Only rows where the action was refused"),
        actor: z.string().max(40).optional().describe("Only rows by this actor id, e.g. 'maya' or 'jarvis'"),
        subject: z.string().max(80).optional().describe("Only rows about this subject, e.g. 'WI-8A4D923C'"),
        limit: z.number().int().min(1).max(200).default(50).describe("Maximum rows to return"),
        offset: z.number().int().min(0).default(0).describe("Rows to skip, for pagination"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ denied_only, actor, subject, limit, offset, response_format }, ctx) => {
      let rows = await api<AuditRow[]>("/api/audit", { query: { limit: 5000 }, signal: ctx.mcpReq.signal });
      if (denied_only) rows = rows.filter(r => !r.allowed);
      if (actor) rows = rows.filter(r => r.actor === actor);
      if (subject) rows = rows.filter(r => r.subject === subject);
      if (!rows.length) return text("No audit rows match those filters.");
      const slim = rows.map(({ prev_hash: _p, diff, evidence, ...r }) => ({
        ...r,
        diff: parseJsonField<Record<string, unknown>>(diff, {}),
        evidence: parseJsonField<string[]>(evidence, [])
      }));
      return paginate(slim, offset, limit, response_format, "rows", (page, info) =>
        [`# Audit log (${info.count} of ${info.total}, newest first)`, "", ...page.map(r => formatAuditRow(r))].join("\n")
      );
    }
  );

  server.registerTool(
    "jarvis_verify_audit_chain",
    {
      title: "Verify audit chain",
      description:
        "Recompute the SHA-256 hash chain over every audit row and report whether it verifies, the row count and the head hash. Use to prove the log hasn't been edited (the database also rejects UPDATE on it).",
      inputSchema: z.strictObject({}),
      annotations: READ
    },
    async (_args, ctx) => {
      const v = await api<{ ok: boolean; rows: number; head: string; [k: string]: unknown }>("/api/verify", { signal: ctx.mcpReq.signal });
      return {
        content: [
          {
            type: "text",
            text: v.ok
              ? `Audit chain verifies: ${v.rows} rows, head ${v.head}.`
              : `AUDIT CHAIN BROKEN: ${JSON.stringify(v)}`
          }
        ],
        structuredContent: v
      };
    }
  );

  server.registerTool(
    "jarvis_get_bank_reconciliation",
    {
      title: "Get bank reconciliation",
      description:
        "Bank reconciliation for a period: statement ending balance, ledger cash, the difference, and every unreconciled bank line. A non-zero difference is expected while items await the Controller; it should tie to $0.00 once they are approved. Example: period='2026-09'.",
      inputSchema: z.strictObject({
        period: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM").optional().describe("Period as YYYY-MM; defaults to the close period"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ period, response_format }, ctx) => {
      const r = await api<{
        period: string;
        statement_ending_cents: number;
        ledger_cash_cents: number;
        difference_cents: number;
        unreconciled: { record_id: string; txn_date: string; amount_cents: number; description: string }[];
        [k: string]: unknown;
      }>("/api/recon", { query: { period }, signal: ctx.mcpReq.signal });
      return respond(response_format, r, () =>
        [
          `# Bank reconciliation ${r.period}`,
          `Statement ending balance: ${usd(r.statement_ending_cents)}`,
          `Ledger cash: ${usd(r.ledger_cash_cents)}`,
          `Difference: **${usd(r.difference_cents)}**${r.difference_cents === 0 ? " (ties)" : ""}`,
          "",
          r.unreconciled?.length ? "## Unreconciled bank lines" : "All bank lines reconciled.",
          ...(r.unreconciled ?? []).map(u => `- ${u.txn_date} ${usd(u.amount_cents)} ${u.description} (record ${u.record_id})`)
        ].join("\n")
      );
    }
  );

  server.registerTool(
    "jarvis_list_messages",
    {
      title: "List messages",
      description:
        "Messages Jarvis sent or received, newest first: questions to the Controller, vendor emails ('please confirm your September amount'), employee notices about personal charges. Example: 'which vendors did Jarvis email?'",
      inputSchema: z.strictObject({
        to: z.string().max(80).optional().describe("Only messages whose recipient contains this text, e.g. 'vendor' or 'maya'"),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum messages to return"),
        offset: z.number().int().min(0).default(0).describe("Messages to skip, for pagination"),
        response_format: responseFormatField
      }),
      annotations: READ
    },
    async ({ to, limit, offset, response_format }, ctx) => {
      let msgs = await api<Record<string, string>[]>("/api/messages", { signal: ctx.mcpReq.signal });
      if (to) msgs = msgs.filter(m => m.to_actor?.toLowerCase().includes(to.toLowerCase()));
      if (!msgs.length) return text("No messages match.");
      return paginate(msgs, offset, limit, response_format, "messages", (page, info) =>
        [
          `# Messages (${info.count} of ${info.total})`,
          ...page.map(m => `## ${m.subject}\n${m.at} · ${m.from_actor} → ${m.to_actor}${m.item_id ? ` · ${m.item_id}` : ""}\n${m.body}`)
        ].join("\n\n")
      );
    }
  );

  server.registerTool(
    "jarvis_export_ledger",
    {
      title: "Export ledger",
      description: `Export the general ledger as a QuickBooks-format GL CSV (optionally for one period) or as a Beancount file (which passes bean-check). Returns the file text a page of lines at a time.

Examples: "give me September's GL" -> format="gl_csv", period="2026-09"; "export to beancount" -> format="beancount".`,
      inputSchema: z.strictObject({
        format: z.enum(["gl_csv", "beancount"]).describe("'gl_csv' (QBO General Ledger CSV) or 'beancount'"),
        period: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM").optional().describe("GL CSV only: limit to this period"),
        offset_lines: z.number().int().min(0).default(0).describe("Lines to skip, for paging through a long file"),
        max_lines: z.number().int().min(10).max(2000).default(400).describe("Maximum lines to return")
      }),
      annotations: READ
    },
    async ({ format, period, offset_lines, max_lines }, ctx) => {
      const body = await api<string>(format === "gl_csv" ? "/api/export/gl.csv" : "/api/export/beancount", {
        query: format === "gl_csv" ? { period } : {},
        text: true,
        signal: ctx.mcpReq.signal
      });
      const all = body.split("\n");
      let take = all.slice(offset_lines, offset_lines + max_lines);
      while (take.length > 10 && take.join("\n").length > CHARACTER_LIMIT - 400) take = take.slice(0, Math.ceil(take.length / 2));
      const next = offset_lines + take.length;
      const more = next < all.length ? `\n\nLines ${offset_lines + 1}-${next} of ${all.length}. More: call again with offset_lines=${next}.` : "";
      return text("```" + (format === "beancount" ? "beancount" : "csv") + "\n" + take.join("\n") + "\n```" + more);
    }
  );

  server.registerTool(
    "jarvis_get_score",
    {
      title: "Score against answer key",
      description:
        "Evaluation view (for demos and judges, not for doing the close): compares Jarvis's outcomes with the planted answer key the agent never sees, and with the rules-based bank-feed baseline (B1). Returns detection recall, treatment accuracy, trap precision, escalation accuracy and the share of items fully correct, plus every item Jarvis got wrong.",
      inputSchema: z.strictObject({ response_format: responseFormatField }),
      annotations: READ
    },
    async ({ response_format }, ctx) => {
      const s = await api<{
        jarvis: { summary: Record<string, number>; rows: Record<string, unknown>[] };
        b1: Record<string, number>;
        phases: string[];
      }>("/api/score", { signal: ctx.mcpReq.signal });
      const misses = s.jarvis.rows.filter(r => !r.ok);
      const data = { phases: s.phases, jarvis: s.jarvis.summary, b1: s.b1, misses };
      const pct = (v: unknown) => (typeof v === "number" && v <= 1 ? `${Math.round(v * 1000) / 10}%` : String(v ?? "—"));
      return respond(response_format, data, () => {
        const keys = Object.keys(s.jarvis.summary);
        return [
          `# Score vs answer key (phases: ${s.phases.join(", ")})`,
          "| Metric | Jarvis | Rules baseline (B1) |",
          "|---|---:|---:|",
          ...keys.map(k => `| ${k} | ${pct(s.jarvis.summary[k])} | ${pct(s.b1[k])} |`),
          "",
          misses.length
            ? `## Items not fully correct (${misses.length})\n` +
              misses.map(m => `- ${m.key_id} ${m.category}: expected ${m.expected}, got ${m.got}`).join("\n")
            : "Every key item fully correct."
        ].join("\n");
      });
    }
  );
}
