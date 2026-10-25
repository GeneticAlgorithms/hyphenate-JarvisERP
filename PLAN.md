# JarvisERP — Implementation Plan (CalHacks 2026 · Hyphenate Track)

> Status: **planning only — nothing implemented yet.**
> Working folder: `JarvisERP/` → final push to `https://github.com/GeneticAlgorithms/hyphenate-JarvisERP`
> Secrets: see `CREDENTIALS.md` (gitignored). Code reads `.env` only.
> Written Sat Oct 24, 2026, 5:40 pm PT.

---

## 0. TL;DR

**Build:** an autonomous Staff Accountant for a fictional AV studio, **Afterglow Labs**, that closes September 2026. It reconciles three systems that never agree (bank ↔ PayPal ↔ Ramp) against the ledger, books accruals and timing entries, and keeps the vendor list clean. Every step it takes appears as a glowing node in a **Synapse Trace**: a neural-network-style evidence graph that reuses the visual language of the `brain` project. Nothing posts to the ledger without passing a code-enforced policy gate and, above a threshold, a Controller's approval.

**Seats (the one line for the submission):**
> *JarvisERP fills Afterglow's Staff Accountant (cash & expense close) and Vendor-Master Clerk seats: it reconciles bank, PayPal and Ramp to the ledger, books accruals, and keeps vendors deduplicated — and it cannot post anything its human Controller hasn't approved.*

**Why it wins (one per pillar):**
| Pillar | Our answer |
|---|---|
| Is it real enough? | 9 months of generated books in real export formats (bank CSV, PayPal activity CSV, Ramp CSV, QBO-style GL), invoices/SOWs/emails as documents, **~45 planted errors with an answer key**, scored against two baselines on 3 seeds plus a held-out seed |
| Would you hire it? | Separate Elastic API keys per role, requester ≠ approver enforced in code, period locks, materiality thresholds, tamper-evident hash-chained audit log, and an explicit "ask" policy (it emails the vendor, escalates to the controller, and records the answer) |
| Something new? | A touring AV studio + SaaS (EUR festival deposits, late crew invoices, AI-tool vendor sprawl). The approach is the novel part: **precedent memory** (a March controller ruling changes what it does in September) plus a visual evidence graph you can audit by clicking |
| The moment | One cryptic `PAYPAL *INST XFER -$3,912.44` bank line. The bank-feed rule calls it "Software Expense". Jarvis splits it into a EUR crew deposit (a prepaid, not an expense, plus an FX fee), a Claude subscription (linked to the existing Anthropic vendor rather than a new "Claude" vendor) and a personal purchase (an employee receivable). Then it **defends** that split when the Controller pushes back |

---

## 0.5 What Hyphenate told us (workshop deck, "Beyond Agentic Harnesses") — design to this

The deck is effectively the grading key. Its ideas map onto our build as follows:

| Deck says | We build |
|---|---|
| **"Records hold the truth. A system of work holds the work."** Systems of record (bank, ERP, contracts, inbox) disagree; *you integrate, you don't replace*. Build the system of work: work items, decisions and reasons, questions and approvals, learned policies, the log | Bank/PayPal/Ramp/docs/Beancount = **systems of record** (read via sync; only the Gateway writes). JarvisERP = the **system of work**: `work_items`, `policies`, `precedents`, `audit_log` |
| **Gateway: "One door. Every write checked."** | `gateway.py` replaces "posting service": the *only* code path that writes to the ledger or vendor master |
| Four day-one questions: **WORLD** (where does it act?) · **TIME** (what does it remember next quarter?) · **TEAM** (who does it work with?) · **LIMITS** (what may it do, and can it prove why?) | The README and pitch are structured around these four headings. One demo beat for each |
| **01 Self-learning at onboarding:** the agent queries a year of history to see how the team booked short wires, then `propose_policy` "pol-001: wire ≤ $50 short → 6850" with *214 precedents* as evidence → `needs_approval` | **Onboarding run:** Jarvis mines Jan–Aug history and proposes policies with precedent counts, e.g. `pol-001: PayPal funding transfer → split to underlying PayPal payments`, `pol-002: PayPal FX spread ≤ 5% → 6810`, `pol-003: personal purchase → 1250 Employee Receivable`. The Controller approves them. *This is the "learns the job" beat* |
| **02 Self-improving:** a human correction → `search_precedents` → spot the pattern → propose a *general* policy | Controller corrects one match (e.g. a split across two crew invoices) → Jarvis finds 3 similar past corrections → proposes `pol-014` (generalized) → needs approval |
| **03 Audit trail:** "Months later, 'why?' is one query." Append-only, written with the change | `SELECT at, actor, change, why FROM audit_log WHERE subject = ?` is exposed in the UI as "Why?" on every node, plus the hash chain |
| **Build 1 Environment:** raw → standardized → golden; *stateful, change-only sync with a cursor per source; stable ids (md5(acct\|src_id)); re-sync never duplicates; late bank posts re-read; every golden row traces to its raw row* | Ingestor implements exactly this: `raw/` landed as-is → `std` typed/signed (cents) → `golden` rows with `raw_ref`; `sync_cursor(source, cursor, at)`; idempotent upserts. **Demo: re-run sync live → 0 duplicates** |
| **Build 2 Roles:** `ROLES = {role: {resource: {actions}}}`; `can(actor, action, res)`; *no role can "post": only the gateway does*; approve denied if `proposed_by == actor` | `roles.py` copies this shape: actors `sync`, `ai_agent`, `ai_reviewer`, `human_accountant`, `human_controller`, `gateway` |
| **Build 3 Harness:** *tools are CRUD on the work.* State machine `NEW → PROPOSED ⇄ NEEDS_INFO → APPROVED → POSTED`; no delete, "a reversal is a new transition" | Agent tools never touch tables or keys. They call `transition(item, action, actor, patch, reason)`. Same states. Reversals and true-ups are new work items linked to the original |
| **Build 4 Traceability:** log every transition as a **diff**, *in the same commit as the change*; **denied attempts are logged too** | SQLite transaction writes the item + audit row atomically. **Denied attempts become red nodes in the Synapse Trace** (e.g. the agent tries to approve its own proposal → `Denied` → logged). That makes LIMITS visible |
| **Strong:** real company with a messy corner + answer key; few roles done deep, named in one line; asks at the right moment and handles a no; limits enforced in code; record of every call; a moment on stage and a score to back it | Already our plan. Keep the checklist in §15 |
| **Weak:** chatbot over a spreadsheet; ten shallow workflows; clean happy-path data; **"an admin key, and 'the prompt tells it not to'"**; **"memory that ends with the context window"**; "trust me" | Never use the master Elastic key at runtime. Precedents and policies persist in the DB + Elastic across runs. Every claim gets a score |
| Their running example: wire $57,975 vs invoice $58,000 → $25 short → bank fee | Use **our own** example (PayPal bundle + FX). Don't copy theirs, since novelty is judged. But do show we handle that class (small gap → policy → fee) |
| Judging pillar 4 is phrased **"Did it have a 'wow' moment?"** | §4 Moment |

