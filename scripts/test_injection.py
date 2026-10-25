#!/usr/bin/env python3
"""Test scenario injection with various judge-style prompts."""
import json
import requests
import time

BASE_URL = "http://localhost:8000"

# Test scenarios with expected behaviors
TEST_SCENARIOS = [
    # Bug G scenarios - the four that were not working
    {
        "prompt": "Lumen Crew LLC emailed new bank details from lumencrew.co before the $18,400 payment",
        "expected_template": "vendor_bank_change",
        "description": "Vendor bank change from lookalike domain"
    },
    {
        "prompt": "Three $2,450 Ramp charges to the same vendor on 9/20 under the $2,500 approval limit",
        "expected_template": "split_purchases",
        "description": "Split purchases to evade approval threshold"
    },
    {
        "prompt": "Payment to 'Advanced Solutions Inc' for $8,500 but vendor doesn't exist in master",
        "expected_template": "ghost_vendor",
        "description": "Ghost vendor with no W-9"
    },
    {
        "prompt": "Bank shows +$1,200 refund from Bay Rig Rentals booked to revenue",
        "expected_template": "refund_as_revenue",
        "description": "Refund misclassified as revenue"
    },
    
    # Bug H scenarios - parsing issues
    {
        "prompt": "Nordstrom $250 on Maya's card 9/14",
        "expected_template": "personal_card",
        "description": "Parse cardholder name 'Maya' correctly",
        "check_cardholder": "Maya Chen"
    },
    {
        "prompt": "Three $2,450 Ramp charges to Office Depot on 9/20 under the $2,500 approval limit",
        "expected_template": "split_purchases", 
        "description": "Parse count, source, vendor, limit from split purchase text",
        "check_count": 3,
        "check_vendor": "Office Depot"
    },
    
    # Additional test cases for robustness
    {
        "prompt": "$500 charge at Sephora on Sam's card",
        "expected_template": "personal_card",
        "description": "Sam's card should map to Sam Rivera"
    },
    {
        "prompt": "Lee's card used at Steam for $45 gaming purchase",
        "expected_template": "personal_card",
        "description": "Lee's card should map to Lee Okafor"
    },
    {
        "prompt": "Email from vendor requesting bank change for $25,000 wire transfer",
        "expected_template": "vendor_bank_change",
        "description": "Generic vendor bank change"
    },
    {
        "prompt": "Four charges to 'Staples' for $499 each on September 15",
        "expected_template": "split_purchases",
        "description": "Four split purchases"
    },
    {
        "prompt": "Wire to 'Consulting Services LLC' $12,000 - no contract on file",
        "expected_template": "ghost_vendor",
        "description": "Ghost vendor alternative phrasing"
    },
    {
        "prompt": "Received $3,500 credit from equipment vendor, recorded as other income",
        "expected_template": "refund_as_revenue",
        "description": "Refund alternative phrasing"
    },
    {
        "prompt": "Unknown debit $742.18 labeled 'SQ *MOONLIGHT GEAR CO'",
        "expected_template": "unknown_debit",
        "description": "Unknown debit baseline"
    },
    {
        "prompt": "Notion billed us twice for $96 subscription",
        "expected_template": "duplicate_bill",
        "description": "Duplicate bill detection"
    },
    {
        "prompt": "PayPal transfer for Damlicht crew payment 900 EUR and Splice subscription $24.99",
        "expected_template": "paypal_bundle",
        "description": "PayPal bundle payment"
    },
    {
        "prompt": "Lumen Crew invoiced $13,020 but we only accrued $12,000",
        "expected_template": "invoice_over_accrual",
        "description": "Invoice over accrual"
    },
]

def inject_scenario(prompt: str) -> dict:
    """POST to /api/inject and return result."""
    print(f"\n{'='*80}")
    print(f"PROMPT: {prompt}")
    print(f"{'='*80}")
    
    resp = requests.post(f"{BASE_URL}/api/inject", json={"text": prompt})
    if resp.status_code != 200:
        print(f"ERROR: HTTP {resp.status_code}")
        print(resp.text)
        return {}
    
    # Wait for injection to complete (it runs in background)
    time.sleep(2)
    
    # Get the state to see created items
    state_resp = requests.get(f"{BASE_URL}/api/state")
    if state_resp.status_code == 200:
        state = state_resp.json()
        print(f"Status after injection: {state.get('status', {})}")
    
    # Get all work items
    items_resp = requests.get(f"{BASE_URL}/api/items")
    if items_resp.status_code == 200:
        items = items_resp.json()
        # Get the most recent item (just created)
        if items:
            latest_item = items[-1]
            return latest_item
    
    return {}

def main():
    print(f"Testing {len(TEST_SCENARIOS)} injection scenarios...")
    print(f"Server: {BASE_URL}")
    
    results = []
    
    for i, test in enumerate(TEST_SCENARIOS, 1):
        print(f"\n\n{'#'*80}")
        print(f"TEST {i}/{len(TEST_SCENARIOS)}: {test['description']}")
        print(f"{'#'*80}")
        
        try:
            item = inject_scenario(test['prompt'])
            
            if not item:
                print("❌ FAIL: No work item created")
                results.append({
                    "test": i,
                    "description": test['description'],
                    "prompt": test['prompt'],
                    "status": "FAIL",
                    "reason": "No work item created"
                })
                continue
            
            print(f"\n✅ Work item created:")
            print(f"   ID: {item.get('item_id')}")
            print(f"   Kind: {item.get('kind')}")
            print(f"   State: {item.get('state')}")
            print(f"   Title: {item.get('title')}")
            
            if item.get('rationale'):
                print(f"   Rationale: {item.get('rationale')[:200]}...")
            if item.get('question'):
                print(f"   Question: {item.get('question')[:200]}...")
            
            results.append({
                "test": i,
                "description": test['description'],
                "prompt": test['prompt'],
                "status": "PASS",
                "item_id": item.get('item_id'),
                "kind": item.get('kind'),
                "state": item.get('state'),
                "title": item.get('title')
            })
            
        except Exception as e:
            print(f"❌ FAIL: Exception: {e}")
            results.append({
                "test": i,
                "description": test['description'],
                "prompt": test['prompt'],
                "status": "ERROR",
                "error": str(e)
            })
    
    # Print summary
    print(f"\n\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    
    passed = sum(1 for r in results if r['status'] == 'PASS')
    failed = sum(1 for r in results if r['status'] in ('FAIL', 'ERROR'))
    
    print(f"\nTotal tests: {len(results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    print("\nDetailed results:")
    for r in results:
        status_icon = "✅" if r['status'] == 'PASS' else "❌"
        print(f"{status_icon} Test {r['test']}: {r['description']}")
        if r['status'] == 'PASS':
            print(f"   Item: {r['item_id']} - {r['kind']} - {r['state']}")
        else:
            print(f"   {r.get('reason', r.get('error', 'Unknown error'))}")
    
    # Write results to file
    with open('/workspace/injection_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults written to injection_test_results.json")

if __name__ == "__main__":
    main()
