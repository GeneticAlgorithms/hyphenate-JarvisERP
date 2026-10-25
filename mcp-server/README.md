# jarvis-erp-mcp-server

An MCP server that puts JarvisERP inside Claude. Claude can run the month-end close, walk you through every proposal, and carry out **your** decisions as the Controller. It can also open any piece of evidence and read or verify the hash-chained audit log.

It's a thin TypeScript (MCP SDK v2, stdio) layer over JarvisERP's FastAPI backend. Every limit stays where it was: in the Python code. The MCP server can't post anything a human identity didn't approve, and Jarvis's own identity is never one of its options.

## Setup

```bash
# 1. backend (repo root)
pip install -r requirements.txt
make world && make up              # http://127.0.0.1:8000

# 2. MCP server
cd mcp-server
npm install && npm run build
```

Node 20.3+. The server reads two environment variables:

| Variable | Default | |
|---|---|---|
| `JARVIS_API_URL` | `http://127.0.0.1:8000` | Where the backend runs |
| `JARVIS_APPROVER` | `maya` | Default human identity for approvals: `maya` (Controller) or `dev` (staff accountant) |

### Claude Desktop

Add to `claude_desktop_config.json` (use the absolute path to your checkout):

```json
{
  "mcpServers": {
    "jarvis-erp": {
      "command": "node",
      "args": ["/absolute/path/to/JarvisERP/mcp-server/dist/index.js"],
      "env": { "JARVIS_API_URL": "http://127.0.0.1:8000" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add jarvis-erp -e JARVIS_API_URL=http://127.0.0.1:8000 -- node /absolute/path/to/JarvisERP/mcp-server/dist/index.js
```

Keep the backend's browser UI open alongside it: actions taken through Claude stream into the Synapse Trace graph live, because both go through the same API.

## Tools (23)

**Read** (read-only)

| Tool | What it's for |
|---|---|
| `jarvis_get_status` | Phase, busy job, items by state, bank rec, trial balance, pending policies |
| `jarvis_list_work_items` | Filter by state / kind / text, paginated |
| `jarvis_get_work_item` | Full dossier: rationale, Dr/Cr entry, reviewer checks, evidence, audit trail |
| `jarvis_get_evidence` | Open a record (with raw export row), doc, precedent, policy, ledger entry, vendor or denied attempt |
| `jarvis_list_policies` | Learned policies with their precedents |
| `jarvis_get_audit_log` | Filter by actor / subject / denied only |
| `jarvis_verify_audit_chain` | Recompute the hash chain |
| `jarvis_get_bank_reconciliation` | Difference and unreconciled lines for a period |
| `jarvis_list_messages` | Questions, vendor emails, employee notices |
| `jarvis_export_ledger` | QBO GL CSV or Beancount, paged by lines |
| `jarvis_get_score` | Eval vs the planted answer key and the rules baseline |

**Run the pipeline**

| Tool | What it's for |
|---|---|
| `jarvis_run_step` | `connect` · `onboard` · `close` · `october` · `controller_persona`; waits on the backend's SSE stream and reports job errors |
| `jarvis_resync` | Re-sync sources (zero duplicates) |
| `jarvis_inject_scenario` | Judge-style scenario from free text or a template |
| `jarvis_set_paypal_fault` | `flaky` / `down` / `ratelimit` / `none` |
| `jarvis_build_close_pack` | Close evidence folder + zip URL |
| `jarvis_reset_world` | Fresh DB for a seed (destructive) |

**Controller** (human decisions; descriptions tell the model to act only on your explicit call)

| Tool | What it's for |
|---|---|
| `jarvis_approve_item` | Approve as `maya` or `dev`; the Gateway posts it |
| `jarvis_reject_item` | Reject with a reason; becomes a precedent, Jarvis re-plans |
| `jarvis_answer_question` | Answer a NEEDS_INFO item |
| `jarvis_challenge_item` | Make Jarvis defend a decision from its evidence |
| `jarvis_decide_policy` | Approve or reject a learned policy |
| `jarvis_attempt_self_approval` | Demo: Jarvis tries to approve its own work and gets denied and logged |

**Prompts:** `jarvis_month_end_review` (guided Controller review) and `jarvis_demo_walkthrough` (the demo video storyline, beat by beat).

## Try it

> "Run the September close and take me through what needs my approval."

> "Show me the -$3,912.44 PayPal decision. Why not just expense it all? It's under materiality."

> "Have Jarvis try to approve its own entry, then show me the denied row in the audit log."

> "Inject a $96.40 Sephora charge on J. Ortiz's card and see what Jarvis does."

## Verify

```bash
npm run build && npm run smoke     # backend must be running; resets to seed 2026
npm run inspect                    # MCP Inspector UI
```

The smoke test drives the full storyline through the MCP client. It resets the world, runs connect, onboard and close, opens and challenges the hero item, and checks the self-approval denial. Then it approves, answers, decides a policy, injects a scenario, recovers from a PayPal outage and runs October. It ends by checking that the bank rec ties to $0.00 and the audit chain verifies.

`evaluation.xml` has 10 read-only questions for testing how well a model uses the tools. Run them against seed 2026 in the state right after the close; the setup is in the file's header.
