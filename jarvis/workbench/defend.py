"""Defend a decision when questioned — from the run's own evidence, not from a script.

Every point cites the log line (and audit hash) it rests on, says what the alternative would cost, and says what
evidence would change the agent's mind. The Controller can still override: rejecting with a reason re-plans and
becomes precedent. Defending is not refusing.
"""
from __future__ import annotations

import re

from jarvis.money import fmt
from jarvis.world.bible import COA

STOP = {"accrue", "september", "sept", "bank", "merge", "file", "into", "drive", "with", "from", "publish", "financial",
        "package", "documents", "install", "vendor", "mapping", "rules", "what", "late", "change", "credited", "earned",
        "invoice", "dated", "paypal", "xfer", "inst"}


def _name(a):
    return f"{a} {COA[a][1]}" if a in COA else a


def _keywords(it):
    toks = re.findall(r"[A-Za-z][A-Za-z&]{3,}|\$[\d,]+\.\d\d|\d{2,}[A-Z0-9]{4,}", it["title"])
    return [t for t in toks if t.lower() not in STOP]


def _evidence(run, it, n=4):
    kws = [k.lower() for k in _keywords(it)]
    hits = []
    for e in run.logs:
        if e["level"] not in ("find", "decide", "check", "sim", "warn") or e.get("moment") == "defended" \
                or e["msg"].startswith(("Proposed", "Challenge", "①", "②", "③")):
            continue
        m = e["msg"].lower()
        score = sum(1 for k in kws if k in m) + (1 if e.get("moment") else 0)
        if score:
            hits.append((score, e))
    hits.sort(key=lambda x: (-x[0], x[1]["seq"]))
    return [e for _, e in hits[:n]]


def _counterfactual(run, it):
    pr = it["proposal"]
    kind = pr.get("kind")
    lines = pr.get("lines") or []
    if kind == "accrual":
        amt = max(abs(l["cents"]) for l in lines)
        pl = next(l for l in lines if l["acct"][0] in "45")
        side = "income" if pl["acct"][0] == "4" else "expense"
        return (f"Without it, September {side} is understated by {fmt(amt)} and October overstated by the same. "
                f"It auto-reverses on {pr.get('auto_reverse', '2026-10-01')}, so when the cash or bill arrives there is no double count.")
    if kind == "bank_categorize":
        m = re.search(r"line (\d+)", pr.get("memo", ""))
        feed = {f["line"]: f for f in run.ctx.get("feed", [])}
        f = feed.get(int(m.group(1))) if m else None
        qbo = f["qbo_suggestion"] if f else "the suggested category"
        wrong = [l for l in lines if l["acct"] != "1010" and COA.get(l["acct"], ("", ""))[1] != qbo]
        parts = ", ".join(f"{fmt(l['cents'])} that is {_name(l['acct'])}" for l in wrong)
        return f"QBO's suggestion books all of it to '{qbo}'. That would misclassify {parts}."
    if kind == "vendor_merge":
        return (f"Left split, {pr['master']}'s spend history, 1099 totals and contract renewals are spread across "
                f"{1 + len(pr['aliases'])} records, and Ramp keeps creating new ones.")
    if kind == "vendor_rules":
        return "Without the rules, next month's Ramp sync recreates the same duplicates. Merging alone is a one-off cleanup."
    if kind == "file_evidence":
        return "Filed as downloaded, the auditor gets 'Statement (3).pdf', a duplicate and an August file, and three gaps nobody sees."
    if kind == "package_publish":
        return "All four tie-outs pass on these exact exports. Signing an older version would put numbers in front of the board that QBO no longer shows."
    if kind == "question":
        return "Guessing would put an unsupported payment in the books. A run-sheet mention is a hint, not support."
    return ""


def _mind_changers(it):
    kind = it["proposal"].get("kind")
    return {
        "accrual": "a vendor invoice or written confirmation for a different amount, or proof the work happened in October",
        "bank_categorize": "a receipt or invoice showing a different purpose, or a Controller ruling that changes policy",
        "vendor_merge": "a W-9 or TIN showing different legal entities",
        "vendor_rules": "a business reason to track a product line as its own vendor",
        "file_evidence": "a different naming convention from the Controller",
        "package_publish": "another change posted in QBO after these exports were downloaded",
        "question": "an invoice, W-9 or approval for the payment",
    }.get(kind, "new evidence")


def _address(question, it):
    q = question.lower()
    kind = it["proposal"].get("kind")
    lines = it["proposal"].get("lines") or []
    if any(w in q for w in ("materiality", "immaterial", "small", "under")):
        personal = any(l["acct"] == "1250" for l in lines)
        return ("Materiality decides whether a misstatement matters, not how to classify a transaction."
                + (" The personal purchase is a control issue, and ruling P-0317 applies regardless of size." if personal else ""))
    if any(w in q for w in ("always", "like we usually", "last month", "how we")):
        return "Last month's habit isn't evidence about this month's transaction. The documents for this one point elsewhere."
    if any(w in q for w in ("why not wait", "wait for", "next month", "invoice comes")):
        return "Waiting books September cost in October. The close is about the period the work happened, not when paper arrives."
    if any(w in q for w in ("sure", "confident", "certain", "proof", "evidence", "why")):
        return f"Confidence is {round((it.get('confidence') or 0) * 100)}% because each step below is backed by a source document."
    return "Here is what the decision rests on."


def defend(run, it, question: str) -> dict:
    if run is None:
        return {"points": [], "error": "run no longer in memory"}
    run.cur = run.stages[-1]["key"]
    run.moment("defended", "decide", f"Challenge on {it['item_id']} ({it['title']}): “{question}”. Defending from the evidence:",
               {"item_id": it["item_id"], "question": question}, pause=0.6)
    points = [_address(question, it)]
    run.log("decide", f"① {points[-1]}", pause=0.8)
    for e in _evidence(run, it):
        points.append(f"Log #{e['seq']} ({e['hash'][:8]}): {e['msg']}")
        run.log("decide", f"② evidence — log #{e['seq']} · audit {e['hash'][:8]}: {e['msg'][:220]}", {"cites": e["seq"]}, pause=0.6)
    cf = _counterfactual(run, it)
    if cf:
        points.append(cf)
        run.log("decide", f"③ the alternative — {cf}", pause=0.8)
    mc = _mind_changers(it)
    points.append(f"What would change my mind: {mc}. You can also reject with a reason. I'll re-plan, and your ruling becomes precedent.")
    run.log("ask", f"④ What would change my mind: {mc}. Reject with a reason to override; I'll re-plan and record it as precedent.",
            pause=0.6)
    return {"points": points, "item_id": it["item_id"]}
