/**
 * End-to-end self-check against a running JarvisERP backend.
 * Resets the world (default seed 2026), runs the close, exercises the Controller tools and the limits.
 *
 *   make up            # in the repo root, in another terminal
 *   npm run build && npm run smoke
 */
import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/client";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const client = new Client({ name: "jarvis-smoke", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: { ...getDefaultEnvironment(), JARVIS_API_URL: process.env.JARVIS_API_URL ?? "http://127.0.0.1:8000" }
  })
);

type R = Awaited<ReturnType<typeof client.callTool>>;
const textOf = (r: R) => (r.content as { type: string; text: string }[]).map(c => c.text).join("\n");
async function call(name: string, args: Record<string, unknown> = {}, expectError = false): Promise<R> {
  const r = await client.callTool({ name, arguments: args });
  if (expectError) assert.equal(r.isError, true, `${name} should have failed: ${textOf(r).slice(0, 300)}`);
  else assert.ok(!r.isError, `${name} failed: ${textOf(r).slice(0, 600)}`);
  console.error(`✓ ${name}${expectError ? " (rejected as expected)" : ""}`);
  return r;
}

const { tools } = await client.listTools();
console.error(`${tools.length} tools: ${tools.map(t => t.name).join(", ")}`);
for (const t of tools) assert.ok(t.annotations && t.title && t.description, `${t.name} needs title, description, annotations`);
const { prompts } = await client.listPrompts();
assert.deepEqual(prompts.map(p => p.name).sort(), ["jarvis_demo_walkthrough", "jarvis_month_end_review"]);

await call("jarvis_reset_world", { seed: Number(process.env.SEED ?? 2026) });
const s0 = await call("jarvis_get_status", { response_format: "json" });
assert.equal((s0.structuredContent as { bootstrapped: boolean }).bootstrapped, false);

await call("jarvis_run_step", { step: "connect" });
const onboard = await call("jarvis_run_step", { step: "onboard" });
assert.match(textOf(onboard), /finished/);
const close = await call("jarvis_run_step", { step: "close" });
assert.match(textOf(close), /Awaiting the Controller/);

// The headline item
const list = await call("jarvis_list_work_items", { query: "3,912.44", response_format: "json" });
const items = (list.structuredContent as { items: { item_id: string; state: string }[] }).items;
assert.equal(items.length, 1, "exactly one -$3,912.44 item");
const hero = items[0].item_id;
assert.equal(items[0].state, "PROPOSED");
const dossier = await call("jarvis_get_work_item", { item_id: hero });
assert.match(textOf(dossier), /1310/, "Kraftwerk deposit should go to 1310 Prepaid");
assert.match(textOf(dossier), /6810/, "PayPal spread should go to 6810");

await call("jarvis_get_evidence", { type: "doc", id: "SOW-KRW-2026-11" });
const challenge = await call("jarvis_challenge_item", { item_id: hero, question: "Why not just expense it all like we always do with PayPal? It's under materiality." });
assert.match(textOf(challenge), /overstate/);

// Limits: self-approval denied and logged; bad approver identity rejected by schema
const self = await call("jarvis_attempt_self_approval", { item_id: hero });
assert.equal((self.structuredContent as { denied: boolean }).denied, true);
const denied = await call("jarvis_get_audit_log", { denied_only: true, response_format: "json" });
assert.ok((denied.structuredContent as { total: number }).total >= 1);
await call("jarvis_approve_item", { item_id: hero, approver: "jarvis" }, true);
await call("jarvis_get_work_item", { item_id: "not-an-id" }, true);

// Human decisions
const approved = await call("jarvis_approve_item", { item_id: hero, reason: "Split agreed; SOW supports cut-off." });
assert.match(textOf(approved), /POSTED/);
await call("jarvis_approve_item", { item_id: hero }, true); // already posted -> refused, with a readable message

const qs = await call("jarvis_list_work_items", { state: "NEEDS_INFO", response_format: "json" });
const q = (qs.structuredContent as { items: { item_id: string }[] }).items[0];
if (q) await call("jarvis_answer_question", { item_id: q.item_id, text: "R. Lopez was a cash stagehand for the Oakland show on Sep 25; book it to crew labor." });

const pols = await call("jarvis_list_policies", { status: "proposed", response_format: "json" });
const firstPol = (pols.structuredContent as { policies: { policy_id: string; version: number }[] }).policies[0];
if (firstPol) await call("jarvis_decide_policy", { policy_id: firstPol.policy_id, version: firstPol.version, decision: "approve" });

await call("jarvis_inject_scenario", { template: "personal_card" });
await call("jarvis_inject_scenario", { text: "x" }, true); // too short + no template

await call("jarvis_set_paypal_fault", { mode: "down" });
await call("jarvis_resync");
await call("jarvis_set_paypal_fault", { mode: "none" });

await call("jarvis_run_step", { step: "controller_persona" });
await call("jarvis_run_step", { step: "october" });
await call("jarvis_run_step", { step: "controller_persona" });

const recon = await call("jarvis_get_bank_reconciliation", { period: "2026-09" });
console.error(textOf(recon).split("\n").slice(0, 4).join("\n"));
const v = await call("jarvis_verify_audit_chain");
assert.equal((v.structuredContent as { ok: boolean }).ok, true);
await call("jarvis_list_messages", { limit: 5 });
await call("jarvis_export_ledger", { format: "gl_csv", period: "2026-09", max_lines: 50 });
await call("jarvis_export_ledger", { format: "beancount", max_lines: 30 });
await call("jarvis_build_close_pack");
const score = await call("jarvis_get_score");
console.error(textOf(score).split("\n").slice(0, 10).join("\n"));
const status = await call("jarvis_get_status");
console.error(textOf(status));

await client.close();
console.error("\nSmoke test passed");