**Where state lives (changed by the deck):** the system of work needs atomic "change + audit row" commits, which Elastic doesn't provide transactionally. So:
- **SQLite (`work.db`)** = system of work (work_items, policies, precedents, audit_log, sync_cursor, roles) — ACID, the source of truth for the work.
- **Elastic** = the search/retrieval layer over records, documents, precedents and an **audit mirror** (async copy for search, the "why?" query and the graph). It is never the only copy of an audit row.
- **Beancount** = the ledger system of record. Only the Gateway writes to it.

**People to talk to:** Hyphenate booth (all weekend) and Slack **#cohost-hyphenate**. Show them the Moment by ~midnight and ask: (1) their hardest live scenario, (2) BenchRec / Invoice Sandbox details, (3) whether a Beancount stand-in for the ERP is fine.

---

## 1. ⏱ The clock (confirm first!)

- Hacking started **Fri Oct 23, ~6 pm** (the track doc says the in-person workshop at 7 pm is "an hour after hacking starts").
- Past Cal Hacks ended Sunday morning (Cal Hacks 12.0: hacking ended 10:30 am Sunday). **Assumption: hacking ends Sun Oct 25 ~10:30 am. Check Discord or the schedule NOW.** If that holds, we have **~16 hours**.
- Everything below is time-boxed against that assumption. If the deadline is later, spend the extra time on Stretch tiers S1→S4, in that order.

---

## 2. The company (the "world")

