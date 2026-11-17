"""
Unit tests for Validation Gates Engine.
"""
import pytest
import pandas as pd
from pipeline.validator import ValidationEngine

def test_gate1_weekend_holiday():
    validator = ValidationEngine()
    # 2026-11-15 was Sunday
    p1, msg1 = validator._gate1_trading_date("2026-11-15", holidays_set=set())
    assert not p1
    assert "weekend" in msg1.lower()

    # 2026-11-17 is Tuesday
    p2, msg2 = validator._gate1_trading_date("2026-11-17", holidays_set=set())
    assert p2

    # Holiday in set
    p3, msg3 = validator._gate1_trading_date("2026-01-26", holidays_set={"2026-01-26"})
    assert not p3
    assert "holiday" in msg3.lower()

def test_gate3_price_sanity():
    validator = ValidationEngine()
    # High < Low violation
    bad_df = pd.DataFrame([{
        "symbol": "BAD1", "series": "EQ", "open": 100.0, "high": 90.0, "low": 95.0, "close": 92.0, "prev_close": 98.0
    }])
    p, msg, _ = validator._gate3_price_sanity(bad_df)
    assert not p
    assert "High < Low" in msg

    # Negative price violation
    bad_neg = pd.DataFrame([{
        "symbol": "BAD2", "series": "EQ", "open": 100.0, "high": 110.0, "low": -5.0, "close": 105.0, "prev_close": 98.0
    }])
    p2, msg2, _ = validator._gate3_price_sanity(bad_neg)
    assert not p2
    assert "Zero or negative" in msg2

def test_gate6_breadth_accounting():
    validator = ValidationEngine()
    # Mismatch
    payload_bad = {"advancers": 200, "decliners": 250, "unchanged": 40, "universe_size": 500}
    p, msg = validator._gate6_breadth_accounting(payload_bad)
    assert not p
    assert "Accounting mismatch" in msg

    # Exact match
    payload_good = {"advancers": 200, "decliners": 250, "unchanged": 50, "universe_size": 500}
    p2, msg2 = validator._gate6_breadth_accounting(payload_good)
    assert p2
