"""Unit tests for money.py to_cents() handling of integers."""
import pytest
from jarvis.money import to_cents


def test_to_cents_with_float():
    """to_cents with float (dollars) should return cents."""
    assert to_cents(96.0) == 9600
    assert to_cents(1.50) == 150
    assert to_cents(1234.56) == 123456


def test_to_cents_with_int_returns_as_is():
    """to_cents with int returns it as-is (assumes already cents)."""
    # This is the current behavior - int is assumed to be cents
    assert to_cents(96) == 96
    assert to_cents(9600) == 9600


def test_llm_amount_normalization():
    """LLM amounts should be normalized to float before to_cents."""
    # In inject(), we normalize: int -> float before to_cents
    # Simulating: llm_result["amount"] = float(96) -> 96.0
    llm_amount = 96  # LLM returns int dollars
    normalized = float(llm_amount)  # Normalize to float
    assert to_cents(normalized) == 9600  # Now correct
    
    # Without normalization, int is treated as cents
    assert to_cents(llm_amount) == 96  # Wrong!
