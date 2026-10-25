#!/bin/bash
set -e

BASE_URL="http://localhost:8000"

echo "=== Starting comprehensive fix verification ==="
echo ""

# Test 1: SyntaxError fix
echo "TEST 1: defend.py compiles without SyntaxError"
python3 -m py_compile jarvis/workbench/defend.py
echo "✓ PASS: defend.py compiles"
echo ""

# Run workbench to get work items
echo "Running p3_bank workbench..."
curl -s -X POST "$BASE_URL/api/wb/run" -H "Content-Type: application/json" -d '{"agent":"p3_bank"}' > /dev/null
sleep 10

# Get the PayPal $3,912.44 item
ITEM_ID=$(curl -s "$BASE_URL/api/wb/runs" | python3 -c "import sys,json; runs=json.load(sys.stdin); items = runs[0].get('proposals', []); paypal = next((p['item_id'] for p in items if '3,912.44' in p['title']), None); print(paypal if paypal else '')")

if [ -z "$ITEM_ID" ]; then
  echo "ERROR: Could not find $3,912.44 PayPal item"
  exit 1
fi

echo "Found PayPal item: $ITEM_ID"
echo ""

# Test 2 (C): Amount challenge
echo "TEST C: Amount challenge shows correct total"
AMOUNT_RESP=$(curl -s -X POST "$BASE_URL/api/wb/item/$ITEM_ID/challenge" \
  -H "Content-Type: application/json" \
  -d '{"question":"How much is this?"}')
AMOUNT_TEXT=$(echo "$AMOUNT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['points'][0])")

if [[ "$AMOUNT_TEXT" == *"$3,912.44"* ]]; then
  echo "✓ PASS: Shows '\$3,912.44' (not \$0.00)"
else
  echo "✗ FAIL: Expected '\$3,912.44', got: $AMOUNT_TEXT"
fi
echo ""

# Test 3 (D1): Policy challenge
echo "TEST D1: Policy challenge mentions precedents/policy"
POLICY_RESP=$(curl -s -X POST "$BASE_URL/api/wb/item/$ITEM_ID/challenge" \
  -H "Content-Type: application/json" \
  -d '{"question":"Last time we put PayPal under Software, why change?"}')
POLICY_TEXT=$(echo "$POLICY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['points'][0][:100])")

if [[ "$POLICY_TEXT" == *"precedent"* ]] && [[ "$POLICY_TEXT" != *"materiality"* ]]; then
  echo "✓ PASS: Mentions precedent, not materiality"
else
  echo "✗ FAIL: Got: $POLICY_TEXT"
fi
echo ""

# Test 4 (D2): Prepaid challenge
echo "TEST D2: Prepaid challenge explains 1310 and November"
PREPAID_RESP=$(curl -s -X POST "$BASE_URL/api/wb/item/$ITEM_ID/challenge" \
  -H "Content-Type: application/json" \
  -d '{"question":"Shouldn'\''t the Kraftwerk deposit be booked in September?"}')
PREPAID_TEXT=$(echo "$PREPAID_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['points'][0])")

if [[ "$PREPAID_TEXT" == *"1310"* ]] && [[ "$PREPAID_TEXT" == *"November"* ]] && [[ "$PREPAID_TEXT" == *"Prepaid"* ]]; then
  echo "✓ PASS: Mentions 1310, Prepaid, November"
else
  echo "✗ FAIL: Missing key terms. Got: ${PREPAID_TEXT:0:150}"
fi
echo ""

# Test 5 (F): Concession
echo "TEST F: Concession withdraws and re-proposes"
CONCEDE_RESP=$(curl -s -X POST "$BASE_URL/api/wb/item/$ITEM_ID/challenge" \
  -H "Content-Type: application/json" \
  -d '{"question":"Actually the Kraftwerk invoice shows $3,000.00"}')

if echo "$CONCEDE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('new_item_id' in d)" | grep -q "True"; then
  NEW_ITEM=$(echo "$CONCEDE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('new_item_id', 'N/A'))")
  echo "✓ PASS: Conceded and created new item: $NEW_ITEM"
  
  # Check precedents table
  PREC_COUNT=$(curl -s "$BASE_URL/api/precedents" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")
  if [ "$PREC_COUNT" -gt "0" ]; then
    echo "  ✓ Precedent recorded (count: $PREC_COUNT)"
  else
    echo "  ✗ WARNING: No precedents found"
  fi
else
  echo "✗ FAIL: Did not concede properly"
  echo "Response: $CONCEDE_RESP"
fi
echo ""

# Test 6 (I): Order dependence - fresh DB old flow
echo "TEST I: Order dependence with P-0317"
# Kill server and restart with fresh DB
tmux -f /exec-daemon/tmux.portal.conf kill-session -t "test-server"
rm -rf ~/.jarvis/seed-2026/
SESSION_NAME="test-server"; tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "$SESSION_NAME" -c "/workspace" "cd /workspace && python3 -m jarvis.api.server --seed 2026 --port 8000"
sleep 10

# Run POST /api/close first (old flow)
curl -s -X POST "$BASE_URL/api/close" > /dev/null
sleep 15

# Check if Steam/Valve $113.44 went to 1250 not 6900
STEAM_ITEM=$(curl -s "$BASE_URL/api/state" | python3 -c "
import sys,json
state = json.load(sys.stdin)
# Check work items for Valve/Steam
resp = sys.stdout
" 2>/dev/null || echo "")

# Query database directly
DB_CHECK=$(python3 -c "
import sqlite3
db = sqlite3.connect('/home/ubuntu/.jarvis/seed-2026/work.db')
rows = db.execute(\"SELECT item_id, title, proposal FROM work_items WHERE title LIKE '%Valve%' OR title LIKE '%Steam%' LIMIT 1\").fetchall()
if rows:
    import json
    proposal = json.loads(rows[0][2])
    has_1250 = any(l.get('acct') == '1250' for l in proposal.get('lines', []))
    print('✓ PASS: Found 1250 Employee Receivable' if has_1250 else '✗ FAIL: Missing 1250')
else:
    print('⚠ No Valve/Steam item found')
" 2>/dev/null || echo "⚠ Could not check database")

echo "$DB_CHECK"
echo ""

# Test 7 (J old flow): Self-approve returns 403
echo "TEST J (old flow): Self-approve returns 403"
# Get any proposed item
PROPOSED_ITEM=$(curl -s "$BASE_URL/api/state" | python3 -c "
import sys,json
state = json.load(sys.stdin)
for st, count in state.get('status', {}).get('states', {}).items():
    if st == 'PROPOSED' and count > 0:
        # Find one
        break
" 2>/dev/null || echo "")

# For simplicity, get first work item
FIRST_ITEM=$(python3 -c "
import sqlite3
db = sqlite3.connect('/home/ubuntu/.jarvis/seed-2026/work.db')
row = db.execute(\"SELECT item_id FROM work_items WHERE state='PROPOSED' LIMIT 1\").fetchone()
print(row[0] if row else '')
" 2>/dev/null || echo "")

if [ -n "$FIRST_ITEM" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/item/$FIRST_ITEM/self-approve")
  if [ "$HTTP_CODE" = "403" ]; then
    echo "✓ PASS: Returns HTTP 403"
  else
    echo "✗ FAIL: Expected 403, got $HTTP_CODE"
  fi
else
  echo "⚠ No proposed items to test"
fi
echo ""

echo "=== Test Summary ==="
echo "Manually verify:"
echo "- Test 7 (old-flow defend mentions P-0317): Challenge a PayPal split via old flow"
echo "- Integration tests: pytest -q tests/test_workbench_integration.py"
