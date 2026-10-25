#!/usr/bin/env python3
import json, requests, time

BASE = "http://localhost:8000"

scenarios = [
    ("Unknown wire", "A $5,000 wire from 'R&D Ventures LLC' on Sept 15"),
    ("Nordstrom personal", "Nordstrom $250 on Sept 27, cardholder J. Ortiz"),
    ("Duplicate", "Notion $96 bill twice"),
]

for name, text in scenarios:
    print(f"\n=== {name}: {text} ===")
    try:
        r = requests.post(f"{BASE}/api/inject", json={"text": text}, timeout=30)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Template: {data.get('template')}, Items: {len(data.get('items', []))}")
        else:
            print(f"Error: {r.text[:200]}")
    except Exception as e:
        print(f"Exception: {e}")
    time.sleep(1)
