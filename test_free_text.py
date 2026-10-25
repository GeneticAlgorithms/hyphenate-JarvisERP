#!/usr/bin/env python3
"""Test 3 free-text judge scenarios to prove the system works."""
from jarvis.agent.injector import parse

print("=" * 70)
print("FREE-TEXT SCENARIO TESTS")
print("=" * 70)

test_cases = [
    {
        "name": "Free-text 1: Bank details change",
        "text": "Lumen Crew emailed new bank details from lumencrew.co before the $18,400 payment",
        "expect_template": "vendor_bank_change",
        "expect_keys": ["vendor", "amount"],
    },
    {
        "name": "Free-text 2: Split purchases",
        "text": "Three $2,450 Ramp charges to the same vendor on 9/20 under the $2,500 approval limit",
        "expect_template": ["split_purchases", "needs_info"],  # Could be either
        "expect_keys": ["amounts", "amount"],  # At least one
    },
    {
        "name": "Free-text 3: Personal card purchase",
        "text": "Nordstrom $250 on Maya's card 9/14",
        "expect_template": "personal_card",
        "expect_keys": ["merchant", "amount", "cardholder", "date"],
    },
]

all_pass = True
for i, test in enumerate(test_cases, 1):
    print(f"\n[Test {i}] {test['name']}")
    print(f"Text: {test['text']}")
    
    try:
        template, params = parse(test['text'])
        
        # Check template
        expected_templates = test['expect_template'] if isinstance(test['expect_template'], list) else [test['expect_template']]
        if template in expected_templates:
            print(f"✓ Template: {template}")
        else:
            print(f"✗ Template: {template}, expected one of {expected_templates}")
            all_pass = False
        
        # Check keys
        found_keys = [k for k in test['expect_keys'] if k in params and params[k]]
        if found_keys:
            print(f"✓ Keys found: {', '.join(found_keys)}")
            print(f"  Values: {[(k, params[k]) for k in found_keys]}")
        else:
            print(f"✗ No expected keys found in params: {list(params.keys())}")
            all_pass = False
        
        # Check parser badge
        parser = params.get('_parser', 'unknown')
        print(f"✓ Parser: {parser}")
        
    except Exception as e:
        print(f"✗ CRASH: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        all_pass = False

print("\n" + "=" * 70)
if all_pass:
    print("✅ ALL 3 FREE-TEXT SCENARIOS PASS")
else:
    print("❌ SOME FREE-TEXT SCENARIOS FAILED")
print("=" * 70)
