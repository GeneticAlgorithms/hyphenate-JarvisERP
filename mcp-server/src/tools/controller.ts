/**
 * Human-in-the-loop tools: the user acts as the Controller (Maya Chen) or staff accountant (Dev Patel).
 * JarvisERP enforces segregation of duties in code; these tools never bypass it.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { api } from "../api.js";
import { text, type WorkItem } from "../format.js";
import { getState, itemDetailMarkdown } from "./read.js";

const DEFAULT_APPROVER = process.env.JARVIS_APPROVER === "dev" ? "dev" : "maya";

const itemId = z
  .string()
  .regex(/^WI-[0-9A-F]+$/i, "Work item IDs look like WI-8A4D923C")
  .transform(s => s.toUpperCase())
  .describe("Work item ID, e.g. 'WI-8A4D923C'");

const HUMAN_DECISION =
  "Only call this when the user has explicitly made this decision in the conversation; never decide on their behalf. " +
  "Show them the item (jarvis_get_work_item) first if they haven't seen it.";

async function itemAfter(id: string, signal: AbortSignal): Promise<string> {
  try {
    const d = await api<WorkItem>(`/api/item/${id}`, { signal });
    return itemDetailMarkdown(d, false);
  } catch {
    return "";
  }
}

export function registerControllerTools(server: McpServer): void {
  server.registerTool(
    "jarvis_approve_item",
    {
      title: "Approve and post an entry",
      description: `Approve a PROPOSED work item as a human, which immediately posts its journal entry to the ledger through the Gateway (the only writer). The Gateway re-checks in code that the entry balances, the accounts exist, the period is open and nothing is reconciled twice.

${HUMAN_DECISION}
approver: 'maya' (Controller, default) or 'dev' (staff accountant). Jarvis itself can never approve its own work.
Returns the item's new state and the posted entry, or a DENIED message if the controls refuse it.`,
      inputSchema: z.strictObject({
        item_id: itemId,
        reason: z.string().min(2).max(500).default("Approved").describe("Approval note recorded in the audit log"),
        approver: z.enum(["maya", "dev"]).default(DEFAULT_APPROVER).describe("Human identity approving: 'maya' (Controller) or 'dev' (staff accountant)")
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async ({ item_id, reason, approver }, ctx) => {
      await api(`/api/item/${item_id}/approve`, { method: "POST", body: { who: approver, reason }, signal: ctx.mcpReq.signal });
      return text(`Approved by ${approver} and posted.\n\n${await itemAfter(item_id, ctx.mcpReq.signal)}`);
    }
  );

  server.registerTool(
    "jarvis_reject_item",
    {
      title: "Reject a proposal",
      description: `Reject a PROPOSED work item as the Controller, with a reason. The rejection becomes a precedent: Jarvis reads the reason, logs a new plan and usually re-proposes (e.g. "she's billing $2,000" turns into a corrected accrual and, after enough precedents, a general policy proposal).

${HUMAN_DECISION}
Returns the item (or its replacement) after Jarvis reacts.`,
      inputSchema: z.strictObject({
        item_id: itemId,
        reason: z.string().min(3).max(1000).describe("Why it's wrong and what's right, in the Controller's words")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ item_id, reason }, ctx) => {
      const r = await api<Partial<WorkItem>>(`/api/item/${item_id}/reject`, { method: "POST", body: { reason }, signal: ctx.mcpReq.signal });
      const next = r?.item_id && r.item_id !== item_id ? `Jarvis re-proposed as ${r.item_id}.\n\n${await itemAfter(r.item_id, ctx.mcpReq.signal)}` : await itemAfter(item_id, ctx.mcpReq.signal);
      return text(`Rejected. ${next}`);
    }
  );

  server.registerTool(
    "jarvis_answer_question",
    {
      title: "Answer Jarvis's question",
      description: `Answer a NEEDS_INFO work item (Jarvis asks instead of guessing, e.g. "What is 'Zelle payment to R Lopez' -$350.00?"). Jarvis re-plans with the answer and usually proposes an entry for approval.

${HUMAN_DECISION} The answer must be the user's own words or facts, not something you infer.
Example: item_id="WI-D42CF7EE", text="R. Lopez was a cash stagehand for the Oakland show on Sep 25; book it to crew labor."`,
      inputSchema: z.strictObject({
        item_id: itemId,
        text: z.string().min(2).max(1000).describe("The user's answer")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ item_id, text: answer }, ctx) => {
      await api(`/api/item/${item_id}/answer`, { method: "POST", body: { text: answer }, signal: ctx.mcpReq.signal });
      return text(`Answer recorded.\n\n${await itemAfter(item_id, ctx.mcpReq.signal)}`);
    }
  );

  server.registerTool(
    "jarvis_challenge_item",
    {
      title: "Challenge a decision",
      description: `Push back on one of Jarvis's decisions and make it defend itself from its own evidence (or concede if the evidence doesn't support it). Doesn't change the entry; the challenge and the defense are logged.

Example: item_id="WI-8A4D923C", question="Why not just expense it all like we always do with PayPal? It's under materiality."
Returns Jarvis's answer and the evidence ids it cited.`,
      inputSchema: z.strictObject({
        item_id: itemId,
        question: z.string().min(5).max(1000).describe("The objection or question, as the Controller would put it")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ item_id, question }, ctx) => {
      const r = await api<{ answer: string; evidence: string[]; llm: boolean }>(`/api/item/${item_id}/challenge`, {
        method: "POST",
        body: { question },
        signal: ctx.mcpReq.signal,
        timeoutMs: 120_000
      });
      return {
        content: [
          {
            type: "text",
            text: `**Jarvis's defense** (${r.llm ? "Claude" : "deterministic"}):\n\n${r.answer}\n\nCited evidence: ${r.evidence.join(", ") || "none"}`
          }
        ],
        structuredContent: r
      };
    }
  );

  server.registerTool(
    "jarvis_decide_policy",
    {
      title: "Approve or reject a policy",
      description: `Approve or reject a policy Jarvis proposed from precedents (see jarvis_list_policies). Only the Controller can decide policies. Approved policies change how Jarvis treats future items.

${HUMAN_DECISION}
Example: policy_id="pol-002", version=1, decision="approve".`,
      inputSchema: z.strictObject({
        policy_id: z.string().regex(/^pol-\d+$/i, "Policy IDs look like pol-002").describe("Policy ID, e.g. 'pol-002'"),
        version: z.number().int().min(1).default(1).describe("Policy version"),
        decision: z.enum(["approve", "reject"]).describe("The Controller's decision")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ policy_id, version, decision }, ctx) => {
      await api(`/api/policy/${policy_id.toLowerCase()}/${version}/${decision}`, { method: "POST", signal: ctx.mcpReq.signal });
      const s = await getState(ctx.mcpReq.signal);
      const p = s.policies.find(x => x.policy_id === policy_id.toLowerCase() && x.version === version);
      return text(`Policy ${policy_id} v${version}: ${p ? `${p.status}${p.approved_by ? ` by ${p.approved_by}` : ""}` : decision + "d"}.\n${p?.title ?? ""}`);
    }
  );

  server.registerTool(
    "jarvis_attempt_self_approval",
    {
      title: "Demo: Jarvis tries to self-approve",
      description:
        "Demonstrate JarvisERP's limits: the agent attempts to approve its own proposal as identity 'jarvis'. The role check refuses it in code, and the refusal is written to the audit log (it appears as a red node in the UI). Use only to show the control working; it never posts anything.",
      inputSchema: z.strictObject({ item_id: itemId }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async ({ item_id }, ctx) => {
      const r = await api<{ denied: boolean; reason?: string }>(`/api/item/${item_id}/self-approve`, { method: "POST", signal: ctx.mcpReq.signal });
      return {
        content: [
          {
            type: "text",
            text: r.denied
              ? `Denied, as designed: ${r.reason}\nThe attempt is logged; see jarvis_get_audit_log(denied_only=true).`
              : "WARNING: the self-approval was NOT denied. The segregation-of-duties control did not fire; check jarvis/work/roles.py."
          }
        ],
        structuredContent: r
      };
    }
  );
}
