# README Corrections Applied (Commit 17f42f9)

All corrections from REMAINING_FIXES_STATUS.md have been applied. The architecture diagram and key terms + connection explanations remain unchanged.

## Corrected Values:

### Materiality Threshold:
- ❌ Was: "$50,000"
- ✅ Now: "$500 (50000 cents)"

### Opex Overstatement Amount:
- ❌ Was: "$3,564.94"
- ✅ Now: "$3,451.50 (the prepaid Kraftwerk deposit)"

### Work Item States:
- ❌ Was: "WITHDRAWN (agent conceded during challenge/defense and is re-proposing)"
- ✅ Now: "DISMISSED (agent withdrew it or conceded during challenge/defense)"

## Corrected Table Names (Actual DB Schema):

### Raw Data:
- ❌ Was: `chase_raw`, `paypal_raw`, `ramp_raw`, `qbo_feed`
- ✅ Now: `raw_rows` (with source), `records` (standardized)

### Ledger:
- ❌ Was: `gl_entries`
- ✅ Now: `ledger_entries` (header), `ledger_lines` (each debit/credit)

### Core Tables (Unchanged, Confirmed):
- ✅ `work_items`
- ✅ `precedents`
- ✅ `audit_log`
- ✅ `policies`
- ✅ `vendors`
- ✅ `bills`

## Corrected Function Names:

### Bible/Config:
- ❌ Was: `bible.POLICIES`, `bible.CHART_OF_ACCOUNTS`
- ✅ Now: `bible.COA`, `bible.APPROVAL_MATRIX` (policies are in `policies` table, queried via `active_policy()`)

### Ledger Functions:
- ❌ Was: `get_balance()`, `get_gl_detail()`, `get_vendor_master()`, `export_qbo_gl()`, `export_beancount()`
- ✅ Now: `balances()`, `trial_balance()`, `write_beancount()` (vendors via context queries to `vendors` table)

### Gateway:
- ❌ Was: `post_entry(db, item_id)`
- ✅ Now: `post(db, item_id)` (called internally, not via HTTP)

### Policy Management:
- ❌ Was: `learn_precedents()`, `add_precedent(db, correction)`, writes to `bible.POLICIES`
- ✅ Now: Precedents inserted directly to `precedents` table; policies counted and proposed via `jarvis/agent/policies.py`

### Search/Evidence:
- ❌ Was: `search_evidence(query, role)`
- ✅ Now: Context methods via `jarvis/agent/context.py` (not a single standalone function)

## Corrected Class Names:

- ❌ Was: `WorkbenchRunner`
- ✅ Now: `Run` (in `jarvis/workbench/core.py`)

## Corrected Routes:

### Non-existent routes removed:
- ❌ `/api/item/{id}/post` (gateway posts internally, not via HTTP)
- ❌ `/api/audit/verify` (now `/api/verify`)

### Corrected route descriptions:
- Challenge route: Both `/api/wb/item/{id}/challenge` (workbench, uses `jarvis/workbench/defend.py`) and `/api/item/{id}/challenge` (old flow, uses `jarvis/agent/defend.py`)
- Self-approve: Logs to `audit_log` with `allowed=0`, returns HTTP 403

## LLM Model Selection Improvements:

### Env Var Overrides Added:
- `JARVIS_MODEL_REASONING` - overrides model selection for reasoning tasks
- `JARVIS_MODEL_FAST` - overrides model selection for fast tasks

### Verified Working Models Noted:
- `claude-sonnet-4-5` ✅
- `claude-haiku-4-5` ✅

### Improved Selection Logic:
- Handles multiple naming schemes: `claude-sonnet-4-5`, `claude-sonnet-5-5`, `claude-3-5-sonnet-YYYYMMDD`
- Sorts by version (5-5 > 4-5 > 3-5), then date
- Env vars override API discovery
- Falls back gracefully on errors

## Architecture Documentation Unchanged:

The following sections remain as designed:
- ✅ System architecture Mermaid diagram
- ✅ Key terms (5-layer glossary)
- ✅ How the pieces connect (18 arrows with implementations)
- ✅ Concrete examples ($350 Zelle, $113.44 P-0317, self-approve 403)

All file paths, table names, function names, and routes now reference actual code that exists in the repository.
