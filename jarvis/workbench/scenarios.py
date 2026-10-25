"""The five problems, in the accountant's own words (from our accountant teammate's brief)."""

SCENARIOS = {
    "p1_timing": {
        "tab": "Timing & Accruals", "icon": "⏱",
        "problem": "Interest earned September 1–30 is deposited October 1, so it hits the bank in a different month than it was "
                   "earned — September needs an Other Receivable. Separately, vendors did work in September but invoice later; "
                   "they're slow to respond, and for larger clients it's hard to gather the context on what needs to be accrued.",
        "pain": ["Timing difference: cash month ≠ earned month", "Estimate work done but not yet invoiced",
                 "Vendors take a long time to respond", "Context is scattered across contracts, timesheets, email"],
        "default_task": "Close September: find revenue earned in September but received in October, and accrue any vendor work "
                        "performed in September that hasn't been billed. Reach out to vendors where needed. Draft the entries with "
                        "Oct 1 reversals for my approval.",
        "agents": ["p1_timing"],
    },
    "p2_rollforward": {
        "tab": "Package Roll-forward", "icon": "📊",
        "problem": "Every month I take last month's Excel financial package plus the QBO Balance Sheet, Income Statement and Cash "
                   "Flow exports, and manually add a column for the new month. A new GL account means manually adding and "
                   "labeling rows. A last-minute change in QBO means downloading all three files again and redoing it.",
        "pain": ["Manually add next month's columns", "New GL accounts need new rows + labels",
                 "QBO exports are formatted reports, not data", "Last-minute QBO change → redo everything"],
        "default_task": "Roll the August package forward to September from the raw QBO exports. Handle new or renamed accounts, "
                        "tie everything out, draft flux comments, and give me the workbook to sign off.",
        "agents": ["p2_rollforward", "p2_late"],
    },
    "p3_bank": {
        "tab": "Bank Transactions", "icon": "🏦",
        "problem": "Bank feed descriptions don't match or don't give enough context. The QBO bank feed says 'PayPal transaction' — "
                   "but which PayPal transaction? I have to log into PayPal and look it up manually, which takes extra time.",
        "pain": ["Descriptor names the payment rail, not the merchant", "One debit can be several purchases",
                 "Currency conversion makes amounts differ", "QBO's suggested category is a guess"],
        "default_task": "Work the September 'For Review' bank feed. For every line that doesn't say what it is, look it up (PayPal, "
                        "receipts, order history), match it to the cent, and propose the right categorization. Ask me if you can't support it.",
        "agents": ["p3_bank"],
    },
    "p4_evidence": {
        "tab": "Evidence & Folders", "icon": "🗂",
        "problem": "We save every bank statement and reconciliation to Google Drive. I manually download each statement and recon, "
                   "rename it properly and file it in the right folder — and I still have to check nothing is missing.",
        "pain": ["Downloads have useless names ('Statement (3).pdf')", "Duplicates and wrong-month files",
                 "A statement isn't a reconciliation", "Hard to prove the pack is complete"],
        "default_task": "File September's bank statements and reconciliations from my Downloads folder into Drive using our naming "
                        "convention, and tell me exactly what's missing.",
        "agents": ["p4_evidence"],
    },
    "p5_vendors": {
        "tab": "Duplicate Vendors", "icon": "👥",
        "problem": "Claude/Anthropic, Anysphere/Cursor and Google/Google Ads end up as separate vendors. It happens because a bill is "
                   "paid under 'Anthropic', but on Ramp someone buys a Claude subscription and Ramp suggests creating a new vendor 'Claude'.",
        "pain": ["Product names become vendors", "Spend history split across records",
                 "Look-alike names that are NOT the same company", "Happens again every month"],
        "default_task": "Clean up the vendor master: find duplicates across QBO, Ramp and PayPal, prove which ones are the same legal "
                        "entity, keep look-alikes separate, show the impact, and stop it happening again.",
        "agents": ["p5_vendors"],
    },
}
