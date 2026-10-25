# JarvisERP — an autonomous Staff Accountant you could actually hire

**Seats:** JarvisERP fills Afterglow Labs' **Staff Accountant (cash & expense close)** and **Vendor-Master Clerk** seats. It reconciles bank, PayPal and Ramp to the ledger, books accruals and timing entries, and keeps the vendor list deduplicated. It **cannot post anything its human Controller hasn't approved**: that limit is enforced in code, not in a prompt.

*CalHacks 2026 · Hyphenate track — "The Hyphenated Enterprise: Autonomous Systems for Finance"*

---

## ★ The moment (what the demo video opens with)

The September bank feed shows one line: `PAYPAL INST XFER DCE4343478 … −$3,912.44`. A rules-based bank feed books it as **"PayPal — Software Expense $3,912.44"**.

Jarvis instead:

1. Recognizes the line is a PayPal **funding transfer**, not a purchase. It finds the PayPal funding row (PayPal links only *one* of the payments) and solves **subset-sum** over nearby PayPal payments. Three payments tie to the cent.
2. Reads the vendor's **SOW in Drive**. The €2,950 to Kraftwerk Rigging is a deposit for a **14 November** show, so it goes to **prepaid** (cut-off), not to September expense.
3. Values the EUR at the **ECB rate** (1.1700 → $3,451.50). The $147.50 PayPal took on top (at 1.2200) is an **FX fee**.
4. Files the $200 "Claude Max" payment under the **existing vendor Anthropic**. Ramp wanted to create a new vendor called "Claude".
5. Sees the $113.44 Steam purchase came from the tour manager's login and recalls Controller **ruling P-0317 from March**: personal purchases go to employee receivable regardless of size.

| Account | Dr | Cr |
|---|---:|---:|
| 1310 Prepaid Tour Costs (Kraftwerk, Berlin 14 Nov) | 3,451.50 | |
| 6810 Bank & FX Fees (PayPal spread) | 147.50 | |
| 6410 Software & AI Tools — vendor Anthropic | 200.00 | |
| 1250 Employee Receivable — J. Ortiz | 113.44 | |
| 1010 Cash — Chase Operating | | 3,912.44 |

Then the Controller pushes back: *"Why not just expense it all like we always do with PayPal? It's under materiality."* Jarvis **defends** the split from its evidence:

- Expensing all of it would overstate September opex by $3,564.94.
- The personal item is a control issue, so materiality isn't the test.

Every cited node pulses in the graph.

## Proof it works

