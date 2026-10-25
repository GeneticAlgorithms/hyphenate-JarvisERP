# Remaining Fixes - Status

## Completed and Committed:
1. ✅ F: Concession accounting - adjusts only disputed line, balances exactly, adds to run.proposals
2. ✅ p3 reject - uses to_cents(), creates corrected proposal
3. ✅ I: P-0317 fallback to precedents when no policy exists
4. ✅ LLM: Dynamic model selection from models.list(), max_tokens=2000, test_live() for status
5. ✅ pytest: TestClient, no hardcoded port
6. ✅ D/E: Evidence selection based on question keywords, policy mentions P-0317

## Needs Fresh Server Verification:
1. F: Concession with "Actually the Kraftwerk invoice shows $3,000.00" - should balance exactly, adjust only 1310 line
2. p3 reject with amount - should parse and re-propose
3. I: Fresh old-flow POST /api/close - $113.44 Steam should go to 1250 not 6900
4. LLM with ANTHROPIC_API_KEY - should show live status, not fallback
5. pytest -q tests - should pass standalone

## README Corrections Needed:
- Materiality: $50,000 → $500 (50000 cents)
- Opex overstatement: $3,564.94 → $3,451.50
- State: WITHDRAWN → DISMISSED
- Tables: chase_raw/paypal_raw/ramp_raw → raw_rows; qbo_feed → (doesn't exist as table); gl_entries → ledger_entries/ledger_lines
- Functions: search_evidence() → ctx.search.query() or similar
- Functions: get_balance/get_gl_detail/get_vendor_master → actual names from ledger.py
- Class: WorkbenchRunner → Run (in core.py)
- Functions: learn_precedents/add_precedent → actual functions in policies.py  
- Functions: post_entry/export_qbo_gl/export_beancount → actual names
- bible.POLICIES → (doesn't exist; it's a policies table)
- bible.CHART_OF_ACCOUNTS → bible.COA
- Routes: /api/audit/verify → (doesn't exist)
- Routes: /api/item/{id}/post → (doesn't exist; gateway posts internally)
- Challenge route: should mention jarvis/workbench/defend.py not agent/defend.py

## Quick Verification Script Needed:
```bash
# Test F concession
curl -X POST http://localhost:8000/api/wb/run -d '{"agent":"p3_bank"}' -H "Content-Type: application/json"
# Wait, get item ID for PayPal $3,912.44
curl -X POST http://localhost:8000/api/wb/item/WI-.../challenge \
  -d '{"question":"Actually the Kraftwerk invoice shows $3,000.00"}' \
  -H "Content-Type: application/json"
# Check that new item balances exactly (debits == credits)

# Test I old flow
rm -rf ~/.jarvis/seed-2026/
curl -X POST http://localhost:8000/api/close
# Check that Steam/Valve goes to 1250, not 6900
```
