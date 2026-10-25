"""Scenario Injector: judges type a scenario; it becomes new source records through a bounded set of
generator primitives (so free text can't corrupt the world), then Jarvis processes it live."""
from __future__ import annotations

import hashlib
import re
import uuid

from jarvis.agent import llm
from jarvis.money import fmt, to_cents
from jarvis.work import events
from jarvis.work.db import J
from jarvis.work.roles import actor
from jarvis.work.sync import _upsert
from jarvis.work.transition import append_audit, create_item, get_item, now
from jarvis.world import bible, ids

SYNC = actor("sync")

TEMPLATES = {
    "unknown_debit": {"label": "Unknown bank debit", "params": {"amount": 742.18, "description": "SQ *MOONLIGHT GEAR CO",
                                                                "date": "2026-09-29"}},
    "invoice_over_accrual": {"label": "Vendor invoices more than we accrued",
                             "params": {"vendor": "Lumen Crew LLC", "amount": 13020.00}},
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
                       "params": {"merchant": "Office Depot", "amounts": [245.00, 235.00, 240.00], "date": "2026-09-20"}},
    "ghost_vendor": {"label": "Payment to non-existent vendor",
                    "params": {"vendor": "Advanced Solutions Inc", "amount": 8500.00, "date": "2026-09-22"}},
    "refund_as_revenue": {"label": "Refund incorrectly booked as revenue",
                         "params": {"merchant": "Bay Rig Rentals", "amount": 1200.00, "date": "2026-09-25"}},
}


def parse(text: str) -> tuple[str, dict]:
    """Parse free text into scenario template and parameters. Extract real values from text."""
    if llm.available():
        out = llm.complete_json(
            "Extract finance scenario details from user text. Return JSON with: template (one of: unknown_debit, "
            "personal_card, duplicate_bill, invoice_over_accrual, paypal_bundle, vendor_bank_change, split_purchases, "
            "ghost_vendor, refund_as_revenue), params (object with: amount in dollars as number, merchant/vendor name "
            "as written, date YYYY-MM-DD in Sept 2026 unless Oct specified, cardholder name if mentioned). "
            "Extract merchant/vendor name EXACTLY as user typed it.",
            f"User scenario: {text}")
        if out and out.get("template") in TEMPLATES:
            # Use LLM-extracted params, fallback to template defaults
            return out["template"], {**TEMPLATES[out["template"]]["params"], **(out.get("params") or {})}
    
    # Deterministic parsing: extract real parameters from text
    t = text.lower()
    params = {}
    
    # Extract amount
    m = re.search(r"\$\s?([\d,]+(?:\.\d{1,2})?)", text)
    if m:
        params["amount"] = float(m.group(1).replace(",", ""))
    
    # Extract date (9/15, Sept 15, September 15)
    dm = re.search(r"\b(9|10|sept|september|oct|october)\D{0,5}(\d{1,2})\b", t)
    if dm:
        month = {"9": 9, "10": 10, "sept": 9, "september": 9, "oct": 10, "october": 10}[dm.group(1)]
        day = int(dm.group(2))
        params["date"] = f"2026-{month:02d}-{day:02d}"
    
    # Extract merchant/vendor name from quotes or capitalized words
    quoted = re.search(r'"([^"]{2,40})"', text) or re.search(r"'([^']{2,40})'", text)
    if quoted:
        params["merchant"] = quoted.group(1)
        params["description"] = quoted.group(1).upper()
        params["vendor"] = quoted.group(1)
    else:
        # Try to find capitalized merchant names
        caps = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b', text)
        if caps and not any(w in text for w in ["PayPal", "Ramp", "Bank"]):
            params["merchant"] = caps[0]
            params["description"] = caps[0].upper()
            params["vendor"] = caps[0]
    
    # Extract cardholder name (handle "Maya's card" or "cardholder: J. Ortiz")
    cardholder = re.search(r"([A-Z][a-z]+)'s card", text)
    if cardholder:
        params["cardholder"] = cardholder.group(1)
    else:
        cardholder = re.search(r'cardholder[:\s]+([A-Z]\.\s*[A-Z][a-z]+)', text)
        if cardholder:
            params["cardholder"] = cardholder.group(1)
    
    # Classify scenario type
    if "paypal" in t:
        k = "paypal_bundle"
    elif "bank" in t and ("change" in t or "detail" in t or "fraud" in t or "vendor" in t):
        k = "vendor_bank_change"
    elif "split" in t or ("under" in t and ("threshold" in t or "limit" in t)) or re.search(r'(three|multiple|several)\s+.*\$[\d,]+.*charges', t):
        k = "split_purchases"
        # Extract number of charges and amount
        num_match = re.search(r'(three|four|five|2|3|4|5)\s+', t)
        if num_match:
            num_map = {"three": 3, "four": 4, "five": 5, "2": 2, "3": 3, "4": 4, "5": 5}
            params["count"] = num_map.get(num_match.group(1), 3)
    elif "ghost" in t or ("vendor" in t and ("fake" in t or "doesn't exist" in t or "no record" in t)):
        k = "ghost_vendor"
    elif "refund" in t and "revenue" in t:
        k = "refund_as_revenue"
    elif "invoice" in t or ("bill" in t and ("more" in t or "over" in t or "higher" in t)):
        k = "invoice_over_accrual"
    elif "duplicate" in t or "twice" in t or "both" in t or "two bills" in t or "two invoices" in t:
        k = "duplicate_bill"
    elif any(w in t for w in ("personal", "nordstrom", "sephora", "steam", "gift", "makeup", "clothes")):
        k = "personal_card"
    else:
        k = "unknown_debit"
    
    # Merge with template defaults, user params override
    final_params = {**TEMPLATES[k]["params"], **params}
    return k, final_params


