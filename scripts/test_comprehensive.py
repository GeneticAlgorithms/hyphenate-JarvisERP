#!/usr/bin/env python3
"""Comprehensive test with 15+ varied judge-style prompts."""

import sys
sys.path.insert(0, '/workspace')

from jarvis.agent.session import Session

def test_scenario(session, idx, prompt, expected_behavior):
    print(f"\n{'='*80}")
    print(f"Test #{idx}: {expected_behavior}")
    print(f"Prompt: \"{prompt}\"")
    print(f"{'='*80}")
    
    try:
        result = session.inject(text=prompt)
        items = result.get('items', [])
        
        if not items:
            print(f"⚠️  NO WORK ITEM - Template: {result['template']}")
            return False
        
        for item in items:
            print(f"✅ Created: {item['kind']} [{item['state']}]")
            print(f"   ID: {item['item_id']}")
            print(f"   Title: {item['title']}")
            if item.get('rationale'):
                print(f"   Rationale: {item['rationale'][:120]}...")
        return True
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False

def main():
    print("=" * 80)
    print("COMPREHENSIVE INJECTION TEST - 20 VARIED JUDGE-STYLE PROMPTS")
    print("=" * 80)
    
    print("\nInitializing session (this may take a moment)...")
    session = Session(2026, fresh=True, quiet=True)
    
    # 20 varied test scenarios covering all bugs and edge cases
    scenarios = [
        # Bug G: Four unimplemented scenarios
        ("Lumen Crew emailed new bank info from a suspicious domain before $12k payment",
         "Vendor bank change with lookalike domain"),
        
        ("Three Ramp charges of $2450 each to Staples on Sept 20, all under $2500",
         "Split purchases to evade approval threshold"),
        
        ("Wire transfer to 'Consulting Group LLC' for $9200 - no W9 or contract",
         "Ghost vendor with missing documentation"),
        
        ("Received $1500 credit from equipment rental company, coded to Other Income",
         "Refund misclassified as revenue"),
        
        # Bug H: Parsing issues
        ("Nordstrom purchase $250 on Maya's card September 14",
         "Parse cardholder name 'Maya' -> 'Maya Chen'"),
        
        ("Four $499 charges to Office Depot on 9/15 under the $500 limit",
         "Parse count, amounts, vendor, and limit"),
        
        ("$89 at Sephora on Sam's card",
         "Parse 'Sam' -> 'Sam Rivera'"),
        
        ("Lee used company card for $45 Steam purchase",
         "Parse 'Lee' -> 'Lee Okafor'"),
        
        # Edge cases and variations
        ("Vendor 'Tech Solutions Inc' requesting updated banking info before $25000 wire",
         "Vendor bank change - generic vendor"),
        
        ("Five purchases to same merchant totaling $2400, each under threshold",
         "Split purchases with text 'five'"),
        
        ("Payment to non-existent vendor 'ABC Services' $6800",
         "Ghost vendor short prompt"),
        
        ("Bay Rig refund $800 incorrectly recorded as revenue",
         "Refund as revenue - specific vendor"),
        
        # Working scenarios to ensure they still work
        ("Unknown bank debit $550 labeled 'SQ *LOCAL CAFE'",
         "Unknown debit baseline"),
        
        ("Notion subscription billed twice - $96 each",
         "Duplicate bill detection"),
        
        ("PayPal bundle: 850 EUR to Damlicht crew and $30 to Splice",
         "PayPal bundle with EUR and USD"),
        
        ("Lumen Crew invoiced $14000 but we accrued $12500",
         "Invoice over accrual"),
        
        # Messy phrasing tests
        ("looks like someone split a big purchase into 3 smaller ones at target to dodge approval",
         "Split purchase with informal language"),
        
        ("got an email saying the bank account changed for that vendor we pay a lot",
         "Vendor bank change with messy phrasing"),
        
        ("there's a $7k payment going out to some company I've never heard of",
         "Ghost vendor with informal language"),
        
        ("we got money back from that rental place but it's showing up as income not a refund",
         "Refund as revenue with informal language"),
    ]
    
    results = []
    for idx, (prompt, desc) in enumerate(scenarios, 1):
        passed = test_scenario(session, idx, prompt, desc)
        results.append((idx, desc, prompt, passed))
    
    # Print summary
    print(f"\n\n{'='*80}")
    print("FINAL SUMMARY")
    print(f"{'='*80}")
    
    passed_count = sum(1 for _, _, _, p in results if p)
    failed_count = len(results) - passed_count
    
    print(f"\nTotal Tests: {len(results)}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {failed_count}")
    print(f"Success Rate: {100 * passed_count / len(results):.1f}%")
    
    if failed_count > 0:
        print(f"\n❌ Failed tests:")
        for idx, desc, prompt, passed in results:
            if not passed:
                print(f"  #{idx}: {desc}")
                print(f"       \"{prompt}\"")
    else:
        print(f"\n🎉 ALL TESTS PASSED!")
    
    print(f"\n\nDetailed Results:")
    for idx, desc, prompt, passed in results:
        icon = "✅" if passed else "❌"
        print(f"{icon} #{idx:2d}: {desc}")

if __name__ == "__main__":
    main()