| | Jarvis | Rules-based bank feed (B1) |
|---|---:|---:|
| September items fully correct (6 seeds, 44–47 items each) | **100%** | 61–64% |
| Issues detected | **100%** | 74% |
| Exact entry (account + amount to the cent) | **100%** | 45% |
| Traps left alone (things that *look* wrong but aren't) | **100%** | 100% |
| Asked a human exactly when it should | **100%** | 71% |
| Bank rec ties to $0.00 · trial balance balances · Beancount `bean-check` · audit hash chain verifies | ✅ all seeds | — |

Full report: [`evals/REPORT.md`](evals/REPORT.md). Reproduce with `make eval`.

**How we know:**

- **The answer key.** Each seed is a freshly generated world with planted issues and a key. The planted issues are bundled transfers, cross-system duplicates, FX, personal purchases, prepaid deposits, accrual-vs-actual, missing invoices, interest timing, vendor aliases, misclassified refunds, transfers that look like expenses, and payments from the PayPal balance that never hit the bank. The world also contains **traps** (a look-alike vendor, a music-store charge that is legitimately gear, a SaaS price increase, a signed SOW for *next* month). The agent never reads the key.
- **Judge-style scenarios** (`tests/test_scenarios.py`) are injected into a closed world from outside the generator: an unknown debit, a personal Sephora charge, a duplicate Notion bill, a new PayPal bundle, and free text.
- **Limits are tested as code** (`tests/test_limits.py`):
  - self-approval is denied
  - only the gateway can post
  - P-001 can't approve judgment calls
  - locked periods are refused
  - re-sync creates zero duplicates
  - the audit log rejects `UPDATE` and the hash chain verifies
  - a PayPal API outage falls back to the CSV export and the fallback is logged

**Honest caveats:**

- Seeds vary amounts, dates, merchants, hours and FX, but share the scenario *structure*. 100% across seeds shows determinism and correctness on this world; it doesn't prove generalization. That's what the injector and the live judge scenarios are for.
- The Controller is a scripted persona unless `ANTHROPIC_API_KEY` is set.

### What's real vs simulated

| Real | Simulated |
|---|---|
| Double-entry ledger with balance checks (exported to Beancount, `bean-check` clean), QBO-format GL export | Afterglow Labs and all its transactions (seeded generator) |
| System of work: SQLite work items, state machine, roles, **Gateway** (only writer), hash-chained append-only audit log | Bank / PayPal / Ramp: data in their real export formats (Chase CSV, PayPal activity download, Ramp export), PayPal served via a mock API with fault injection |
| Retrieval: Elastic hybrid search (BM25 + `semantic_text`, RRF), ES\|QL helper, per-role API keys (`make keys`); local BM25 fallback | People: Controller, vendors and employees are personas (scripted; Claude when a key is set) |
| Matching, subset-sum, FX math, cut-off, accrual measurement, vendor resolution: deterministic code (the LLM never produces a number that isn't recomputed) | Documents: SOWs, timesheets, invoices, emails, run sheets, receipts, bank notices |

## How it maps to Hyphenate's brief (World · Time · Team · Limits)

- **World.** Systems of record (bank, PayPal, Ramp, docs, ledger) are synced *statefully*: raw → standardized → golden, with stable ids and a cursor per source, so a re-sync never duplicates. Jarvis only *reads* them. Every write goes through **one door, the Gateway**, which validates in code that the entry balances, accounts exist, the period is open and nothing is reconciled twice.
- **Time.**
  - *Onboarding:* Jarvis mines Jan–Aug precedents and proposes versioned policies with their evidence, e.g. "pol-005: accrue at contract × approved hours — 3 precedents, invoices averaged 1.114× estimate".
  - March's personal-purchase ruling changes September's behaviour. September accruals are reversed and trued-up in October; the $670 difference is explained by the SOW's after-hours clause.
  - *Self-improving:* when the Controller corrects the Nadia accrual ("she's billing $2,000"), it becomes precedent #3 of its kind, and Jarvis proposes a **general policy** (pol-008) for her to approve.
- **Team.**
  - The Controller approves, rejects or answers. A "no" becomes precedent and a new, logged plan.
  - Unknown cash (a Zelle to "R Lopez") gets a *question*, not a guess.
  - Vendors get emails ("please confirm your September amount"); employees get notified of personal charges.
- **Limits.**
  - `ROLES[role][resource] → actions`, `can()` checked on every transition.
  - Requester ≠ approver. The standing policy P-001 auto-approves only exact subledger matches and bank fees under $250.
  - Denied attempts are logged and shown as red nodes.
  - Each audit row is written in the **same transaction** as the change, hash-chained to the previous one, and protected by append-only triggers.

## Run it

```bash
pip install -r requirements.txt
make world            # generate the world (seed 2026 reproduces the numbers above)
make up               # → http://localhost:8000
```

In the UI, click **① Connect → ② Learn → ④ Controller → ③ Close Sep**. Then:

- Click the −$3,912.44 node and hit **Challenge Jarvis**.
- Try **"Let Jarvis self-approve"**: it gets denied and logged.
- Run **④ Controller → ⑤ October → ◎ Score**.
- Other things to try:
  - **⚡ Scenario** lets judges type their own case.
  - The PayPal dropdown injects API faults; hit **↻ Sync** to see the recovery.
  - **🗂 Pack** builds the close evidence folder.
  - **⛓ Verify** recomputes the audit chain.

Terminal-only: `make demo-cli`. Tests: `make test`. Evals: `make eval`.

### Optional: Elastic + Claude

Copy `.env.example` → `.env`:

- `ELASTIC_URL` + `ELASTIC_API_KEY` turns on Elastic hybrid retrieval. Indices are created automatically, and `semantic_text` is used when an inference endpoint exists. Run `make keys` to mint restricted per-role keys; at runtime the agent uses `JARVIS_PREPARER_KEY`, never the master key.
- `ANTHROPIC_API_KEY` turns on Claude for narration, the Controller persona, defending decisions and free-text scenario parsing.

Without either, everything runs locally and deterministically.

## Architecture

```
 Systems of record                 System of work (ours)                         Outcomes
 ─────────────────                 ─────────────────────                         ────────
 Chase CSV ─┐                      work.db (SQLite, ACID)                        Ledger (only via Gateway)
 PayPal API ├─ sync (cursors, ─►   records · docs · precedents · policies   ─►   ├ QBO-format GL export
 Ramp CSV   │   stable ids,        work_items ─ state machine ─ roles.can()     ├ Beancount file (bean-check)
 Docs       │   fault fallback)    audit_log (append-only, hash-chained)        ├ vendor master / aliases
 QBO        ┘                              ▲                 │                   └ close evidence pack
                                           │                 ▼
               Elastic / BM25 retrieval ◄─ Jarvis (preparer) → reviewer (critic) → P-001 or Controller → Gateway
                                           skills: bank · PayPal subset-sum · FX · cut-off · accruals · vendors · duplicates
```

**UI — Synapse Trace.** A layered 3D evidence graph in the visual language of our `brain` project (fluorescent pastels on ink):

- Columns, left to right: systems & people → source records & docs → policies/precedents/FX → decisions → ledger outcomes.
- Mint edges support a decision, pink edges contradict it, red nodes are denied attempts.
- Particles flow along posted entries, and nodes pulse when Jarvis touches them.
- Click anything for its dossier: rationale, entry, evidence, reviewer checks, and the full "why?" audit trail.

## Repo map

```
jarvis/world/      generator.py (seeded world + answer key) · bible.py (company, CoA, vendors, policy) · ids.py
jarvis/work/       db.py · roles.py · transition.py (state machine + audit) · gateway.py · sync.py · ledger.py · events.py
jarvis/search/     local BM25 + Elastic backend (hybrid/RRF, ES|QL, audit mirror) · mint_keys.py
jarvis/agent/      skills.py · engine.py · policies.py (learn / generalize) · personas.py · defend.py · injector.py · llm.py
jarvis/api/        server.py (FastAPI + SSE) · graph.py (Synapse Trace) · closepack.py
jarvis/evals/      score.py · baselines.py (B1 rules) · run.py
ui/                index.html · app.js · styles.css · vendor/3d-force-graph
tests/             test_limits.py · test_scenarios.py
PLAN.md            the implementation plan
```