def _id(*parts) -> str:
    return hashlib.md5("|".join(map(str, parts)).encode()).hexdigest()[:10].upper()


def inject(session, text: str | None = None, template: str | None = None, params: dict | None = None) -> dict:
    if text and not template:
        template, params = parse(text)
    params = {**TEMPLATES[template]["params"], **(params or {})}
    db, eng = session.db, session.engine
    created = []
    tag = uuid.uuid4().hex[:6]
    with db.tx():
        append_audit(db, SYNC, "inject", f"scenario:{template}", True, f"judge scenario: {text or template} -> {params}")
    events.publish("inject", template=template, params=params, text=text)

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
        v = next(x for x in bible.VENDORS if x["qbo_name"] == params["vendor"])
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
        # Freeze payment work item, mark NEEDS_INFO, request callback
        v = next((x for x in bible.VENDORS if x["qbo_name"] == params["vendor"]), None)
        if v:
            with db.tx():
                anchor = f"inject:bank_change:{tag}"
                it = create_item(db, SYNC, "bank_change", anchor, f"Vendor {params['vendor']} changed bank details before ${params['amount']/100:.2f} payment",
                                "2026-09", [])
                patch = {"alert": f"Vendor {params['vendor']} emailed new bank details before payment", "amount_cents": int(params['amount'] * 100),
                         "requires": "callback_verification", "injected": text or template}
                transition(db, it["item_id"], "needs_info", JARVIS, patch, reason="Bank detail change requires verification call")
                created.append(it)
    
    elif template == "split_purchases":
        # Create N charges, flag threshold splitting
        count = params.get("count", 3)
        amt_each = params["amount"] / count
        with db.tx():
            for i in range(count):
                rid = f"inj-split-{tag}-{i}"
                _upsert(db, "ramp", rid, "card_txn", params["date"], int(amt_each * 100), "USD", params.get("vendor", "Office Depot"),
                       f"Purchase {i+1}/{count}", {"ramp_id": rid, "settle": params["date"], "merchant": params.get("vendor", "Office Depot"),
                                                   "descriptor": f"Purchase {i+1}/{count}", "cardholder": params.get("cardholder", "J. Ortiz"),
                                                   "last4": "8812", "mcc": "5943", "department": "Live", "category": "Supplies",
                                                   "memo": f"Split {i+1}/{count}", "receipt": "Yes", "threshold_split": True},
                       {"injected": text or template, "threshold_split": True}, "injector", 0)
            anchor = f"inject:split:{tag}"
            it = create_item(db, SYNC, "threshold_split", anchor, f"{count} purchases of ~${amt_each:.2f} each to {params.get('vendor', 'vendor')} on {params['date']} (total ${params['amount']:.2f})",
                            "2026-09", [])
            patch = {"count": count, "amount_each": int(amt_each * 100), "total_cents": int(params['amount'] * 100),
                     "vendor": params.get("vendor", "Office Depot"), "flagged_for_review": True, "injected": text or template}
            transition(db, it["item_id"], "needs_info", JARVIS, patch, reason=f"Multiple charges under approval limit suggest threshold avoidance")
            created.append(it)
    
    elif template == "ghost_vendor":
        # Payment to non-existent vendor
        with db.tx():
            anchor = f"inject:ghost:{tag}"
            it = create_item(db, SYNC, "ghost_vendor", anchor, f"Payment to '{params.get('vendor', 'Advanced Solutions Inc')}' for ${params['amount']:.2f} but vendor not in master",
                            "2026-09", [])
            patch = {"vendor_name": params.get("vendor", "Advanced Solutions Inc"), "amount_cents": int(params['amount'] * 100),
                     "date": params["date"], "no_w9": True, "no_contract": True, "requires": "vendor_verification", "injected": text or template}
            transition(db, it["item_id"], "needs_info", JARVIS, patch, reason="Payment to vendor not in master; no W-9 or contract on file")
            created.append(it)
    
    elif template == "refund_as_revenue":
        # Refund booked as revenue instead of contra-expense
        cents = int(params['amount'] * 100)
        with db.tx():
            anchor = f"inject:refund:{tag}"
            it = create_item(db, SYNC, "refund_misclass", anchor, f"+${params['amount']:.2f} from {params.get('merchant', 'Stripe')} is a refund, not revenue",
                            "2026-09", [])
            patch = {"merchant": params.get("merchant", "Stripe"), "amount_cents": cents, "date": params["date"],
                     "booked_to": "4950", "should_be": "contra_expense", "injected": text or template}
            transition(db, it["item_id"], "needs_info", JARVIS, patch, reason="Credit classified as revenue; should be contra-expense/refund")
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
    return {"template": template, "params": params,
            "items": [{"item_id": c["item_id"], "state": c["state"], "kind": c["kind"], "title": c["title"],
                       "rationale": c.get("rationale", "")} for c in created]}
