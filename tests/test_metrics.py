"""
Unit tests for quantitative metrics (windows, thrust, clusters, regime).
"""
import pytest
import pandas as pd
import numpy as np
from pipeline.metrics import (
    compute_stock_signals, compute_daily_breadth,
    compute_industry_clusters, calculate_regime
)

def test_highs_and_lows_rolling_windows():
    # Build 25 sessions where prices rise steadily:
    # 1 to 21 sessions, then on session 22 (index 21) price makes a new high
    records = []
    for i in range(25):
        records.append({
            "date": f"2026-01-{i+1:02d}",
            "symbol": "ABC",
            "series": "EQ",
            "adj_open": float(100 + i),
            "adj_high": float(102 + i),
            "adj_low": float(98 + i),
            "adj_close": float(101 + i),
            "close": float(101 + i),
            "prev_close": float(100 + i),
            "volume": 1000,
            "value": 100000.0,
            "isin": "INE001"
        })
    df = pd.DataFrame(records)
    signals = compute_stock_signals(df)

    # Prior to session 21 (index 21), prior_high_1m is NaN
    assert pd.isna(signals.loc[20, "prior_high_1m"])
    # On session 22 (index 21), prior 21 sessions are complete
    # Max prior high was session 21's high (102 + 20 = 122)
    assert signals.loc[21, "prior_high_1m"] == 122.0
    # Today's high is 102 + 21 = 123 > 122 -> is_new_1m_high is True
    assert signals.loc[21, "is_new_1m_high"] == True
    assert signals.loc[21, "is_new_1m_low"] == False

def test_monthly_thrust():
    # 4 stocks: 2 up > 25%, 1 down > 25%, 1 flat
    today = "2026-06-01"
    day_df = pd.DataFrame([
        {"symbol": "S1", "date": today, "close": 130.0, "prev_close": 128.0, "gain_20d": 0.30, "is_quarantined": False,
         "is_new_1m_high": True, "is_new_1m_low": False, "is_new_3m_high": True, "is_new_3m_low": False,
         "is_new_6m_high": True, "is_new_6m_low": False, "is_new_52w_high": True, "is_new_52w_low": False,
         "above_20_dma": True, "above_50_dma": True, "above_200_dma": True},
        {"symbol": "S2", "date": today, "close": 140.0, "prev_close": 138.0, "gain_20d": 0.28, "is_quarantined": False,
         "is_new_1m_high": True, "is_new_1m_low": False, "is_new_3m_high": True, "is_new_3m_low": False,
         "is_new_6m_high": False, "is_new_6m_low": False, "is_new_52w_high": False, "is_new_52w_low": False,
         "above_20_dma": True, "above_50_dma": True, "above_200_dma": True},
        {"symbol": "S3", "date": today, "close": 70.0, "prev_close": 75.0, "gain_20d": -0.30, "is_quarantined": False,
         "is_new_1m_high": False, "is_new_1m_low": True, "is_new_3m_high": False, "is_new_3m_low": True,
         "is_new_6m_high": False, "is_new_6m_low": True, "is_new_52w_high": False, "is_new_52w_low": True,
         "above_20_dma": False, "above_50_dma": False, "above_200_dma": False},
        {"symbol": "S4", "date": today, "close": 100.0, "prev_close": 100.0, "gain_20d": 0.05, "is_quarantined": False,
         "is_new_1m_high": False, "is_new_1m_low": False, "is_new_3m_high": False, "is_new_3m_low": False,
         "is_new_6m_high": False, "is_new_6m_low": False, "is_new_52w_high": False, "is_new_52w_low": False,
         "above_20_dma": True, "above_50_dma": False, "above_200_dma": False},
    ])

    res = compute_daily_breadth(day_df, universe_size=4)
    # Monthly thrust = 2 (up 25%) - 1 (down 25%) = 1
    assert res["monthly_thrust"]["value"] == 1
    assert res["monthly_thrust"]["stocks_up_25pct"] == 2
    assert res["monthly_thrust"]["stocks_down_25pct"] == 1
    assert res["advancers"] == 2
    assert res["decliners"] == 1
    assert res["unchanged"] == 1
    assert res["advancers"] + res["decliners"] + res["unchanged"] == 4

def test_industry_clusters():
    # Industry with 4 stocks: 2 at 3M high, 3 at 1M high
    today = "2026-06-01"
    df = pd.DataFrame([
        {"symbol": "IT1", "date": today, "gain_20d": 0.10, "is_new_3m_high": True, "is_new_1m_high": True, "is_quarantined": False},
        {"symbol": "IT2", "date": today, "gain_20d": 0.12, "is_new_3m_high": True, "is_new_1m_high": True, "is_quarantined": False},
        {"symbol": "IT3", "date": today, "gain_20d": 0.05, "is_new_3m_high": False, "is_new_1m_high": True, "is_quarantined": False},
        {"symbol": "IT4", "date": today, "gain_20d": -0.02, "is_new_3m_high": False, "is_new_1m_high": False, "is_quarantined": False},
    ])
    ind_map = {"IT1": "Technology", "IT2": "Technology", "IT3": "Technology", "IT4": "Technology"}

    clusters = compute_industry_clusters(df, ind_map, min_stocks_threshold=3)
    assert len(clusters) == 1
    c = clusters[0]
    assert c["industry"] == "Technology"
    assert c["total_stocks"] == 4
    assert c["count_3m_high"] == 2
    assert c["share_3m_high"] == 50.0  # 2/4 = 50%
    assert c["count_1m_high"] == 3
    assert c["share_1m_high"] == 75.0  # 3/4 = 75%

def test_regime_classification():
    # 1. Broad Bull
    score, label, color = calculate_regime(new_52w_highs=80, new_52w_lows=5, new_6m_highs=100, new_6m_lows=10, new_1m_highs=120, new_1m_lows=15, universe_size=500)
    assert label == "Strong Advance"
    assert color == "#0d9488"
    assert score > 0.15

    # 2. Severe Decline
    score_b, label_b, color_b = calculate_regime(new_52w_highs=2, new_52w_lows=90, new_6m_highs=5, new_6m_lows=110, new_1m_highs=10, new_1m_lows=150, universe_size=500)
    assert label_b == "Severe Decline"
    assert color_b == "#c2410c"
    assert score_b < -0.15
