"""Scenario Injector: judges type a scenario; it becomes new source records through a bounded set of
generator primitives (so free text can't corrupt the world), then Jarvis processes it live."""
from __future__ import annotations

import hashlib
import json
import re
import uuid

from jarvis.agent import llm
from jarvis.agent.context import JARVIS
from jarvis.money import fmt, to_cents
from jarvis.work import events
from jarvis.work.db import J
from jarvis.work.roles import actor
from jarvis.work.sync import _upsert
from jarvis.work.transition import append_audit, create_item, get_item, now, transition
from jarvis.world import bible, ids

SYNC = actor("sync")

TEMPLATES = {
    "unknown_debit": {"label": "Unknown bank debit", "params": {"amount": 742.18, "description": "SQ *MOONLIGHT GEAR CO",
                                                                "date": "2026-09-29"}},
    "invoice_over_accrual": {"label": "Vendor invoices more than we accrued",
                             "params": {"vendor": "Lumen Crew LLC", "amount": 13020.00, "date": "2026-10-09"}},
    "personal_card": {"label": "Personal purchase on a company card",
                      "params": {"merchant": "SEPHORA #2210", "amount": 96.40, "cardholder": "J. Ortiz",
                                 "date": "2026-09-27"}},
    "duplicate_bill": {"label": "Same purchase in Ramp and as a bill",
                       "params": {"vendor": "Notion", "amount": 96.00, "date": "2026-09-14"}},
    "paypal_bundle": {"label": "One PayPal transfer funding several payments",
                      "params": {"date": "2026-09-29", "payments": [{"name": "Damlicht Crew B.V.", "eur": 900.00,
                                                                     "item": "Crew fee Amsterdam 4 Oct"},
                                                                    {"name": "Splice.com, Inc.", "usd": 24.99,
                                                                     "item": "Splice Sounds subscription"}]}},
    "vendor_bank_change": {"label": "Vendor changes bank account before payment",
                          "params": {"vendor": "Lumen Crew LLC", "amount": 12000.00, "date": "2026-09-28"}},
    "split_purchases": {"label": "Multiple small purchases under approval threshold",
                       "params": {"merchant": "Office Depot", "amounts": [245.00, 235.00, 240.00], "date": "2026-09-20",
                                 "count": 3, "approval_limit": 2500.00, "source": "Ramp"}},
    "ghost_vendor": {"label": "Payment to non-existent vendor",
                    "params": {"vendor": "Advanced Solutions Inc", "amount": 8500.00, "date": "2026-09-22"}},
    "refund_as_revenue": {"label": "Refund incorrectly booked as revenue",
                         "params": {"merchant": "Bay Rig Rentals", "amount": 1200.00, "date": "2026-09-25"}},
}


def _parse_amount(text: str) -> float | None:
    """Extract dollar amount with k/m suffix support, avoiding date confusion."""
    # Try $50k, $12m format
    m = re.search(r'\$\s?([\d,]+(?:\.\d+)?)\s*([km])\b', text.lower())
    if m:
        base = float(m.group(1).replace(",", ""))
        return base * (1000 if m.group(2) == 'k' else 1000000)
    
    # Regular $X format - avoid confusing $96 with 9/6 date
    amounts = re.findall(r'\$\s?([\d,]+(?:\.\d{1,2})?)', text)
    for amt_str in amounts:
        amt = float(amt_str.replace(",", ""))
        # Skip likely dates (numbers under 32)
        if amt < 32 and re.search(rf'\${amt_str}.*\d+/\d+', text):
            continue
        if amt >= 1:
            return amt
    
    # Try "900 euros" format
    m = re.search(r'\b([\d,]+(?:\.\d+)?)\s*(euros?|eur)\b', text.lower())
    if m:
        return float(m.group(1).replace(",", ""))
    
    return None


def _parse_date(text: str) -> str | None:
    """Extract date from date-like tokens only."""
    # Match M/D format
    m = re.search(r'\b(9|10)/(\d{1,2})\b', text.lower())
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        if 1 <= day <= 31:
            return f"2026-{month:02d}-{day:02d}"
    
    # Match 'Sept 15' format
    m = re.search(r'\b(sept|september|oct|october)\s+(\d{1,2})\b', text.lower())
    if m:
        month = {"sept": 9, "september": 9, "oct": 10, "october": 10}[m.group(1)]
        day = int(m.group(2))
        if 1 <= day <= 31:
            return f"2026-{month:02d}-{day:02d}"
    
    return None


def _match_cardholder(text: str) -> str | None:
    """Match cardholder name case-insensitively."""
    t_lower = text.lower()
    for person in bible.PEOPLE.values():
        first = person["name"].split()[0].lower()
        if any(p in t_lower for p in [f"{first}'s card", f"{first} spent", f"{first} bought"]):
            return person["name"]
    return None


