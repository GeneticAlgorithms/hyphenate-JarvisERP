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
}


def parse(text: str) -> tuple[str, dict]:
    if llm.available():
        out = llm.complete_json(
            "Map the user's finance scenario to exactly one template and its params. Templates: " +
            "; ".join(f"{k}: {v['label']} params={list(v['params'])}" for k, v in TEMPLATES.items()) +
            ". Dates must be in 2026-09 unless the scenario says October. Amounts in dollars (number).",
            text)
        if out and out.get("template") in TEMPLATES:
            return out["template"], {**TEMPLATES[out["template"]]["params"], **(out.get("params") or {})}
    t = text.lower()
    m = re.search(r"\$?\s?([\d,]+(?:\.\d{1,2})?)", text)
    amount = float(m.group(1).replace(",", "")) if m else None
    if "paypal" in t:
        k = "paypal_bundle"
    elif "invoice" in t or "bill" in t and ("more" in t or "over" in t or "higher" in t):
        k = "invoice_over_accrual"
    elif "duplicate" in t or "twice" in t or "both" in t:
        k = "duplicate_bill"
    elif any(w in t for w in ("personal", "sephora", "nordstrom", "steam", "gift", "makeup", "clothes")):
        k = "personal_card"
    else:
        k = "unknown_debit"
    params = dict(TEMPLATES[k]["params"])
    if amount and k != "paypal_bundle":
        params["amount"] = amount
    q = re.search(r"['\"]([^'\"]{3,40})['\"]", text)
    if q and k == "unknown_debit":
        params["description"] = q.group(1).upper()
    for v in bible.VENDORS:
        if v["qbo_name"].lower().split()[0] in t and k in ("invoice_over_accrual", "duplicate_bill"):
            params["vendor"] = v["qbo_name"]
    return k, params


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
