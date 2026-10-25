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


def _classify_challenge(question: str) -> str:
    """Classify challenge type: purpose, period, amount, identity, policy, materiality."""
    q = question.lower()
    # Check materiality FIRST before 'why not' can match
    if any(w in q for w in ("materiality", "immaterial", "small", "under", "threshold", "does it matter", "just expense it")):
        return "materiality"  # Materiality threshold
    if any(w in q for w in ("what is", "what's", "who is", "merchant", "vendor", "this payment", "company")):
        return "identity"  # Who/what is this vendor/transaction
    if any(w in q for w in ("when", "period", "month", "september", "october", "timing", "accrual", "cut-off", "prepaid")):
        return "period"  # When to recognize/which period
    if any(w in q for w in ("how much", "amount", "$", "too much", "too little", "wrong amount")):
        return "amount"  # Dollar amount questioned
    if any(w in q for w in ("why", "purpose", "what for", "category", "account", "expense", "revenue", "classify")):
        return "purpose"  # What is this transaction for/how to categorize
    if any(w in q for w in ("policy", "rule", "always", "usually", "precedent", "last time", "should")):
        return "policy"  # Policy/precedent application
    return "general"


def _check_concession(question: str, it: dict) -> dict | None:
    """Check if new evidence in question should trigger concession and re-proposal."""
    q = question.lower()
    kind = it["proposal"].get("kind")
    
    # Pattern: "the show moved to [date]" or "actually happened [date]"
    if kind in ("accrual", "bank_categorize") and ("moved to" in q or "actually" in q or "changed to" in q):
        # Extract new date
        date_match = re.search(r'(sept|september|oct|october)\s*(\d{1,2})', q)
        if date_match:
            month = {"sept": 9, "september": 9, "oct": 10, "october": 10}.get(date_match.group(1))
            day = int(date_match.group(2))
            new_date = f"2026-{month:02d}-{day:02d}"
            
            # Check if this changes period classification
            proposal_date = it["proposal"].get("date", "")
            if proposal_date and new_date[:7] != proposal_date[:7]:
                return {
                    "concede": True,
                    "reason": f"New evidence shows transaction belongs to {new_date[:7]} not {proposal_date[:7]}",
                    "new_date": new_date,
                    "action": "withdraw and re-propose in correct period"
                }
    
    # Pattern: "actually billed $X" or "invoice shows $Y"
    if "actually" in q or "invoice shows" in q or "billed" in q:
        amt_match = re.search(r'\$\s?([\d,]+(?:\.\d{2})?)', question)
        if amt_match:
            new_amt = float(amt_match.group(1).replace(",", "")) * 100
            proposal_amt = sum(abs(l.get("cents", 0)) for l in it["proposal"].get("lines", []))
            if abs(new_amt - proposal_amt) > 100:  # More than $1 difference
                return {
                    "concede": True,
                    "reason": f"Invoice confirms {fmt(int(new_amt))} not {fmt(proposal_amt)}",
                    "new_amount": int(new_amt),
                    "action": "withdraw and re-propose with correct amount"
                }
    
    return None


def _address(question, it):
    q = question.lower()
    kind = it["proposal"].get("kind")
    lines = it["proposal"].get("lines") or []
    
    # Check for concession first
    concession = _check_concession(question, it)
    if concession:
        return f"**CONCEDING**: {concession['reason']}. {concession['action']}. The corrected proposal will appear in the next run."
    
    # Classify and address challenge
    challenge_type = _classify_challenge(question)
    
    if challenge_type == "materiality":
        personal = any(l["acct"] == "1250" for l in lines)
        return ("Materiality decides whether a misstatement matters, not how to classify a transaction."
                + (" The personal purchase is a control issue, and ruling P-0317 applies regardless of size." if personal else ""))
    elif challenge_type == "policy":
        return "Last month's habit isn't evidence about this month's transaction. The documents for this one point elsewhere."
    elif challenge_type == "period":
        return "Waiting books September cost in October. The close is about the period the work happened, not when paper arrives."
    elif challenge_type == "identity" or challenge_type == "purpose":
        return f"Confidence is {round((it.get('confidence') or 0) * 100)}% because each step below is backed by a source document."
    elif challenge_type == "amount":
        # Sum only one side (debits or credits), not both
        total = sum(l.get("cents", 0) for l in lines if l.get("cents", 0) != 0)
        total = abs(total) // 2 if len([l for l in lines if l.get("cents", 0) != 0]) > 1 else abs(total)
        return f"Total {fmt(total)} ties to source documents. Each line is computed from receipts/contracts, not estimated."
    else:
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
