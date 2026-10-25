#!/usr/bin/env python3
"""Direct test of injector without web server."""

import sys
sys.path.insert(0, '/workspace')

from jarvis.agent.session import Session
from jarvis.work.transition import get_item

def test_scenario(session, prompt, description):
    print(f"\n{'='*80}")
    print(f"TEST: {description}")
    print(f"PROMPT: {prompt}")
    print(f"{'='*80}")
    
    try:
        result = session.inject(text=prompt)
        print(f"✅ SUCCESS")
        print(f"Template: {result['template']}")
        print(f"Created {len(result['items'])} work items:")
        for item_data in result['items']:
            print(f"  - {item_data['item_id']}: {item_data['kind']} [{item_data['state']}]")
            print(f"    Title: {item_data['title']}")
            if item_data.get('rationale'):
                print(f"    Rationale: {item_data['rationale'][:150]}...")
        return True
    except Exception as e:
        print(f"❌ FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("Initializing session...")
    session = Session(2026, fresh=True, quiet=True)
    
    tests = [
        ("Lumen Crew LLC emailed new bank details from lumencrew.co before the $18,400 payment", 
         "Vendor bank change - should create NEEDS_INFO work item"),
        
        ("Three $2,450 Ramp charges to Office Depot on 9/20 under the $2,500 approval limit",
         "Split purchases - should create all charges and flag for threshold avoidance"),
        
        ("Payment to Advanced Solutions Inc for $8,500 but vendor doesn't exist",
         "Ghost vendor - should block payment"),
        
        ("Bank shows +$1,200 refund from Bay Rig Rentals booked to revenue",
         "Refund as revenue - should propose reclass"),
        
        ("Nordstrom $250 on Maya's card 9/14",
         "Parse cardholder 'Maya' correctly"),
        
        ("Three Office Depot purchases: $245, $235, $240",
         "Parse split purchase with multiple amounts"),
    ]
    
    results = []
    for prompt, desc in tests:
        passed = test_scenario(session, prompt, desc)
        results.append((desc, passed))
    
    print(f"\n\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    passed = sum(1 for _, p in results if p)
    failed = len(results) - passed
    print(f"Total: {len(results)}, Passed: {passed}, Failed: {failed}")
    
    for desc, passed in results:
        icon = "✅" if passed else "❌"
        print(f"{icon} {desc}")

if __name__ == "__main__":
    main()
