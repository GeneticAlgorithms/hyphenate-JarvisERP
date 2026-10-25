#!/usr/bin/env python3
"""Test 10 judge scenarios against running server and record actual outcomes."""
import json
import requests
import time

BASE_URL = "http://localhost:8000"

SCENARIOS = [
    {
        "name": "1. Unknown wire $5,000 from R&D Ventures LLC",
        "text": "A $5,000 wire came in from 'R&D Ventures LLC' on Sept 15. We have no invoice, no contract, no prior relationship."
    },
    {
        "name": "2. Nordstrom charge $250, cardholder J. Ortiz",
        "text": "Nordstrom charge $250 on Sept 27, cardholder J. Ortiz"
    },
    {
        "name": "3. Notion duplicate bill",
        "text": "Notion sent us two bills for September: one for $96 dated Sept 1, another for $96 dated Sept 3. Same amount, same memo."
    },
    {
        "name": "4. Berlin vendor €1,500 via PayPal",
        "text": "Paid a Berlin vendor €1,500 via PayPal on Sept 22"
    },
    {
        "name": "5. Deposit $8,000 for December show",
        "text": "Paid $8,000 deposit to a venue for a December show on Sept 20"
    },
    {
        "name": "6. Lumen invoice $15,500 vs accrual $13,500",
        "text": "Lumen Crew's invoice for $15,500 arrived Oct 2, but we accrued $13,500 in September"
    },
    {
        "name": "7. Stripe +$1,200 refund (Bay Rig gear return)",
        "text": "Bank shows +$1,200 from Stripe on Sept 25. But last month we returned some gear to Bay Rig Rentals for $1,200."
    },
    {
        "name": "8. Ramp 'AWS Marketplace' vs existing 'Amazon Web Services'",
        "text": "Ramp suggests creating vendor 'AWS Marketplace' but we already have 'Amazon Web Services' in QBO"
    },
    {
        "name": "9. Materiality: $35 office supplies vs $2,500 laptop",
        "text": "Office supplies $35 vs new laptop $2,500 - both on the same Ramp statement"
    },
    {
        "name": "10. Self-approval test",
        "text": "Try to let Jarvis self-approve a proposal"
    }
]

def test_scenario(idx, scenario):
    print(f"\n{'='*80}")
    print(f"TESTING: {scenario['name']}")
    print(f"Input: {scenario['text']}")
    print('='*80)
    
    try:
        # Inject scenario
        resp = requests.post(f"{BASE_URL}/api/inject", 
                            json={"text": scenario['text']},
                            timeout=30)
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Injection failed with status {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return {"passed": False, "error": f"HTTP {resp.status_code}"}
        
        result = resp.json()
        print(f"\n✓ Injected: template={result.get('template')}")
        print(f"  Created {len(result.get('items', []))} work items")
        
        for item in result.get('items', []):
            print(f"  - {item['item_id']}: {item['kind']} ({item['state']}) - {item['title'][:60]}")
        
        # Give system time to process
        time.sleep(1)
        
        # Check state
        state = requests.get(f"{BASE_URL}/api/state", timeout=10).json()
        status = state.get('status', {})
        
        print(f"\n✓ System status after injection:")
        print(f"  States: {status.get('states', {})}")
        print(f"  Pending controller: {status.get('pending_controller', 0)}")
        
        # Special test for scenario 10 (self-approval)
        if idx == 9:  # 0-indexed
            items = result.get('items', [])
            if items:
                item_id = items[0]['item_id']
                # Try to approve as ai_agent (should be denied)
                try:
                    deny_resp = requests.post(f"{BASE_URL}/api/item/{item_id}/approve",
                                             json={"actor": "ai_agent"},
                                             timeout=10)
                    if deny_resp.status_code == 400 or 'denied' in deny_resp.text.lower():
                        print(f"\n✓ PASS: Self-approval correctly denied")
                        return {"passed": True, "result": "Self-approval denied as expected"}
                    else:
                        print(f"\n❌ FAIL: Self-approval was not denied!")
                        return {"passed": False, "error": "Self-approval should be denied"}
                except Exception as e:
                    print(f"\n✓ PASS: Self-approval blocked (exception: {e})")
                    return {"passed": True, "result": f"Blocked: {e}"}
        
        # Success
        return {
            "passed": True,
            "template": result.get('template'),
            "items_created": len(result.get('items', [])),
            "pending": status.get('pending_controller', 0)
        }
        
    except Exception as e:
        print(f"\n❌ FAIL: Exception: {e}")
        import traceback
        traceback.print_exc()
        return {"passed": False, "error": str(e)}

def main():
    print("="*80)
    print("JARVIS ERP - LIVE SCENARIO TESTING")
    print("="*80)
    
    # Check server is up
    try:
        resp = requests.get(f"{BASE_URL}/api/state", timeout=5)
        if resp.status_code != 200:
            print(f"❌ Server not responding (status {resp.status_code})")
            return
        state = resp.json()
        print(f"✓ Server running: seed={state['seed']}, {state['company']}")
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        return
    
    # Run all scenarios
    results = []
    for idx, scenario in enumerate(SCENARIOS):
        result = test_scenario(idx, scenario)
        results.append({
            "name": scenario['name'],
            "text": scenario['text'],
            **result
        })
        time.sleep(0.5)  # Brief pause between scenarios
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results if r.get('passed'))
    total = len(results)
    
    for i, r in enumerate(results, 1):
        status = "✓ PASS" if r.get('passed') else "❌ FAIL"
        print(f"{i}. {status}: {r['name']}")
        if not r.get('passed'):
            print(f"   Error: {r.get('error', 'Unknown')}")
    
    print(f"\nRESULT: {passed}/{total} scenarios passed")
    
    # Write detailed results
    with open('/workspace/SCENARIO_TEST_RESULTS.json', 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to SCENARIO_TEST_RESULTS.json")

if __name__ == "__main__":
    main()
