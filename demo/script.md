# Demo script (video ≤ 3 min · live demo ≤ 4 min)

## Video — open with the moment (0:00–0:25)
1. Full screen: the September bank feed line `PAYPAL INST XFER … −$3,912.44`. Caption: *"A bank-feed rule calls this 'Software Expense'."*
2. Cut to the Synapse Trace. Click the node. Show the dossier and the five-line journal entry:
   - prepaid $3,451.50
   - FX fee $147.50
   - Anthropic (Claude) $200
   - employee receivable $113.44
   - cash −$3,912.44
3. Type the challenge: *"Why not just expense it all like we always do with PayPal? It's under materiality."* Jarvis's defense appears and the cited nodes pulse.
4. Voice line: **"It caught a deposit for a show that hasn't happened, a currency fee, a duplicate vendor, and an employee's personal purchase — in one bank line — and defended it."**

## Video — the seats & the company (0:25–0:45)
- One line: *"JarvisERP fills the Staff Accountant and Vendor-Master seats at Afterglow Labs — a touring audio-visual studio that pays EU crews in euros through PayPal, runs cards on Ramp, and books in QuickBooks."*
- Flash the source files: the Chase CSV, the PayPal activity download, the Ramp export, a SOW and a timesheet.

## Video — World · Time · Team · Limits (0:45–2:15)
- **World (15s):** ① Connect.
  - The sync toast shows +122 bank, +34 PayPal, +116 Ramp.
  - Set PayPal to *down*, then ↻ Sync. The ticker shows 503 → backoff → fallback to the export. Zero duplicates.
- **Time (30s):** ② Learn.
  - Policies appear, each with its precedent count (e.g. "pol-005: 3 precedents, invoices averaged 1.114× estimate").
  - Then ⑤ October: Lumen's invoice is $670 over the accrual, and Jarvis explains why (the SOW's after-hours clause).
- **Team (30s):**
  - The Controller rejects the Nadia accrual: *"she's billing $2,000"*. Jarvis re-plans at $2,000, records the precedent, and proposes general policy **pol-008**. Maya approves it.
  - The Zelle to "R Lopez" gets a question; Maya answers; it's booked to crew costs.
- **Limits (15s):**
  - Click *Let Jarvis self-approve*. It's **DENIED in code**, and a red node appears.
  - ⛓ Verify: audit chain intact, N events.

## Video — proof (2:15–2:45)
- ◎ Score: **100% vs answer key; rules baseline 61–64%**, and 100% on traps.
- Flash `evals/REPORT.md` (6 seeds) and the test list (limits + judge scenarios).
- Real vs simulated table (README).

## Live demo at judging
1. Have a fresh world ready: `make fresh`.
2. Click ① ② ④ ③ (about 10 s total). Open the moment and challenge it.
3. **"Give us a scenario."** Type theirs into ⚡ Scenario. Fallback templates:
   - unknown debit
   - personal card charge
   - duplicate bill
   - PayPal bundle
   - vendor invoice over accrual
4. Answer the follow-up question in the inbox. Then show the audit trail: "why?" is one query.

## Likely judge questions
- **"What if the LLM is wrong?"** It never produces a number. Matching, FX, subset-sum, cut-off and accrual measurement are code. The Gateway re-validates everything. With no key, the whole system runs deterministically.
- **"Why trust the bank over the ledger?"** Each skill applies a trust ranking (README → Time/Team), and each rationale cites it.
- **"What access does it have?"**
  - It reads records through tools and proposes. The standing policy P-001 approves only exact subledger matches and bank fees under $250.
  - Everything else goes to the Controller, and only the Gateway writes.
  - In Elastic, per-role API keys (`make keys`); the agent never uses the master key.
- **"How does it get better?"** Corrections become precedents. Once three agree, Jarvis proposes a versioned policy for the Controller to approve.
