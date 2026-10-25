"""Test that challenge evidence is filtered to only the challenged item's logs."""
import pytest
from jarvis.work.db import DB
from jarvis.work.roles import actor
from jarvis.work.transition import create_item, transition
from jarvis.workbench.defend import _evidence
from jarvis.workbench.core import Run, Workbench

JARVIS = actor("jarvis")


def test_evidence_filtered_to_item(tmp_path):
    """Challenge evidence should only cite logs mentioning the item's anchor/amount."""
    db = DB(str(tmp_path / "test.db"))
    
    # Create a mock run with logs
    wb = Workbench(str(tmp_path), db)
    run = Run(wb, "test_agent", tmp_path / "data")
    
    # Add logs for different items
    run.logs = [
        {"seq": 27, "level": "find", "msg": "Found invoice for Vendor A $1,234.56", "stage": "match"},
        {"seq": 52, "level": "decide", "msg": "Categorized Vendor B $500.00 to 6410", "stage": "match"},
        {"seq": 100, "level": "find", "msg": "PayPal deposit $3,912.44 from Anthropic bundles Nov payment", "stage": "match"},
        {"seq": 101, "level": "decide", "msg": "PayPal $3,912.44: keep in prepaid 1310 until Nov", "stage": "match"},
        {"seq": 102, "level": "check", "msg": "Verified Anthropic deposit $3,912.44 matches expected amount", "stage": "match"},
    ]
    
    # Create item for the $3,912.44 PayPal transaction
    item = {
        "item_id": "WI-TEST-001",
        "kind": "paypal_split",
        "title": "PayPal deposit $3,912.44 Anthropic Nov prepayment",
        "anchor": "$3,912.44",
        "proposal": {
            "kind": "paypal_split",
            "lines": [
                {"acct": "1010", "cents": 391244, "memo": "PayPal deposit"},
                {"acct": "1310", "cents": -391244, "memo": "Anthropic Nov prepayment"}
            ]
        },
        "evidence": [
            {"log_seq": 100},
            {"log_seq": 101},
            {"log_seq": 102}
        ]
    }
    
    # Get evidence for this item
    evidence = _evidence(run, item, challenge_type="period")
    
    # Should only include logs 100, 101, 102 (the ones mentioning $3,912.44)
    # Should NOT include logs 27 or 52 (different amounts/vendors)
    evidence_seqs = [e["seq"] for e in evidence]
    
    assert 27 not in evidence_seqs, "Evidence should not cite log #27 (different item)"
    assert 52 not in evidence_seqs, "Evidence should not cite log #52 (different item)"
    assert 100 in evidence_seqs or 101 in evidence_seqs or 102 in evidence_seqs, \
        "Evidence should cite at least one log from the $3,912.44 item"


def test_evidence_respects_anchor_match(tmp_path):
    """Evidence must match the item's anchor (amount/identifier)."""
    db = DB(str(tmp_path / "test.db"))
    
    wb = Workbench(str(tmp_path), db)
    run = Run(wb, "test_agent", tmp_path / "data")
    
    run.logs = [
        {"seq": 1, "level": "find", "msg": "Invoice #INV-123 for $5,000.00", "stage": "match"},
        {"seq": 2, "level": "find", "msg": "Invoice #INV-456 for $5,000.00", "stage": "match"},
        {"seq": 3, "level": "decide", "msg": "Matched INV-123 to vendor A", "stage": "match"},
    ]
    
    # Item with specific anchor
    item = {
        "item_id": "WI-TEST-002",
        "kind": "accrual",
        "title": "Accrual for INV-123",
        "anchor": "INV-123",
        "proposal": {"kind": "accrual", "lines": []},
        "evidence": [{"log_seq": 1}, {"log_seq": 3}]
    }
    
    evidence = _evidence(run, item, challenge_type="amount")
    evidence_seqs = [e["seq"] for e in evidence]
    
    # Should include logs mentioning INV-123
    assert 1 in evidence_seqs or 3 in evidence_seqs
    # Should not include log mentioning only INV-456
    # (unless it's in the evidence list, which seq 2 is not)
