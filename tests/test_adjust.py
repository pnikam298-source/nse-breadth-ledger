"""
Unit tests for price adjustment and quarantine logic.
"""
import pytest
import pandas as pd
from pipeline.adjust import PriceAdjuster, CorporateActionsManager

class MockCorpManager:
    def __init__(self, actions_map):
        # actions_map: (symbol, date) -> (has_action, subject)
        self.actions_map = actions_map

    def has_action(self, symbol: str, date_str: str):
        return self.actions_map.get((symbol, date_str), (False, None))


def test_split_backward_adjustment():
    # Simulate a stock with a 1:1 bonus / 2:1 split on 2026-06-01:
    # Prior close was 2000, PrevClose on 2026-06-01 is 1000.
    data = pd.DataFrame([
        {"date": "2026-05-30", "symbol": "TEST", "series": "EQ", "open": 1980.0, "high": 2010.0, "low": 1970.0, "close": 2000.0, "prev_close": 1975.0, "volume": 1000, "value": 2000000.0, "isin": "INE123"},
        {"date": "2026-06-01", "symbol": "TEST", "series": "EQ", "open": 1005.0, "high": 1020.0, "low": 995.0, "close": 1010.0, "prev_close": 1000.0, "volume": 2000, "value": 2020000.0, "isin": "INE123"},
        {"date": "2026-06-02", "symbol": "TEST", "series": "EQ", "open": 1012.0, "high": 1030.0, "low": 1005.0, "close": 1025.0, "prev_close": 1010.0, "volume": 2100, "value": 2150000.0, "isin": "INE123"},
    ])

    # Corporate action is confirmed
    corp_mgr = MockCorpManager({("TEST", "2026-06-01"): (True, "Bonus 1:1")})
    adjuster = PriceAdjuster(corp_mgr)

    adj_df, q_records = adjuster.adjust_history(data)

    assert len(q_records) == 0, "Legitimate corporate action should not be quarantined"
    # Historical prices prior to 2026-06-01 should be multiplied backwards by 0.5
    assert adj_df.loc[0, "adj_close"] == 1000.0
    assert adj_df.loc[0, "adj_high"] == 1005.0
    # Prices on and after 2026-06-01 remain unscaled
    assert adj_df.loc[1, "adj_close"] == 1010.0
    assert adj_df.loc[2, "adj_close"] == 1025.0


def test_unexplained_jump_quarantine():
    # Simulate a sudden 40% unexplained drop with no corporate action
    data = pd.DataFrame([
        {"date": "2026-05-30", "symbol": "BADSTK", "series": "EQ", "open": 100.0, "high": 105.0, "low": 98.0, "close": 100.0, "prev_close": 99.0, "volume": 500, "value": 50000.0, "isin": "INE999"},
        {"date": "2026-06-01", "symbol": "BADSTK", "series": "EQ", "open": 60.0, "high": 62.0, "low": 58.0, "close": 60.0, "prev_close": 60.0, "volume": 500, "value": 30000.0, "isin": "INE999"},
    ])

    # No corporate action exists
    corp_mgr = MockCorpManager({})
    adjuster = PriceAdjuster(corp_mgr)

    adj_df, q_records = adjuster.adjust_history(data)

    assert len(q_records) == 1, "Unexplained 40% jump must be quarantined"
    assert q_records[0]["symbol"] == "BADSTK"
    assert q_records[0]["gap_pct"] == 40.0
    assert adj_df.loc[1, "is_quarantined"] == True
