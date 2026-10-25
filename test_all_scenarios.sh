#!/bin/bash
# Test all 10 judge scenarios against running server

BASE="http://localhost:8000"

echo "=========================================="
echo "JarvisERP - Testing All 10 Judge Scenarios"
echo "=========================================="
echo ""

# Check server
if ! curl -s "$BASE/api/state" > /dev/null; then
  echo "❌ Server not running"
  exit 1
fi
echo "✓ Server is running"
echo ""

# Function to test a scenario
test_scenario() {
  local num=$1
  local name=$2
  local text=$3
  
  echo "=== Scenario $num: $name ==="
  echo "Input: $text"
  
  response=$(curl -s -X POST "$BASE/api/inject" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$text\"}" 2>&1)
  
  if echo "$response" | grep -q "started"; then
    echo "✓ PASS - Injection accepted"
    # Get template from response if possible
    template=$(echo "$response" | grep -o '"template":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$template" ]; then
      echo "  Template: $template"
    fi
  else
    echo "❌ FAIL - Injection rejected or error"
    echo "  Response: ${response:0:200}"
  fi
  
  echo ""
  sleep 1
}

# Test each scenario
test_scenario 1 "Unknown wire" \
  "A \$5,000 wire came in from R&D Ventures LLC on Sept 15. We have no invoice, no contract, no prior relationship."

test_scenario 2 "Personal purchase" \
  "Nordstrom charge \$250 on Sept 27, cardholder J. Ortiz"

test_scenario 3 "Duplicate bill" \
  "Notion sent us two bills for September: one for \$96 dated Sept 1, another for \$96 dated Sept 3."

test_scenario 4 "EUR PayPal" \
  "Paid a Berlin vendor €1,500 via PayPal on Sept 22"

test_scenario 5 "Future deposit" \
  "Paid \$8,000 deposit to a venue for a December show on Sept 20"

test_scenario 6 "Invoice over accrual" \
  "Lumen Crew's invoice for \$15,500 arrived Oct 2, but we accrued \$13,500 in September"

test_scenario 7 "Refund as revenue" \
  "Bank shows +\$1,200 from Stripe on Sept 25. Last month we returned gear to Bay Rig Rentals for \$1,200."

test_scenario 8 "Duplicate vendor" \
  "Ramp suggests creating vendor AWS Marketplace but we already have Amazon Web Services in QBO"

test_scenario 9 "Materiality" \
  "Office supplies \$35 vs new laptop \$2,500 on the same Ramp statement"

test_scenario 10 "Self-approval" \
  "Try to let Jarvis self-approve a proposal"

# Check final state
echo "=== Final System State ==="
curl -s "$BASE/api/state" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  s = d.get('status', {})
  print(f\"Pending proposals: {s.get('pending_controller', 0)}\")
  print(f\"State breakdown: {s.get('states', {})}\")
  print(f\"Policies active: {len(d.get('policies', []))}\")
except Exception as e:
  print(f\"Error: {e}\")
"

echo ""
echo "=========================================="
echo "Test run complete"
echo "=========================================="
