"""
Regression test: Verify that corporate actions (splits, bonuses) produce NO false highs or lows.
"""
import pytest
import pandas as pd
from pipeline.adjust import PriceAdjuster
from pipeline.metrics import compute_stock_signals

class MockCorpManager:
    def __init__(self, action_symbol, action_date, subject="Face Value Split 1:10"):
        self.action_symbol = action_symbol
        self.action_date = action_date
        self.subject = subject

    def has_action(self, symbol: str, date_str: str):
        if symbol == self.action_symbol and date_str == self.action_date:
            return True, self.subject
        return False, None


def test_split_does_not_produce_false_low():
    """
    Scenario: Stock trading around ₹1000 for 250 days.
    On Day 251, it splits 1:10.
    PrevClose is ₹100, Day 251 Close is ₹102.
    WITHOUT adjustment: ₹102 would be flagged as an extreme false 52-week low.
    WITH proper backward adjustment: Day 1-250 are adjusted to ₹100,
    so Day 251 at ₹102 is NOT a 52-week low.
    """
    split_date = "2026-06-01"
    records = []
    # 252 days of history at ₹1000
    base_dt = pd.to_datetime("2025-06-01")
    for i in range(252):
        dt_str = (base_dt + pd.Timedelta(days=i)).strftime("%Y-%m-%d")
        records.append({
            "date": dt_str,
            "symbol": "SPLITCO",
            "series": "EQ",
            "open": 1000.0,
            "high": 1010.0,
            "low": 990.0,
            "close": 1000.0,
            "prev_close": 1000.0,
            "volume": 50000,
            "value": 50000000.0,
            "isin": "INE999"
        })

    # Day 253: Ex-date of 1:10 split
    # PrevClose is set by exchange to 100.0
    split_date = (base_dt + pd.Timedelta(days=252)).strftime("%Y-%m-%d")
    records.append({
        "date": split_date,
        "symbol": "SPLITCO",
        "series": "EQ",
        "open": 101.0,
        "high": 103.0,
        "low": 99.5,
        "close": 102.0,
        "prev_close": 100.0,
        "volume": 500000,
        "value": 51000000.0,
        "isin": "INE999"
    })

    raw_df = pd.DataFrame(records)

    # Apply backward price adjustment
    corp_mgr = MockCorpManager("SPLITCO", split_date, "Face Value Split 1:10")
    adjuster = PriceAdjuster(corp_mgr)
    adj_df, q_records = adjuster.adjust_history(raw_df)

    assert len(q_records) == 0, "Legitimate corporate action must not be quarantined"

    # Compute rolling metrics on adjusted prices
    signals_df = compute_stock_signals(adj_df)
    last_row = signals_df.iloc[-1]

    # Verify:
    # 1. Day 0 adjusted close should be 1000 * 0.1 = 100.0
    assert adj_df.loc[0, "adj_close"] == 100.0
    assert adj_df.loc[0, "adj_low"] == 99.0

    # 2. Prior 52W adjusted low before Day 251 was 99.0
    # Day 251 low is 99.0, high is 103.0
    # So is_new_52w_low must NOT be triggered
    # (today's low 99.0 <= prior low 99.0 might be equal, but if low was 100.0 it wouldn't be lower than 99.0)
    # Most importantly, without adjustment it would compare ₹99 against ₹990 (false low)!
    assert last_row["prior_low_52w"] == 99.0, "Prior low was properly adjusted backwards from 990 to 99"
    assert last_row["prior_high_52w"] == 101.0, "Prior high was properly adjusted backwards from 1010 to 101"