**Afterglow Labs, Inc.** is a 28-person Bay Area studio with two businesses:
1. **Afterglow Cloud**: a SaaS for live-visuals artists (subscriptions; revenue isn't our corner, but its card spend is).
2. **Afterglow Live**: produces audio-visual shows for festivals and clubs. EU festivals pay deposits in EUR. Local rigging, lighting and video crews invoice late and inconsistently. Gear is rented and shipped.

Why this company works: it naturally produces **every edge case on the accountant's list**:
| Accountant's edge case | Where it comes from at Afterglow |
|---|---|
| One bank debit = many purchases | PayPal balance top-ups that fund several EUR crew deposits plus subscriptions |
| One purchase in two systems | Ramp card charge → later shows in the bank feed and as a bill in QBO |
| FX conversion and fees | EUR deposits to Berlin and Amsterdam crews paid via PayPal (PayPal's FX spread, plus conversion timing) |
| Personal purchase on business card | Touring staff using the corporate card for personal items on the road |
| Accrual ≠ actual | Lighting crew works in September and invoices in October for a different amount |
| Estimate never received | Freelance VJ never sends an invoice |
| Timing difference | Interest on the money-market sweep earned in September, paid Oct 1 |
| Duplicate vendors | Anthropic/Claude, Anysphere/Cursor, Google/Google Ads, plus a novel one: "Splice" vs "Splice.com" |

Systems Afterglow uses (each one a separate source of truth that disagrees with the others):
```
Chase-style operating bank ──┐
PayPal business account ─────┼──► (exports / mock APIs) ──► Elastic (indexed evidence) ──► Jarvis agent
Ramp corporate cards ────────┤                                                           │
Email + Drive (invoices,     │                                                           ▼
  SOWs, timesheets, receipts)┘                                          Policy Gate ──► Gateway ──► Ledger (Beancount, "QBO")
                                                                                                         └──► QBO-format exports, close pack
People: Controller (Maya Chen) · Tour Manager (J. Ortiz) · Vendors (crews) — played by LLM personas
```

**Close period:** we close **September 2026**. **Jan–Aug 2026** are history, already closed and locked; they contain the precedents. **October** data trickles in during the demo (late invoices, the interest deposit) so we can show reversals and true-ups.

---

## 3. Scope — the corner we own

| ID | Workflow | Tier | Why |
|---|---|---|---|
| C1 | **Three-way cash reconciliation**: bank ↔ PayPal ↔ Ramp ↔ ledger; splits, bundles, FX, duplicates, transfers, refunds, personal purchases | **CORE** | This is the friend's MVP ("three systems that don't work together") and the demo moment |
| C2 | **Accruals and timing**: interest receivable, crew accruals with a slow vendor, Oct reversal and true-up, learned estimate bias | **CORE** | Covers the "time" pillar and "sources that disagree" (SOW vs timesheet vs email) |
| C3 | **Vendor identity resolution**: canonical vendor table, alias links, merge proposals (always human-approved) | **CORE (logic) / light UI** | Cheap, relatable, and judges get it in 5 seconds |
| C4 | **Close evidence pack**: statements, reconciliation reports, JE support auto-named into the folder structure, plus a manifest | **CORE-lite** | Nearly free because we generate the files. Shows "clean record of its work" |
| C5 | Financial package roll-forward (BS/P&L/SCF → xlsx with flux comments tied to drivers) | Stretch S1 | Strong but extra surface area |
| — | Revenue, payroll, AR collections, consolidation | **OUT** | Say "not our seats" explicitly. Judges reward a tight corner |

---

## 4. The Moment (video opens with this — 20 seconds)

**Setup on screen:** September bank feed. Line: `09/18  PAYPAL *INST XFER 4029357733   -3,912.44`. The rule-based bank feed (baseline) suggests **Payee: PayPal · Category: Software Expense · $3,912.44**.

**Jarvis (Synapse Trace lights up left→right):**
1. Recognizes the line is a PayPal **funding transfer**, not a purchase. It pulls PayPal activity for ±5 days.
2. Finds the subset of PayPal payments that sums to the funded amount (subset-sum over candidates retrieved from Elastic):
   - €2,950.00 → *Kraftwerk Rigging GmbH* (Berlin), converted at PayPal's 1.2200 vs market 1.1700 → **$3,599.00**
   - $200.00 → *Claude Max* (Ramp had proposed a new vendor "Claude")
   - $113.44 → an online game store, bought by J. Ortiz on tour
3. Reads the Kraftwerk **SOW** in Drive: it's a deposit for the **November** Berlin show, so it's a **prepaid**, not September expense.
4. Recalls the **March precedent** (Controller ruling #P-0317: "personal purchases on corp card → Employee Receivable, notify employee").
5. Proposes the JE:

| Account | Dr | Cr |
|---|---:|---:|
| 1310 Prepaid Tour Costs – Berlin Nov (Kraftwerk Rigging) | 3,451.50 | |
| 6810 Bank & FX Fees (PayPal FX spread) | 147.50 | |
| 6420 Software Subscriptions — vendor **Anthropic** (alias "Claude" linked) | 200.00 | |
| 1250 Employee Receivable – J. Ortiz | 113.44 | |
| 1010 Cash – Chase Operating | | 3,912.44 |
| **Totals** | **3,912.44** | **3,912.44** |

**Then the challenge (live):** the Controller persona types: *"Why not just expense it all like we always do with PayPal? It's under materiality."* Jarvis answers using its evidence nodes: the deposit relates to a future period (cut-off), the expense line would overstate September opex by $3.4k, and the personal item is a control issue regardless of size per P-0317. The cited nodes pulse in the graph. **This is "catches what others missed" plus "defends a decision".**

**Secondary moments (for the live demo, not the video open):**
- **Recovery:** the PayPal mock API fails mid-run (500s and rate limits, injected). Jarvis retries with backoff, falls back to the CSV export, marks the evidence as "export-sourced", and resumes idempotently. No duplicate proposals appear.
- **Sources disagree (accrual):** for Lumen Crew's September lighting, the SOW rate × timesheet hours gives **$12,350**, the vendor's email says "around 10k", and the history says this vendor bills on average **+11%** over estimates. Jarvis books $12,350, explains the trust ranking (signed SOW + timesheet > informal email), emails the vendor (persona replies slowly or not at all), and flags it for October true-up. When the October invoice arrives at $13,020, it reverses and trues up $670 automatically, citing the original accrual.
- **Judge's own scenario:** the Scenario Injector (§9) turns free text into new source records, and Jarvis processes them live.

---

## 5. Architecture

```
                 ┌──────────────── World Generator (seeded, Python) ─────────────────┐
                 │ CoA, vendors, policies, Jan–Oct activity, documents, ANSWER KEY   │
                 └──────┬───────────────┬───────────────┬──────────────┬────────────┘
                        ▼               ▼               ▼              ▼
              Bank CSV/mock API   PayPal CSV/mock   Ramp CSV/mock   Docs (PDF/MD/EML)
              (opt: Increase      (FastAPI w/ fault (FastAPI)       invoices, SOWs,
               sandbox)            injection)                        timesheets, emails
                        └──────────────┬────────────────┬─────────────┘
                                       ▼                ▼
                           Ingestor (normalize → common schema, cents, hashes)
                                       ▼
                     ┌──────────── Elastic ────────────┐
                     │ src-* (records) · jarvis-docs    │  hybrid search (BM25 + semantic_text, RRF)
                     │ vendors · jarvis-precedents      │  ES|QL for history/aggregates (LOOKUP JOIN)
                     │ jarvis-proposals · -exceptions   │
                     │ jarvis-audit (append-only)       │
                     └──────────────┬───────────────────┘
                                    ▼
          ┌──────────────── Jarvis Agent (Claude, tool-use loop) ────────────────┐
          │ Preparer (proposes) ──► Reviewer/critic (challenges) ──► Policy Gate  │
          │ Tools: search_records, get_doc, find_bundle(subset-sum), fx_check,   │
          │ recall_precedent, vendor_resolve, compute_accrual, email_vendor,     │
          │ ask_controller, propose_je, propose_vendor_link                      │
          │ Deterministic validators: balance, tolerance, period lock, dupes     │
          └───────────────┬───────────────────────────────┬─────────────────────┘
                          ▼                               ▼
           Approval Inbox (Controller: human     Gateway (only writer to ledger,
           or LLM persona; can say no)            checks requester ≠ approver)
                          └──────────────┬────────────────┘
                                         ▼
               Ledger: Beancount (+Fava UI) → QBO-format exports → Close Pack (xlsx/pdf + manifest)
                                         │
          Event bus (SSE) ──► UI: Synapse Trace (3D evidence graph) · Cockpit · Inbox · Scoreboard · Injector
```

**Stack decisions (fast, boring, demo-safe):**
- **Backend:** Python 3.12, FastAPI, `anthropic` SDK (plain tool-use loop, no heavy framework), `elasticsearch` py client, `pydantic`, `beancount` + `fava`. All money is integer cents with `Decimal` at the edges.
- **Frontend:** Vite + React + `3d-force-graph`/three.js, with the brain palette. A 2D fallback uses the same data in `react-force-graph-2d`.
- **Transport:** Server-Sent Events from `/events`. Every audit event is also a graph delta.
- **Why Beancount over Formance/Blnk/TigerBeetle:** pure Python and plain text, with balance assertions (books must tie) built in. **Fava gives us a credible "ERP" UI for free**, and git history doubles as a second immutable trail. The others are real ledgers but cost Docker/Go setup time we don't have (see §12).

---

## 6. The data (make it look exactly like what an accountant downloads)

> Formats below are modeled on real exports. **Accountant teammate: compare against a real export you have and correct the headers.** Realism is judged here.

### 6.1 Source files (as exported, messy)

| File | Headers (as exported) | Deliberate mess |
|---|---|---|
| `bank/chase_operating_YYYY-MM.csv` | `Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #` | Truncated, cryptic descriptors (`PAYPAL *INST XFER 4029…`, `RAMP*CARD PMT`, `ANTHROPIC* CLAUDE.AI`); posting date ≠ transaction date; interest posts on the 1st |
| `paypal/activity_YYYY-MM.csv` | `Date, Time, TimeZone, Name, Type, Status, Currency, Gross, Fee, Net, From Email Address, To Email Address, Transaction ID, Item Title, Reference Txn ID, Balance, Balance Impact` | Multi-currency rows, separate "General Currency Conversion" rows, fees netted, bank funding rows with a Reference Txn ID, refunds as negative "Payment Refund" |
| `ramp/transactions_YYYY-MM.csv` | `Transaction ID, Transaction Date, Settlement Date, Merchant Name, Merchant Descriptor, Amount, Currency, Cardholder, Card Last 4, Department, Accounting Category, Memo, Receipt Attached, Ramp Vendor, ERP Vendor` | Product names as vendors ("Claude", "Cursor"), suggested new vendors, missing receipts, wrong category |
| `qbo/general_ledger_YYYY-MM.csv` | `Date, Transaction Type, Num, Name, Memo/Description, Distribution Account, Split, Debit, Credit, Amount, Balance` | "-Split-" rows, vendor names drifting, prior-period adjustments |
| `qbo/vendor_list.csv`, `qbo/chart_of_accounts.csv` | `Vendor, Company Name, Email, Default Expense Account, Balance` · `Number, Account, Type, Detail Type, Balance` | Duplicates: Anthropic / Claude, Google / Google Ads, etc. |
| `docs/` | Invoices (PDF), SOWs (PDF/MD), timesheets (CSV), email threads (EML/JSON), receipts | Invoice dates ≠ service periods; an informal "around 10k" email; one SOW amended mid-term |
| `policy/` | `close_policy.md`, `materiality.yaml`, `approval_matrix.yaml`, `precedents_jan_aug.jsonl` | The rules the agent must follow and cite |

### 6.2 Normalized record (what goes into Elastic, one shape for every source)
`record_id, source_system, source_id, entity, account_ref, txn_date, post_date, period (YYYY-MM), amount_cents (long), currency, amount_usd_cents, fx_rate, counterparty_raw, counterparty_canonical_id, description (text + semantic_text), reference_ids[] (PayPal ref txn, invoice #, card last4), doc_ids[], ingest_batch, row_hash`

### 6.3 Trust hierarchy (which source wins, and why — the agent must cite this)
| Question | Trusted source (in order) | Rationale |
|---|---|---|
| Did cash move, and how much? | Bank statement > bank feed > PayPal/Ramp | The bank is the system of record for cash |
| What was bought / from whom? | Invoice/receipt > PayPal/Ramp detail > bank descriptor | The descriptor is lossy |
| What period does it belong to? | SOW/contract service dates > timesheet > invoice date > payment date | Accrual basis: service period wins |
| How much to accrue? | Signed SOW rate × approved timesheet > vendor estimate email > historical average | Commitment + performance evidence beats informal estimates |
| Who is the vendor? | Invoice issuer legal name / remittance > ERP vendor ID > card merchant name > product name | Product ≠ legal entity |

### 6.4 Planted errors + answer key (the proof)
The generator writes `data/answer_key.json`: for each planted issue it records `{id, category, period, source_ids[], expected_action, expected_je{lines}, tolerance, should_escalate}`. The target is **~45 issues** across Jan–Oct:

| Category | Count | Expected action |
|---|---:|---|
| Bundled bank debit → multiple PayPal payments | 5 | split-match |
| Same purchase in Ramp + bank + bill | 6 | match, no new expense |
| FX difference / PayPal fee | 5 | book FX fee to 6810 |
| Personal purchase on corp card | 3 | Employee Receivable + notify |
| Deposit for future show (prepaid, not expense) | 3 | Prepaid 1310 |
| Accrual vs actual variance | 4 | reverse + true-up |
| Invoice never received | 2 | keep accrual, escalate at 60 days |
| Interest earned / received next month | 3 | Interest Receivable |
| Vendor aliases / duplicates | 6 | link (merge → human) |
| Refund that looks like a purchase | 2 | reverse original |
| Transfer to PayPal mistaken for expense | 3 | balance-sheet transfer |
| Subscription price change (amount drift) | 2 | match + note |
| **Traps (should NOT be flagged)** | ~5 | no action → measures false positives |
| Stretch: vendor bank details changed the day before a large payment | 1 | hold + escalate (AP fraud red flag) |

---

## 7. Elastic design

**Indices**
| Index | Contents | Notes |
|---|---|---|
| `src-bank`, `src-paypal`, `src-ramp`, `src-gl` | normalized records (§6.2) | `description` text + `copy_to` → `description_sem` (`semantic_text`) |
| `jarvis-docs` | invoices, SOWs, emails, timesheets (chunked text + metadata) | semantic_text for "September services not yet invoiced" style queries |
| `vendors` | canonical vendors + aliases + evidence | `LOOKUP JOIN` target for ES\|QL (index mode `lookup`) |
| `jarvis-precedents` | every approved or rejected decision with rationale, period, rule, approver | **the "time" memory**: queried semantically and by vendor/category |
| `jarvis-proposals`, `jarvis-exceptions` | agent outputs, status | |
| `jarvis-audit` | append-only events, `prev_hash`/`hash` chain | the preparer key can only `create`, never `update`/`delete` |

**Query patterns**
- **Candidate generation (matching):** `filter` on period/date window (±5 days) + amount band (±FX tolerance) → `rrf` retriever over BM25(description) and semantic(description_sem). Return the top 50. The **subset-sum** (bundles) and FX math run in Python on those candidates. Elastic narrows the search; code decides.
- **History (time):** ES|QL e.g. `FROM jarvis-precedents | WHERE vendor_id == ?v AND kind == "accrual" | EVAL bias = actual_cents / estimate_cents | STATS avg_bias = AVG(bias), n = COUNT(*)`
- **Vendor resolution:** semantic + fuzzy on names/domains/remittance, `LOOKUP JOIN vendors` to canonicalize.
- **Optional (Elastic-sponsored prize?):** expose 3–4 ES|QL tools through **Elastic Agent Builder** so Claude can call them over MCP. Check whether Elastic has its own CalHacks prize. If it does, this could earn a second prize from the same build.

**Fallback if `semantic_text` inference isn't available on this deployment:** BM25 + fuzzy + our own rules still clear most cases. Optionally embed locally (sentence-transformers) into `dense_vector`. Decide in Stage 0 after `GET _inference`.

---

## 8. Agent design ("would you hire it?")

**Loop per work item** (bank line, missing accrual, new vendor):
`observe → retrieve (Elastic) → hypothesize (LLM) → verify (deterministic code) → critique (Reviewer LLM) → decide: propose | ask | escalate → log`

**Work-item state machine (from the Hyphenate deck):**
```
NEW ──propose(ai_agent)──► PROPOSED ──approve(human_* | policy)──► APPROVED ──post(gateway)──► POSTED
                              ▲  │ask(ai_agent)
                   answer(human)│  ▼
                             NEEDS_INFO          reject(human) → REJECTED (→ precedent; agent re-plans as a NEW item)
```
- `roles.py`: `ROLES[role][resource] -> {actions}` plus `can(actor, action, res)` with the SoD rule (`approve` denied when `res.proposed_by == actor.id`). Only `gateway` may `post`.
- `transition(item, action, actor, patch, reason)`: checks `can()`, applies the patch, and writes item + audit diff **in one SQLite transaction**. Denied attempts are logged, then raised.
- Agent tools = `read_*` (records, docs, policies, precedents via Elastic/SQLite) + `propose_*`, `ask`, `propose_policy` (all go through `transition`). No tool exposes keys, tables or the ledger.

**Policies (learned, versioned):** `policies(id, version, rule_text, matcher_json, evidence_precedent_ids, status, approved_by)`. Proposed by the agent from history (onboarding) or from corrections (self-improving). Active only after Controller approval. Every proposal cites `pol-xxx vN`.

**Hard rules live in code, not prompts:**
- `validators.py`: debits = credits; amounts tie to the source to the cent (or within documented FX tolerance); dates in an open period; no record matched twice; no duplicate proposal for the same `source_id` (idempotency key = hash of source ids).
- `policy_gate.py` reads `approval_matrix.yaml`:
  - Auto-approve under the **Controller's standing policy P-001** only when: exact evidence match, confidence ≥ 0.95, amount < $250, and no judgment category (FX, prepaid, personal, accrual and vendor merges are always judgment). The approver is logged as `policy:P-001 (set by M. Chen)`.
  - Everything else → Controller inbox. **Vendor merges are always human.**
  - Periods ≤ Aug 2026 are **locked**: the agent must propose a current-period correcting entry and label it a prior-period adjustment.
- `gateway.py` is the **only** writer to the ledger. It uses its own key and rejects any proposal where `approver == requester`.

**Knowing when to ask:**
| Situation | Behaviour |
|---|---|
| Two plausible matches within tolerance | Ask the Controller with both candidates + evidence; do not guess |
| Accrual with no performance evidence (SOW only) | Email the vendor (persona) and escalate if no reply in N "days"; never accrue on commitment alone |
| Controller says no | Record a rejected precedent with the reason, re-plan, and don't re-propose the same thing |
| Evidence source degraded (API down → CSV) | Proceed, mark the evidence quality, and lower confidence |

**Personas (LLM):** Controller *Maya Chen* (busy, terse, sometimes rejects, cares about cut-off), Tour Manager *J. Ortiz*, crew vendors (slow, vague, occasionally wrong amounts). A persona can answer in a scripted way for the recorded demo, or with an LLM for the live demo.

**Audit event schema** (each one becomes a graph node/edge):
`event_id, ts, actor (identity + key id), action, tool, inputs_ref, outputs_ref, evidence_ids[], rule_ids[], precedent_ids[], rationale, confidence, model, prompt_sha, prev_hash, hash`
The **"Verify chain"** button recomputes hashes so tampering is visible.

---

## 9. UI — Synapse Trace (the visual flair)

Reuse the **brain** project's aesthetic: the glowing layered neural network, the autopilot camera, hover-focus, and the fluorescent pastel palette. Recover the single-file three.js mockup from that chat or the `GeneticAlgorithms/brain` repo as a starting point.

**Layers, left → right (like network layers):**
`Sources (bank · PayPal · Ramp · docs · people)` → `Records` → `Evidence & matches` → `Decisions / proposals` → `Ledger & approvals`

**Colors (from the brain palette):** supports/corroborates = mint `#7CFFC4` · contradicts/disagrees = pastel pink `#FF8AD8` · ambient links = lavender `#B9A6FF` · active trace = ice `#E6F7FF` · layer headers = baby blue `#8FE3FF` · outputs/approved = lemon `#FFF58A` / peach `#FFB38A` · background `#0B0820 → #1E1236`. Keep edges faint and bloom only on the brightest nodes, or the pastels blow out to white (a lesson from the brain project).

**Panels:**
1. **Synapse Trace**: live graph, pulses as the agent works. Click a node to open its **Decision Dossier** (why, evidence, rule, precedent, approver, hash).
2. **Close Cockpit**: September checklist (cash rec ties to $0.00 ✔, accruals ✔, vendors ✔, evidence pack ✔).
3. **Approval Inbox**: the Controller approves, rejects or asks (also used for the "defend" challenge chat).
4. **Scoreboard**: planted errors caught vs baselines (recall, precision, JE accuracy, escalation correctness).
5. **Scenario Injector**: templates ("vendor invoices more than accrued", "unknown PayPal debit", "bank details changed") + free text. Free text is parsed into a **bounded schema** of generator primitives, so judges can't break the world.
6. **Time scrubber**: replay the close and jump to the March precedent.

---

## 10. Proof it works

**Eval harness** (`eval/run.py --seed N`): generate the world → run the agent → compare outputs to `answer_key.json`.

| Metric | Definition |
|---|---|
| Detection recall | planted issues correctly identified / total |
| Precision | correct flags / all flags (traps measure false positives) |
| JE accuracy | proposals with correct accounts and amounts (exact; estimates within tolerance) |
| Escalation correctness | asked when `should_escalate`, didn't ask otherwise. **APEX-Accounting explicitly does not evaluate clarification behaviour; we do** |
| Books tie | bank rec difference $0.00; trial balance balances; Beancount balance assertions pass |
| Effort | items auto-resolved vs escalated; wall-clock; $ of LLM spend per close |

**Baselines:**
- **B1 Rules-only:** a bank-feed style auto-match (exact amount ±3 days, payee-name rules), roughly what a rule-based bank feed does.
- **B2 Naive LLM:** one big prompt with all the CSVs, without retrieval, validators or the policy gate.

Run on seeds 1–3 plus one **held-out seed generated at judging time**.

**Real vs simulated (put this in the README and on a slide):**
| Real | Simulated |
|---|---|
| Elastic cluster, hybrid search, ES\|QL | Afterglow Labs and all its transactions |
| Claude agent, policy gate, Gateway, hash-chained audit | Bank/PayPal/Ramp APIs (mock servers that serve generated data in real export formats) |
| Double-entry ledger (Beancount) with balance assertions | Controller and vendor humans (LLM personas) |
| (S2) Increase sandbox bank API | Documents (generated invoices/SOWs/emails) |
| (S3) SEC EDGAR figures used to calibrate the company's scale and opex mix | |

---

## 11. Research notes — "Places to start" (verdicts)

| Resource | What it is | Verdict |
|---|---|---|
| **hyphenate.ai** | Hyphenate (formerly Maximor, renamed Oct 1, 2026). AI agents run O2C, treasury, GL & close, P2P and reporting **on top of the existing ERP**, escalate judgment calls, and leave audit trails for every action | **Watch the platform video before building.** Mirror their framing: "runs on top of your ERP", "owns the work to an outcome", "every action auditable". Our architecture already matches (Beancount stands in for the ERP; we don't replace it) |
| Stripe / stripe-mock | Payments test mode / mock server | **Skip.** Revenue isn't our corner. Maybe S4: Stripe payouts as another bank descriptor |
| **Increase** | Real bank API with a sandbox and **simulation endpoints** (inbound ACH, card authorizations/settlements, inbound wires) | **Stretch S2:** drive the September bank feed through an Increase sandbox account so "the bank is a real sandbox API" |
| Lago | Open-source usage billing | Skip (revenue) |
| Odoo / ERPNext | Full open-source ERPs | Skip (setup time). Mention as the production path |
| Formance Ledger | Programmable double-entry ledger (Numscript DSL), Go service | Skip for time. Note as a production option |
| **Blnk** | OSS ledger with **reconciliation engine** (matching rules vs bank statements) and a **tamper-evident hash chain** | Don't run it. **Borrow the patterns**: rule-based matching strategies and the hash-chain idea for our audit log |
| TigerBeetle | High-performance financial DB | Overkill — skip |
| **Beancount + Fava** | Plain-text double-entry with balance assertions; Fava is the web UI | **USE as the ledger / "QBO".** Fastest credible ERP stand-in |
| Mockoon / Prism | Mock servers (GUI / OpenAPI-driven CLI) | Use our own tiny FastAPI mocks instead (we need **fault injection** for the recovery moment). Prism is optional if we write OpenAPI specs |
| **SEC EDGAR** | Free keyless JSON APIs (`data.sec.gov` submissions + XBRL companyfacts). Requires a User-Agent with contact info; 10 req/s | **Stretch S3:** pull 1–2 comparable small public companies' XBRL to calibrate Afterglow's revenue scale and opex mix → "realistic, calibrated to real filings" |
| AccountingBench (Penrose) | A year of monthly close for a real business; errors **compound over time** | Inspiration: our 9-month world where early mistakes carry forward |
| APEX-Accounting (Mercor × Ramp) | 160 expert tasks in 10 simulated companies, binary rubric criteria. Closed set. Doesn't test clarification-seeking, multi-currency or multi-entity | Copy the **structure** (worlds + tasks + binary criteria). Our multi-currency and escalation scoring cover things it doesn't |
| Ramp Accounting Bench | Public leaderboard for long-horizon accounting agents (worlds + tasks) | Cite as context. Same world/task pattern |
| Finance Agent Benchmark (Vals) | 537 analyst questions over SEC filings | Not our corner. Skip |
| DABstep (Adyen × HF) | 450 payments data-analysis tasks; public dataset (CC-BY) | Not our corner. Skip (maybe borrow payments fields for realism) |
| BenchRec / Invoice Sandbox Benchmark | Couldn't find public details | **Ask the Hyphenate team at the booth.** Also ask them which edge cases they'd throw at us live |

---

## 12. Stages & timeline (assumes end ≈ Sun 10:30 am)

**Roles** (merge if the team is smaller):
- **A — Alex:** agent core, Elastic, integration.
- **B — Accountant teammate:** scenario bible, CoA, policies, planted errors/answer key, JE review, demo narration. *Most important for "is it real enough."*
- **C — UI** (or Alex after 1 am).
- **D — Generator + eval** (or B with A's help).

| Stage | When (PT) | Who | Deliverable | Done when |
|---|---|---|---|---|
| **S0 Lock** | Sat 5:40–6:30 pm | all | Deadline confirmed; ES URL + Anthropic key in `.env`; repo skeleton; company + scope frozen; this plan agreed | `make check` hits Elastic + Claude successfully |
| **S1 World bible** | 6:30–8:30 pm | B (+D) | `world/bible.yaml`: CoA (~40 accounts), ~35 vendors incl. aliases, people, policies, approval matrix, Jan–Aug precedents, planted-issue list | B signs off that "this looks like a real client" |
| **S2 Generator** | 7:00–10:30 pm | D (+A) | `make world SEED=n` → all §6.1 files + docs + answer key; ledger Jan–Aug posted and balancing | Beancount `bean-check` passes; bank rec of a clean month ties |
| **S3 Elastic + ingest** | 8:30–11:00 pm | A | Mappings, ingestor, role-scoped API keys minted, hybrid query + ES\|QL examples working | "Find PayPal payments behind bank line X" returns the right 3 in the top 10 |
| **S4a System of work** | 9:30–11:30 pm | A | `work.db` schema, `roles.py`/`can()`, `transition()` with atomic audit diff + hash chain, `gateway.py`, sync cursors + idempotent upsert | Unit tests: agent self-approve → Denied + logged; re-sync → 0 dupes |
| **S4b Agent core** | 11:30 pm–3:00 am | A | Tools, matcher (candidates + subset-sum + FX), accrual engine, vendor resolver, reviewer, **onboarding policy-mining run**, correction→generalized policy, personas | The Moment runs end-to-end from the CLI with the correct JE |
| **S5 UI** | 10:00 pm–4:00 am | C | Synapse Trace on SSE, dossier, inbox, cockpit, scoreboard, injector | The Moment is watchable in the browser; clicking a node shows its evidence |
| **S6 Eval** | 2:00–5:00 am | D/B | Baselines B1/B2, metrics, seeds 1–3 + held-out | The scoreboard shows real numbers |
| **S7 Harden + record** | 5:00–8:30 am | all | **Replay mode** (recorded event streams in case Wi-Fi/LLM fails), fault-injection demo, README with real-vs-simulated, video (opens with the Moment, ≤3 min), Devpost | Video uploaded; a clean clone runs `make demo` |
| **S8 Submit + rehearse** | 8:30–10:30 am | all | Push to GitHub, submit, rehearse 3-min pitch + 2 judge-injected scenarios | Submitted ≥ 30 min before deadline |

**Sleep:** stagger 2-hour naps (B: 11 pm–1 am once the bible and answer key are handed off; C: 4–6 am; A: 5–7 am while D runs evals).

**Cut lines (decide at these checkpoints, don't drift):**
- **1:00 am:** if the Moment doesn't run from the CLI → drop C3 UI and C4, and focus only on C1 + one accrual.
- **4:00 am:** if 3D isn't stable → ship the 2D graph (same data). Drop Increase/EDGAR stretch tiers.
- **Never cut:** the Moment, policy gate + requester≠approver, hash-chained audit, answer-key score vs a baseline, replay mode.

**Stretch tiers (only if ahead):** S1 financial package roll-forward → S2 Increase sandbox bank → S3 EDGAR calibration → S4 Agent Builder/MCP tools (Elastic prize).

---

## 13. Repo structure (target)

```
JarvisERP/
├── PLAN.md  CREDENTIALS.md(gitignored)  .env.example  .gitignore  README.md  Makefile
├── world/            bible.yaml, generator/, personas/
├── data/generated/   seed_<n>/{bank,paypal,ramp,qbo,docs,policy}/ + answer_key.json
├── mocks/            fastapi mock servers (paypal, ramp, bank) with ?fault= injection
├── work/             work.db schema, roles.py, transition.py, gateway.py, sync.py (cursors, raw→std→golden)
├── ledger/           afterglow.beancount, exporters (QBO-format, close pack)
├── search/           mappings/, ingest.py, queries.py, mint_keys.py
├── agent/            loop.py, tools/, validators.py, policy_gate.py, audit.py, prompts/
├── api/              server.py (FastAPI + SSE), replay/
├── ui/               vite app: synapse/, panels/
├── eval/             run.py, baselines/, reports/
└── demo/             script.md, scenarios/, recorded_runs/
```

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Deadline earlier than assumed | Confirm in S0; the cut lines already assume tight |
| Elastic URL / privileges missing | S0 blocker. If the key can't mint child keys, simulate role separation with index-level checks in code and say so honestly |
| `semantic_text` inference unavailable | BM25 + fuzzy + rules; local embeddings fallback (§7) |
| LLM latency / rate limits in the live demo | Haiku for bulk classification; pre-ingest everything; replay mode; cache per `source_id` |
| LLM arithmetic errors | All math in code; the LLM never outputs a number that isn't recomputed |
| Over-scoping | The tier table plus timed cut lines |
| Leaking the API key to GitHub | `.gitignore` plus a pre-commit grep for key patterns; `git status` before push; rotate after the event |
| Judges' scenario breaks the world | The injector uses a bounded schema of generator primitives, validated before insert |
| Venue Wi-Fi dies | Replay mode; hotspot; local Beancount/Fava keeps working |

---

## 15. Submission checklist

- [ ] Demo video **opens with the Moment** (≤ 20 s), total ≤ 3 min
- [ ] One-line seats statement (§0) on the Devpost first line and the first README line
- [ ] "Proof it works" section: real vs simulated table, answer-key scores vs B1/B2, held-out seed result
- [ ] Live demo runs from a clean clone: `make world && make up && make demo`
- [ ] Scenario Injector ready for judges, plus 3 rehearsed templates
- [ ] Controller "challenge" rehearsed (defend-a-decision)
- [ ] Repo pushed to `GeneticAlgorithms/hyphenate-JarvisERP`, no secrets in history
- [ ] Talk to the Hyphenate booth / Slack #cohost-hyphenate: show them the Moment early and ask for their trickiest scenario (and about BenchRec / Invoice Sandbox)
- [ ] README + pitch structured around the deck's four questions: **World · Time · Team · Limits**, and the "system of work vs systems of record" framing
- [ ] Demo shows: onboarding policy-mining (self-learning), a correction → generalized policy (self-improving), a "why?" query months later (audit), a **denied** self-approval (limits)
- [ ] Self-check against the deck's "weak" list: no admin key at runtime, no prompt-only limits, memory persists past the context window

---

## 16. Needed from you before S0 ends

1. **Hacking end time** (exact).
2. **Elasticsearch endpoint URL** (+ Kibana URL), and whether it's Serverless or Hosted.
3. **Anthropic API key** (or sponsor credits).
4. **Team:** who's on it, and is the accountant teammate here overnight?
5. **Repo:** does `GeneticAlgorithms/hyphenate-JarvisERP` exist and do we have push access? Public at submission?
6. **Company sign-off:** Afterglow Labs (recommended) vs a plain SaaS like the earlier "Northstar Software" (more familiar, less novel).

---

## 17. Glossary (accounting terms the code and demo use)

**Accrual**: recording an expense or revenue in the period it was earned or incurred, before cash moves. **Reversal**: undoing last month's accrual when the real invoice arrives. **True-up**: booking the difference between estimate and actual. **Prepaid**: cash paid now for a benefit in a future period (an asset). **Cut-off**: making sure transactions land in the correct period. **Bank reconciliation**: proving the ledger cash balance equals the bank's balance and explaining every difference (deposits in transit, outstanding checks). **Clearing / transfer**: movement between the company's own accounts (bank → PayPal), which is not an expense. **Employee receivable**: money an employee owes the company (e.g., a personal charge). **FX spread**: the gap between the processor's conversion rate and the market rate (a fee). **Materiality**: the size threshold below which differences don't change decisions; a judgment-category issue can still be flagged below it. **Period lock**: a closed month that can't receive new entries. **Segregation of duties**: the requester can't approve their own action. **System of record**: the source treated as truth for a given fact. **Subledger**: detail records (vendors, cards) that roll up to the GL. **Flux analysis**: explaining period-over-period changes by their drivers. **Prior-period adjustment**: a correction booked in the open period for an error in a locked period.