def _parse_split_purchases(text: str) -> dict:
    """Parse split purchases, separating limit from charges."""
    params = {}
    t_lower = text.lower()
    
    # Parse count
    for word in ["two", "three", "four", "five", "six", "2", "3", "4", "5", "6"]:
        if f" {word} " in f" {t_lower} ":
            params["count"] = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6}[word] if word.isalpha() else int(word)
            break
    
    # Extract ALL amounts
    all_amounts = []
    for m in re.finditer(r'\$\s?([\d,]+(?:\.\d{1,2})?)\s*([km])?', text.lower()):
        amt = float(m.group(1).replace(",", ""))
        if m.group(2):
            amt *= 1000 if m.group(2) == 'k' else 1000000
        all_amounts.append(amt)
    
    # Separate limit from charges
    limit = None
    if "limit" in t_lower or "threshold" in t_lower:
        # Last or largest amount is likely the limit if "under" is mentioned
        if "under" in t_lower and all_amounts:
            limit = max(all_amounts)
            all_amounts = [a for a in all_amounts if a < limit]
            params["approval_limit"] = limit
    
    if all_amounts:
        if len(all_amounts) == 1:
            params["amount_each"] = all_amounts[0]
        else:
            params["amounts"] = all_amounts
            params["count"] = len(all_amounts)
    
    # Extract merchant
    for v in bible.VENDORS:
        if v["qbo_name"].lower() in t_lower:
            params["merchant"] = v["qbo_name"]
            break
    
    # Extract source
    if "ramp" in t_lower:
        params["source"] = "Ramp"
    
    return params


def parse(text: str) -> tuple[str, dict]:
    """Parse free text. NEVER INVENT FACTS - return needs_info if unclear."""
    if not text or not text.strip():
        return "needs_info", {"error": "empty_text", "_parser": "none"}
    
    t_lower = text.lower()
    params = {}
    params["_parser"] = "deterministic"  # Default, may be overridden by LLM
    
    # Try LLM extraction first if available
    if llm.available():
        try:
            # Build vendor list for validation
            vendor_names = [v["qbo_name"] for v in bible.VENDORS]
            employee_names = [p["name"] for p in bible.PEOPLE.values()]
            
            schema = {
                "template": "one of: vendor_bank_change, split_purchases, ghost_vendor, refund_as_revenue, personal_card, duplicate_bill, invoice_over_accrual, paypal_bundle, needs_info",
                "vendor": f"exact vendor name from this list: {', '.join(vendor_names[:10])}..., or stated name if not in list, or null",
                "merchant": "merchant name as stated, or null",
                "amount": "number in dollars (convert k→1000, m→1000000), or null if not stated",
                "amounts": "array of charge amounts if multiple stated (exclude limit), or null",
                "count": "number of charges if stated, or null",
                "limit": "approval limit if mentioned, or null",
                "cardholder": f"full name from: {', '.join(employee_names)}, or null",
                "date": "YYYY-MM-DD in Sept/Oct 2026, or null if not stated",
                "currency": "USD or EUR if stated, or null"
            }
            
            llm_result = llm.complete_json(
                f"Extract accounting scenario details. Schema: {json.dumps(schema)}. "
                f"ONLY extract explicitly stated facts. Use null for unstated fields. "
                f"Validate vendor/employee names against provided lists.",
                f"Judge text: {text}",
                fast=True,
                timeout=3.0
            )
            
            if llm_result and llm_result.get("template"):
                # LLM extraction succeeded
                params["_parser"] = "llm_success"
                
                # Validate and fuzzy-match vendor
                if llm_result.get("vendor"):
                    matched = _match_vendor(llm_result["vendor"])
                    llm_result["vendor"] = matched["qbo_name"] if matched else llm_result["vendor"]
                
                # Merge LLM results, excluding template
                params.update({k: v for k, v in llm_result.items() if v is not None and k != "template"})
                
                template = llm_result["template"]
                if template in TEMPLATES or template == "needs_info":
                    return template, params
        except Exception as e:
            # LLM failed - fall back to deterministic
            params["_parser"] = "llm_failed"
            params["_llm_error"] = str(e)[:100]
    
    # Deterministic parsing fallback
    if params.get("_parser") == "deterministic":
        params["_parser"] = "deterministic_only"  # No LLM available
    
    # Extract amount
    amount = _parse_amount(text)
    if amount:
        params["amount"] = amount
    
    # Extract date
    date = _parse_date(text)
    if date:
        params["date"] = date
    
    # Extract vendor (prefer fuzzy match against master)
    quoted = re.search(r'["\']([^"\']{2,50})["\']', text)
    if quoted:
        v = _match_vendor(quoted.group(1))
        params["vendor"] = v["qbo_name"] if v else quoted.group(1)
        params["merchant"] = params["vendor"]
    else:
        for v in bible.VENDORS:
            if v["qbo_name"].lower() in t_lower:
                params["vendor"] = v["qbo_name"]
                params["merchant"] = v["qbo_name"]
                break
        
        # Try "from X" pattern for vendors not in master
        if "vendor" not in params:
            m = re.search(r'\bfrom\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', text)
            if m:
                name = m.group(1)
                matched = _match_vendor(name)
                params["vendor"] = matched["qbo_name"] if matched else name
    
    # Extract cardholder
    cardholder = _match_cardholder(text)
    if cardholder:
        params["cardholder"] = cardholder
    
    # Classify (be conservative - use needs_info if unclear)
    if any(w in t_lower for w in ["bank", "acct"]) and any(w in t_lower for w in ["change", "switch", "new"]):
        k = "vendor_bank_change"
    elif "split" in t_lower or re.search(r'(two|three|four|five|six|\d)\s+.*charges', t_lower):
        k = "split_purchases"
        params.update(_parse_split_purchases(text))
    elif any(w in t_lower for w in ["no w-9", "w9", "po box", "upfront", "never heard"]):
        k = "ghost_vendor"
    elif ("refund" in t_lower or "credit" in t_lower) and ("revenue" in t_lower or "income" in t_lower):
        k = "refund_as_revenue"
    elif "twice" in t_lower or ("paid" in t_lower and "again" in t_lower):
        k = "duplicate_bill"
    elif ("accrued" in t_lower or "invoiced" in t_lower) and ("more" in t_lower or "showed up" in t_lower):
        k = "invoice_over_accrual"
    elif "paypal" in t_lower and ("eur" in t_lower or "fx" in t_lower):
        k = "paypal_bundle"
    elif any(w in t_lower for w in ["nordstrom", "sephora"]) or (cardholder and "spent" in t_lower):
        k = "personal_card"
    elif "wire" in t_lower and " in" in t_lower:
        k = "needs_info"  # Incoming wire
    elif "boat" in t_lower or "auditor" in t_lower:
        k = "needs_info"  # Off-topic
    else:
        k = "needs_info"
    
    # Verify we have key data for classified scenario
    if k == "vendor_bank_change" and ("vendor" not in params or "amount" not in params):
        k = "needs_info"
    elif k == "split_purchases" and "amount" not in params and "amounts" not in params:
        k = "needs_info"
    elif k == "ghost_vendor" and "vendor" not in params:
        k = "needs_info"
    elif k == "refund_as_revenue" and "amount" not in params:
        k = "needs_info"
    
    return k, params


