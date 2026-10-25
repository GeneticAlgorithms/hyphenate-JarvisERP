"""Test that audit trail captures LLM calls, stage transitions, and denials."""
import pytest
from jarvis.work.db import DB
from jarvis.work.roles import actor
from jarvis.work.transition import create_item, transition, Denied
from jarvis.agent import llm
from jarvis.agent.engine import Engine

JARVIS = actor("jarvis")
MAYA = actor("maya")


def test_llm_calls_logged(tmp_path):
    """After a Workbench run with LLM available, audit_log contains llm_* actions."""
    if not llm.available():
        pytest.skip("No API key; LLM audit logging requires live model")
    
    db = DB(str(tmp_path / "test.db"))
    
    # Quick LLM call with db
    result = llm.complete("Say 'test'", "This is a test", db=db, actor_name="test")
    
    # Check audit
    llm_rows = db.q("SELECT * FROM audit_log WHERE action LIKE 'llm_%'")
    assert len(llm_rows) > 0, "Expected at least one llm_* audit row after llm.complete()"
    assert any(r["action"] in ("llm_call", "llm_success", "llm_failed") for r in llm_rows)


def test_needs_info_transition_logged(tmp_path):
    """ask action -> NEEDS_INFO transition creates audit row."""
    db = DB(str(tmp_path / "test.db"))
    
    item = create_item(db, actor("sync"), "test", "TEST-001", "Test escalation", "2026-09", ["ref1"])
    before_count = db.one("SELECT COUNT(*) n FROM audit_log WHERE subject=?", (item["item_id"],))["n"]
    
    transition(db, item["item_id"], "ask", JARVIS, reason="Need Controller input")
    
    after_count = db.one("SELECT COUNT(*) n FROM audit_log WHERE subject=?", (item["item_id"],))["n"]
    assert after_count > before_count
    
    # Check the ask audit row
    ask_row = db.one("SELECT * FROM audit_log WHERE subject=? AND action='ask'", (item["item_id"],))
    assert ask_row is not None
    assert ask_row["allowed"] == 1
    assert ask_row["actor"] == "jarvis"
    
    # Check item state
    updated = db.one("SELECT state FROM work_items WHERE item_id=?", (item["item_id"],))
    assert updated["state"] == "NEEDS_INFO"


def test_concession_withdraw_logged(tmp_path):
    """withdraw action (concession) creates audit row."""
    db = DB(str(tmp_path / "test.db"))
    
    item = create_item(db, actor("sync"), "accrual", "TEST-002", "Test accrual", "2026-09", ["ref2"])
    transition(db, item["item_id"], "propose", JARVIS, 
              {"proposal": {"lines": []}, "confidence": 0.9}, 
              reason="Initial proposal")
    
    before_count = db.one("SELECT COUNT(*) n FROM audit_log WHERE subject=?", (item["item_id"],))["n"]
    
    transition(db, item["item_id"], "withdraw", JARVIS, 
              {"concession": {"reason": "Controller showed the date was wrong"}},
              reason="Conceding: date was wrong")
    
    after_count = db.one("SELECT COUNT(*) n FROM audit_log WHERE subject=?", (item["item_id"],))["n"]
    assert after_count > before_count
    
    # Check the withdraw audit row
    withdraw_row = db.one("SELECT * FROM audit_log WHERE subject=? AND action='withdraw'", (item["item_id"],))
    assert withdraw_row is not None
    assert withdraw_row["allowed"] == 1
    assert "Conceding" in withdraw_row["reason"]
    
    # Check item state
    updated = db.one("SELECT state FROM work_items WHERE item_id=?", (item["item_id"],))
    assert updated["state"] == "DISMISSED"


def test_approval_denial_logged_with_allowed_zero(tmp_path):
    """Self-approval attempt logs with allowed=0."""
    db = DB(str(tmp_path / "test.db"))
    
    item = create_item(db, actor("sync"), "bank_categorize", "TEST-003", "Test entry", "2026-09", ["ref3"])
    transition(db, item["item_id"], "propose", JARVIS, 
              {"proposal": {"lines": []}, "confidence": 0.95}, 
              reason="Initial proposal")
    
    # Jarvis tries to approve own work (should be denied)
    with pytest.raises(Denied) as exc:
        transition(db, item["item_id"], "approve", JARVIS, reason="Self-approving")
    
    # Check that it was denied for role or separation reasons
    assert "may not" in str(exc.value).lower() or "separation" in str(exc.value).lower()
    
    # Check denial logged with allowed=0
    deny_row = db.one("SELECT * FROM audit_log WHERE subject=? AND action='approve' AND allowed=0", (item["item_id"],))
    assert deny_row is not None, "Expected audit row with allowed=0 for denied approval"
    assert deny_row["actor"] == "jarvis"
    # The denial reason should mention role restrictions
    assert "may not" in deny_row["reason"].lower() or "separation" in deny_row["reason"].lower()


def test_reject_action_logged(tmp_path):
    """Controller reject (not denial, successful rejection) logs with allowed=1."""
    db = DB(str(tmp_path / "test.db"))
    
    item = create_item(db, actor("sync"), "accrual", "TEST-004", "Test accrual", "2026-09", ["ref4"])
    transition(db, item["item_id"], "propose", JARVIS, 
              {"proposal": {"lines": []}, "confidence": 0.9}, 
              reason="Initial proposal")
    
    # Maya rejects it (successful rejection, not denial)
    transition(db, item["item_id"], "reject", MAYA, 
              {"answer": "Amount is wrong"}, 
              reason="Amount is wrong")
    
    # Check the reject audit row - allowed=1 because rejection succeeded
    reject_row = db.one("SELECT * FROM audit_log WHERE subject=? AND action='reject'", (item["item_id"],))
    assert reject_row is not None
    assert reject_row["allowed"] == 1, "Successful rejection should have allowed=1"
    assert reject_row["actor"] == "maya"
    
    # Check item state
    updated = db.one("SELECT state FROM work_items WHERE item_id=?", (item["item_id"],))
    assert updated["state"] == "REJECTED"