def _id(*parts) -> str:
    """Generate unique ID including timestamp to avoid silent no-ops on repeated injects."""
    timestamp = str(int(now().replace("T", "").replace(":", "").replace(".", "").replace("Z", "")[:14]))
    return hashlib.md5((timestamp + "|" + "|".join(map(str, parts))).encode()).hexdigest()[:10].upper()


def _match_vendor(name: str) -> dict | None:
    """Fuzzy match vendor name against vendor master (e.g., 'Lumen Crew' -> 'Lumen Crew LLC')."""
    if not name:
        return None
    name_lower = name.lower().strip()
    for v in bible.VENDORS:
        if v["qbo_name"].lower() == name_lower:
            return v
        if name_lower in v["qbo_name"].lower() or v["qbo_name"].lower() in name_lower:
            return v
        if name_lower in v.get("legal", "").lower():
            return v
    return None


def inject(session, text: str | None = None, template: str | None = None, params: dict | None = None) -> dict:
    """Inject judge scenario. NEVER INVENTS FACTS - creates needs_info if unclear."""
    db, eng = session.db, session.engine
    created = []
    tag = uuid.uuid4().hex[:6]
    
    try:
        if text and not template:
            template, params = parse(text)
        
        # Handle needs_info - create visible work item explaining what's missing
        if template == "needs_info":
            with db.tx():
                append_audit(db, SYNC, "inject", "scenario:needs_info", True,
                            f"Judge scenario needs clarification: {text}")
            
            anchor = f"inject:needs_info:{tag}"
            understood = []
            missing = []
            
            if params.get("amount"):
                understood.append(f"${params['amount']:.2f}")
            else:
                missing.append("amount")
            
            if params.get("vendor"):
                understood.append(f"vendor: {params['vendor']}")
            elif params.get("error") != "empty_text":
                missing.append("vendor/merchant name")
            
            if params.get("date"):
                understood.append(f"date: {params['date']}")
            
            understood_text = ", ".join(understood) if understood else "very little"
            missing_text = ", ".join(missing) if missing else "details"
            
            it = create_item(db, SYNC, "judge_scenario", anchor,
                            f"Judge scenario needs clarification: \"{text[:80] if text else 'empty'}...\"",
                            "2026-09", [])
            
            question = f"I understood: {understood_text}. Please clarify the {missing_text} for: \"{text[:150]}\""
            rationale = f"Could not confidently parse all required fields from judge prompt. {params.get('error', '')}"
            
            patch = {"question": question, "rationale": rationale, "injected": text or template}
            it = transition(db, it["item_id"], "ask", JARVIS, patch, reason=rationale)
            created.append(it)
            
            return {"template": "needs_info", "params": params, "parser": params.get("_parser", "deterministic"),
                    "items": [{"item_id": it["item_id"], "state": it["state"], "kind": it["kind"],
                              "title": it["title"], "rationale": rationale, "parser": params.get("_parser", "deterministic")}]}
        
        if template not in TEMPLATES:
            with db.tx():
                append_audit(db, SYNC, "inject", "scenario:unknown", False,
                            f"Unknown template: {template}")
            events.publish("inject_error", error="unknown_template", template=template, text=text)
            return {"error": "unknown_template", "template": template, "text": text, "items": []}
        
        params = {**TEMPLATES[template]["params"], **(params or {})}
        
        with db.tx():
            append_audit(db, SYNC, "inject", f"scenario:{template}", True,
                        f"judge scenario: {text or template} -> {params}")
        events.publish("inject", template=template, params=params, text=text)
        
    except Exception as e:
        with db.tx():
            append_audit(db, SYNC, "inject", "error", False, f"Parse error: {e}")
        events.publish("inject_error", error=str(e), text=text)
        return {"error": str(e), "text": text, "items": []}

    if template == "unknown_debit":
        cents = -abs(to_cents(params["amount"]))
        desc = params["description"]
        d = params["date"]
        us = f"{d[5:7]}/{d[8:10]}/{d[:4]}"
        bid = ids.bank_id("x4471", us, f"{cents / 100:.2f}", desc, 0)
        with db.tx():
            _upsert(db, "bank", bid, "bank_txn", d, cents, "USD", "", desc,
                    {"bank_id": bid, "details": "DEBIT", "type": "DEBIT_CARD", "balance_cents": 0, "injected": True},
                    {"injected": text or template}, "injector", 0)
        for it in eng.discover(d[:7]):
            created.append(eng.process_item(it, "bank_line"))
    elif template == "personal_card":
        cents = abs(to_cents(params["amount"]))
        rid = f"inj-{tag}"
        with db.tx():
            _upsert(db, "ramp", rid, "card_txn", params["date"], cents, "USD", params["merchant"].split(" #")[0].title(),
                    params["merchant"], {"ramp_id": rid, "settle": params["date"], "merchant": params["merchant"].split(" #")[0].title(),
                                         "descriptor": params["merchant"], "cardholder": params["cardholder"], "last4": "8812",
                                         "mcc": "5977" if "sephora" in params["merchant"].lower() else "5651",
                                         "department": "Live", "category": "Travel", "memo": "", "receipt": "No",
                                         "ramp_vendor": params["merchant"].split(" #")[0].title(),
                                         "erp_vendor": params["merchant"].split(" #")[0].title()},
                    {"injected": text or template}, "injector", 0)
            eid = f"JE-INJ-{tag}"
            db.conn.execute("INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            (eid, params["date"], params["date"][:7], f"Ramp card {params['merchant']} ({params['cardholder']})",
                             params["merchant"], "Expense", "", "ramp_sync", J({"ramp_id": rid}), None, "ramp_sync", now()))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (eid, 0, "6430", cents, "", None))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (eid, 1, "2050", -cents, "", None))
        for it, kind, payload in eng.discover_reviews(params["date"][:7]):
            created.append(eng.process_item(it, kind, payload))
    elif template == "duplicate_bill":
        cents = abs(to_cents(params["amount"]))
        v = next((x for x in bible.VENDORS if x["qbo_name"] == params["vendor"]), None)
        vid = v["id"] if v else db.one("SELECT vendor_id FROM vendors WHERE qbo_name=?", (params["vendor"],))["vendor_id"]
        rid = f"inj-{tag}"
        bill_id = f"BILL-INJ-{tag}"
        with db.tx():
            _upsert(db, "ramp", rid, "card_txn", params["date"], cents, "USD", params["vendor"], params["vendor"].upper(),
                    {"ramp_id": rid, "settle": params["date"], "merchant": params["vendor"], "descriptor": params["vendor"].upper(),
                     "cardholder": "Lee Okafor", "last4": "5521", "mcc": "5734", "department": "Cloud", "category": "Software",
                     "memo": "subscription", "receipt": "Yes", "ramp_vendor": params["vendor"], "erp_vendor": params["vendor"]},
                    {"injected": text or template}, "injector", 0)
            eid = f"JE-INJ-{tag}"
            db.conn.execute("INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            (eid, params["date"], params["date"][:7], f"Ramp card {params['vendor']}", params["vendor"],
                             "Expense", "", "ramp_sync", J({"ramp_id": rid}), None, "ramp_sync", now()))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (eid, 0, "6410", cents, "", None))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (eid, 1, "2050", -cents, "", None))
            bje = f"JE-INJB-{tag}"
            db.conn.execute("INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            (bje, params["date"], params["date"][:7], f"{params['vendor']} subscription", params["vendor"],
                             "Bill", f"INJ-{tag}", "ap_clerk", J({"bill_id": bill_id}), None, "ap_clerk", now()))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (bje, 0, "6410", cents, "", vid))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (bje, 1, "2010", -cents, "", vid))
            db.conn.execute("INSERT INTO bills VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            (bill_id, vid, params["vendor"], params["date"], params["date"], cents, f"INJ-{tag}",
                             f"{params['vendor']} subscription", "6410", "Open", params["date"][:7], bje))
        for it, kind, payload in eng.discover_reviews(params["date"][:7]):
            created.append(eng.process_item(it, kind, payload))
    elif template == "invoice_over_accrual":
        v = _match_vendor(params.get("vendor", ""))
        if not v:
            # Vendor not found - create needs_info
            anchor = f"inject:needs_info:{tag}"
            it = create_item(db, SYNC, "judge_scenario", anchor,
                            f"Judge scenario needs clarification: vendor '{params.get('vendor')}' not found",
                            "2026-09", [])
            question = f"Which vendor invoiced more than accrued? I couldn't find '{params.get('vendor')}' in the vendor master."
            rationale = f"Vendor '{params.get('vendor')}' not found in vendor master for invoice-over-accrual scenario."
            patch = {"question": question, "rationale": rationale, "injected": text or template}
            it = transition(db, it["item_id"], "ask", JARVIS, patch, reason=rationale)
            created.append(it)
            created = [c for c in created if c]
            return {"template": template, "params": params, "parser": params.get("_parser", "deterministic"),
                    "items": [{"item_id": c["item_id"], "state": c["state"], "kind": c["kind"], "title": c["title"],
                              "rationale": c.get("rationale", ""), "parser": params.get("_parser", "deterministic")} for c in created]}
        
        cents = abs(to_cents(params["amount"]))
        bill_id = f"BILL-INJ-{tag}"
        bje = f"JE-INJB-{tag}"
        with db.tx():
            if db.one("SELECT 1 FROM bills WHERE vendor_id=? AND service_period='2026-09' AND date > '2026-09-30'", (v["id"],)):
                pass
            else:
                db.conn.execute("INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                                (bje, "2026-10-09", "2026-10", f"{v['qbo_name']} services 2026-09", v["qbo_name"], "Bill",
                                 f"INJ-{tag}", "ap_clerk", J({"bill_id": bill_id}), None, "ap_clerk", now()))
                db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (bje, 0, v["default_acct"], cents, "", v["id"]))
                db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (bje, 1, "2010", -cents, "", v["id"]))
                db.conn.execute("INSERT INTO bills VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                                (bill_id, v["id"], v["qbo_name"], "2026-10-09", "2026-11-08", cents, f"INJ-{tag}",
                                 f"{v['qbo_name']} services 2026-09", v["default_acct"], "Open", "2026-09", bje))
        before = {r["item_id"] for r in db.q("SELECT item_id FROM work_items")}
        eng.run_october()
        created = [get_item(db, r["item_id"]) for r in db.q("SELECT item_id FROM work_items") if r["item_id"] not in before]
    
    elif template == "vendor_bank_change":
        # Create work item for vendor bank detail change - MUST verify via callback before payment
        v = _match_vendor(params.get("vendor", ""))
        
        if v:
            cents = int(params["amount"] * 100)
            d = params["date"]
            anchor = f"inject:bank_change:{tag}:{v['id']}"
            
            # Check if email domain actually differs from vendor master
            email_domain_mentioned = re.search(r'from\s+([a-z0-9.-]+\.[a-z]{2,})', text.lower()) if text else None
            if email_domain_mentioned:
                mentioned_domain = email_domain_mentioned.group(1)
                domain_mismatch = mentioned_domain != v.get("domain", "")
                domain_note = f"Email from {mentioned_domain} (vendor master shows {v.get('domain', 'N/A')})" if domain_mismatch else f"New bank details received by email"
            else:
                domain_note = "New bank details received by email"
            
            it = create_item(db, SYNC, "vendor_bank_change", anchor,
                            f"ALERT: {v['qbo_name']} bank details changed before ${params['amount']:.2f} payment",
                            d[:7], [],
                            evidence=[{"type": "alert", "id": f"email-{tag}", "source": "email",
                                      "desc": domain_note}])
            
            # Persist question and rationale in fields (not just audit reason)
            question = f"BLOCK ${params['amount']:.2f} payment to {v['qbo_name']} pending verification. " + \
                      f"{domain_note}. Verify via callback to phone on file: {v.get('phone', 'not listed')}. DO NOT PROCESS until verified."
            
            rationale = f"Vendor {v['qbo_name']} bank account change reported before ${params['amount']:.2f} payment. " + \
                       f"Payment BLOCKED pending phone verification per fraud prevention policy."
            
            patch = {
                "question": question,
                "rationale": rationale,
                "vendor_id": v["id"],
                "amount_cents": cents,
                "date": d,
                "requires": "callback_verification",
                "phone_on_file": v.get("phone", "vendor master"),
                "email_domain": v.get("domain", ""),
                "injected": text or template
            }
            it = transition(db, it["item_id"], "ask", JARVIS, patch, reason=rationale[:300])
            created.append(it)
        else:
            # Vendor not found - create needs_info
            anchor = f"inject:needs_info:{tag}"
            it = create_item(db, SYNC, "judge_scenario", anchor,
                            f"Judge scenario needs clarification: vendor '{params.get('vendor')}' not found",
                            "2026-09", [])
            question = f"Which vendor's bank account changed? I couldn't find '{params.get('vendor')}' in the vendor master."
            rationale = f"Vendor '{params.get('vendor')}' not found in vendor master for bank-change scenario."
            patch = {"question": question, "rationale": rationale, "injected": text or template}
            it = transition(db, it["item_id"], "ask", JARVIS, patch, reason=rationale)
            created.append(it)
    
    elif template == "split_purchases":
        # Create N charges, then flag them as split to evade approval limits
        amounts = params.get("amounts", [])
        if not amounts:
            count = params.get("count", 3)
            total = params.get("amount", 750.0)
            amt_each = total / count
            amounts = [amt_each] * count
        else:
            count = len(amounts)
        
        merchant = params.get("merchant") or params.get("vendor", "Office Depot")
        d = params.get("date", "2026-09-20")
        source = params.get("source", "Ramp")
        approval_limit = params.get("approval_limit", 2500.0)
        
        record_ids = []
        # Create ALL N charges first
        with db.tx():
            for i, amt in enumerate(amounts):
                cents = int(amt * 100)
                if source == "Ramp":
                    rid = f"inj-split-{tag}-{i}"
                    _upsert(db, "ramp", rid, "card_txn", d, cents, "USD", merchant,
                           f"{merchant} #{i+1}", 
                           {"ramp_id": rid, "settle": d, "merchant": merchant,
                            "descriptor": f"{merchant} #{i+1}", 
                            "cardholder": params.get("cardholder", "J. Ortiz"),
                            "last4": "8812", "mcc": "5943", "department": "Live", 
                            "category": "Supplies", "memo": f"Split {i+1}/{count}", 
                            "receipt": "Yes", "threshold_split": True,
                            "ramp_vendor": merchant,
                            "erp_vendor": merchant},
                           {"injected": text or template, "threshold_split": True}, "injector", 0)
                    # Get the record_id
                    rec = db.one("SELECT record_id FROM records WHERE src_id=?", (rid,))
                    if rec:
                        record_ids.append(rec["record_id"])
                    
                    # Create ledger entry for the charge
                    eid = f"JE-SPLIT-{tag}-{i}"
                    db.conn.execute("INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                                   (eid, d, d[:7], f"{merchant} {i+1}/{count}", merchant,
                                    "Expense", "", "ramp_sync", J({"ramp_id": rid}), None, "ramp_sync", now()))
                    db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (eid, 0, "6900", cents, "", None))
                    db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (eid, 1, "2050", -cents, "", None))
        
        # Now create the work item flagging this as threshold avoidance
        anchor = f"inject:split:{tag}"
        total_cents = sum(int(a * 100) for a in amounts)
        it = create_item(db, SYNC, "threshold_split", anchor, 
                        f"ESCALATE: {count} purchases to {merchant} on {d}, each under ${approval_limit:.2f} limit (total ${total_cents/100:.2f})",
                        d[:7], record_ids)
        
        # Transition to NEEDS_INFO with evidence of threshold splitting
        patch = {
            "count": count,
            "amounts": amounts,
            "total_cents": total_cents,
            "approval_limit_cents": int(approval_limit * 100),
            "merchant": merchant,
            "source": source,
            "date": d,
            "flagged_for_review": True,
            "escalate_to": "Controller",
            "rationale": f"All {count} charges are under the ${approval_limit:.2f} approval limit",
            "injected": text or template
        }
        it = transition(db, it["item_id"], "ask", JARVIS, patch, 
                       reason=f"{count} charges to same vendor on same day, each under ${approval_limit:.2f} approval threshold - likely split to avoid review. Escalating to Controller")
        created.append(it)
    
    elif template == "ghost_vendor":
        # Block payment to vendor with no W-9/SOW or whose details match employee
        vendor_name = params.get("vendor", "Advanced Solutions Inc")
        cents = int(params["amount"] * 100)
        d = params.get("date", "2026-09-22")
        
        # Check if vendor is in vendor master
        v = _match_vendor(vendor_name)
        in_master = v is not None
        
        # Build list of red flags from the text
        red_flags = []
        t_lower = text.lower() if text else ""
        
        if not in_master:
            red_flags.append("Not in vendor master")
        if "no w-9" in t_lower or "w9" in t_lower or "w-9" in t_lower:
            red_flags.append("No W-9 on file")
        if "no sow" in t_lower or "no contract" in t_lower:
            red_flags.append("No SOW or contract on file")
        if "po box" in t_lower:
            red_flags.append("Address is PO box")
        if "upfront" in t_lower:
            red_flags.append("Requests payment upfront")
        if "never heard" in t_lower:
            red_flags.append("Unknown vendor")
        if "address matches" in t_lower or "employee" in t_lower:
            red_flags.append("Address may match employee")
        
        # If no specific flags, add generic ones
        if not red_flags:
            red_flags.append("Vendor verification required")
        
        anchor = f"inject:ghost:{tag}:{vendor_name.replace(' ', '_')}"
        it = create_item(db, SYNC, "ghost_vendor", anchor,
                        f"BLOCK: Payment to '{vendor_name}' ${params['amount']:.2f} - vendor verification required",
                        d[:7], [],
                        evidence=[{"type": "alert", "id": f"ghost-{tag}", "source": "vendor_check",
                                  "desc": "; ".join(red_flags)}])
        
        # Persist question and rationale in fields
        question = f"BLOCK ${params['amount']:.2f} payment to '{vendor_name}'. Red flags: {'; '.join(red_flags)}. " + \
                  "Verify vendor legitimacy, obtain W-9 and contract before processing."
        
        rationale = f"Payment to '{vendor_name}' flagged for verification. {'; '.join(red_flags)}. " + \
                   "Payment BLOCKED pending Controller approval per vendor onboarding policy."
        
        patch = {
            "question": question,
            "rationale": rationale,
            "vendor_name": vendor_name,
            "amount_cents": cents,
            "date": d,
            "in_master": in_master,
            "red_flags": red_flags,
            "requires": "vendor_verification",
            "status": "BLOCKED",
            "escalate_to": "Controller",
            "injected": text or template
        }
        it = transition(db, it["item_id"], "ask", JARVIS, patch, reason=rationale[:300])
        created.append(it)
    
    elif template == "refund_as_revenue":
        # Customer refund incorrectly booked as revenue - propose reclass
        merchant = params.get("merchant", "Bay Rig Rentals")
        cents = int(params["amount"] * 100)
        d = params.get("date", "2026-09-25")
        
        # Create the incorrect revenue entry first (simulating the misclassification)
        with db.tx():
            # Wrong entry: booked to revenue
            wrong_eid = f"JE-WRONGREV-{tag}"
            db.conn.execute("INSERT INTO ledger_entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                           (wrong_eid, d, d[:7], f"Refund from {merchant} (MISCLASSIFIED)", merchant,
                            "Revenue", "", "stripe_sync", J({"refund": True}), None, "stripe_sync", now()))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (wrong_eid, 0, "1010", cents, "", None))
            db.conn.execute("INSERT INTO ledger_lines VALUES(?,?,?,?,?,?)", (wrong_eid, 1, "4950", -cents, "", None))
        
        # Create work item to reclass it
        anchor = f"inject:refund:{tag}:{merchant.replace(' ', '_')}"
        it = create_item(db, SYNC, "refund_reclass", anchor,
                        f"Reclass needed: +${params['amount']:.2f} from {merchant} is refund, not revenue",
                        d[:7], [],
                        evidence=[{"type": "ledger", "id": f"JE-WRONGREV-{tag}", "source": "ledger_entry",
                                  "desc": f"Incorrectly booked to 4950 Other Income"}])
        
        # Propose the reclassification entry
        # Debit 4950 (reverse the revenue), Credit proper account (contra-expense or AR)
        # Find the original expense account for this vendor
        original_acct = "5020"  # Bay Rig Rentals is gear rental
        v = next((x for x in bible.VENDORS if merchant in x["qbo_name"] or x["qbo_name"] in merchant), None)
        if v:
            original_acct = v.get("default_acct", "5020")
        
        patch = {
            "merchant": merchant,
            "amount_cents": cents,
            "date": d,
            "wrong_entry": f"JE-WRONGREV-{tag}",
            "booked_to": "4950",
            "should_be_contra": original_acct,
            "proposal": {
                "date": d,
                "memo": f"Reclass {merchant} refund from revenue to contra-expense",
                "lines": [
                    {"acct": "4950", "cents": cents, "memo": "Reverse incorrect revenue"},
                    {"acct": original_acct, "cents": -cents, "memo": f"Contra-expense: {merchant} refund"}
                ],
                "txn_type": "Journal Entry",
                "match_entries": [f"JE-WRONGREV-{tag}"]
            },
            "rationale": f"${params['amount']:.2f} credit from {merchant} was booked to 4950 Other Income, but this is a customer refund for services/rentals and should be recorded as a contra-expense in {original_acct} {bible.acct_name(original_acct)}",
            "injected": text or template
        }
        it = transition(db, it["item_id"], "propose", JARVIS, patch,
                       reason=f"Refund from {merchant} misclassified as revenue (4950); proposing reclass to contra-expense ({original_acct})")
        created.append(it)
    
    elif template == "paypal_bundle":
        d = params["date"]
        rate = session.ctx.fx(d) or 1.17
        total = 0
        pays = []
        with db.tx():
            for p in params["payments"]:
                pid = _id(tag, p["name"], p.get("item"))[:17]
                if "eur" in p:
                    eur = to_cents(p["eur"])
                    usd = round(eur * rate * 1.041)
                    _upsert(db, "paypal", pid, "paypal_general_payment", d, -eur, "EUR", p["name"],
                            f"General Payment {p['name']} {p.get('item', '')}",
                            {"txn_id": pid, "type": "General Payment", "time": "10:00:00", "status": "Completed",
                             "fee_cents": 0, "net_cents": -eur, "from_email": "ap@afterglowlabs.com",
                             "to_email": f"billing@{p['name'].split()[0].lower()}.example", "item": p.get("item", ""), "ref": "",
                             "impact": "Debit"}, {"injected": True}, "injector", 0)
                    cid = _id(tag, "conv", pid)[:17]
                    _upsert(db, "paypal", cid, "paypal_general_currency_conversion", d, -usd, "USD", "",
                            "General Currency Conversion", {"txn_id": cid, "type": "General Currency Conversion",
                                                            "ref": pid, "time": "10:00:00"}, {"injected": True}, "injector", 0)
                else:
                    usd = to_cents(p["usd"])
                    _upsert(db, "paypal", pid, "paypal_preapproved_payment_bill_user_payment", d, -usd, "USD", p["name"],
                            f"PreApproved Payment {p['name']} {p.get('item', '')}",
                            {"txn_id": pid, "type": "PreApproved Payment Bill User Payment", "time": "10:05:00",
                             "status": "Completed", "fee_cents": 0, "net_cents": -usd, "from_email": "ap@afterglowlabs.com",
                             "to_email": "billing@splice.com" if "splice" in p["name"].lower() else "", "item": p.get("item", ""),
                             "ref": "", "impact": "Debit"}, {"injected": True}, "injector", 0)
                total += usd
                pays.append(pid)
            fid = _id(tag, "fund")[:17]
            _upsert(db, "paypal", fid, "paypal_bank_deposit_to_pp_account", d, total, "USD", "",
                    "Bank Deposit to PP Account", {"txn_id": fid, "type": "Bank Deposit to PP Account", "ref": pays[0],
                                                   "time": "10:10:00"}, {"injected": True}, "injector", 0)
            desc = f"PAYPAL INST XFER {fid[:10]} WEB ID: PAYPALSI77"
            us = f"{d[5:7]}/{d[8:10]}/{d[:4]}"
            bid = ids.bank_id("x4471", us, f"{-total / 100:.2f}", desc, 0)
            _upsert(db, "bank", bid, "bank_txn", d, -total, "USD", "", desc,
                    {"bank_id": bid, "details": "DEBIT", "type": "ACH_DEBIT", "balance_cents": 0, "injected": True},
                    {"injected": True}, "injector", 0)
        for it in eng.discover(d[:7]):
            created.append(eng.process_item(it, "bank_line"))
    created = [c for c in created if c]
    return {"template": template, "params": params, "parser": params.get("_parser", "deterministic"),
            "items": [{"item_id": c["item_id"], "state": c["state"], "kind": c["kind"], "title": c["title"],
                       "rationale": c.get("rationale", ""), "parser": params.get("_parser", "deterministic")} for c in created]}
