"""
Quantitative Metrics Engine for NSE Breadth Ledger.
Computes:
- New N-session highs and lows (1M/21d, 3M/63d, 6M/126d, 52W/252d)
- Gain over N sessions (20d, 50d, etc.)
- Monthly thrust (+25% vs -25% over 20 sessions)
- Industry clusters (% at 3M high, % at 1M high)
- Regime values and color scales
- Advancers / Decliners / Unchanged counts
- Moving average breadth (20, 50, 200 DMA)
"""
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd

from pipeline.config import (
    WINDOW_1M, WINDOW_3M, WINDOW_6M, WINDOW_52W,
    THRUST_WINDOW, THRUST_THRESHOLD
)

def compute_stock_signals(symbol_df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes rolling metrics per symbol:
    - 1M, 3M, 6M, 52W max prior high and min prior low
    - High/Low breakout flags
    - 20-session return
    - Moving averages (20, 50, 200)
    """
    df = symbol_df.copy().sort_values("date").reset_index(drop=True)
    n = len(df)

    # Shifted rolling max/min (excluding current session)
    df["prior_high_1m"] = df["adj_high"].shift(1).rolling(WINDOW_1M, min_periods=WINDOW_1M).max()
    df["prior_low_1m"] = df["adj_low"].shift(1).rolling(WINDOW_1M, min_periods=WINDOW_1M).min()

    df["prior_high_3m"] = df["adj_high"].shift(1).rolling(WINDOW_3M, min_periods=WINDOW_3M).max()
    df["prior_low_3m"] = df["adj_low"].shift(1).rolling(WINDOW_3M, min_periods=WINDOW_3M).min()

    df["prior_high_6m"] = df["adj_high"].shift(1).rolling(WINDOW_6M, min_periods=WINDOW_6M).max()
    df["prior_low_6m"] = df["adj_low"].shift(1).rolling(WINDOW_6M, min_periods=WINDOW_6M).min()

    df["prior_high_52w"] = df["adj_high"].shift(1).rolling(WINDOW_52W, min_periods=WINDOW_52W).max()
    df["prior_low_52w"] = df["adj_low"].shift(1).rolling(WINDOW_52W, min_periods=WINDOW_52W).min()

    # High / Low breakout flags
    df["is_new_1m_high"] = (df["adj_high"] >= df["prior_high_1m"]).fillna(False)
    df["is_new_1m_low"] = (df["adj_low"] <= df["prior_low_1m"]).fillna(False)

    df["is_new_3m_high"] = (df["adj_high"] >= df["prior_high_3m"]).fillna(False)
    df["is_new_3m_low"] = (df["adj_low"] <= df["prior_low_3m"]).fillna(False)

    df["is_new_6m_high"] = (df["adj_high"] >= df["prior_high_6m"]).fillna(False)
    df["is_new_6m_low"] = (df["adj_low"] <= df["prior_low_6m"]).fillna(False)

    df["is_new_52w_high"] = (df["adj_high"] >= df["prior_high_52w"]).fillna(False)
    df["is_new_52w_low"] = (df["adj_low"] <= df["prior_low_52w"]).fillna(False)

    # 52-week high reference including today
    df["high_52w"] = df["adj_high"].rolling(WINDOW_52W, min_periods=1).max()
    df["low_52w"] = df["adj_low"].rolling(WINDOW_52W, min_periods=1).min()
    df["pct_from_52w_high"] = ((df["high_52w"] - df["adj_close"]) / df["high_52w"] * 100.0).round(2)

    # Rolling returns over multiple session windows
    df["gain_5d"] = (df["adj_close"] / df["adj_close"].shift(5) - 1.0).fillna(0.0)
    df["gain_10d"] = (df["adj_close"] / df["adj_close"].shift(10) - 1.0).fillna(0.0)
    df["gain_20d"] = (df["adj_close"] / df["adj_close"].shift(THRUST_WINDOW) - 1.0).fillna(0.0)
    df["gain_50d"] = (df["adj_close"] / df["adj_close"].shift(50) - 1.0).fillna(0.0)

    # Moving averages
    df["sma_20"] = df["adj_close"].rolling(20, min_periods=20).mean()
    df["sma_50"] = df["adj_close"].rolling(50, min_periods=50).mean()
    df["sma_200"] = df["adj_close"].rolling(200, min_periods=200).mean()

    df["above_20_dma"] = (df["adj_close"] > df["sma_20"]).fillna(False)
    df["above_50_dma"] = (df["adj_close"] > df["sma_50"]).fillna(False)
    df["above_200_dma"] = (df["adj_close"] > df["sma_200"]).fillna(False)

    return df

def compute_all_stock_signals(adjusted_df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes signals across all symbols in the dataset.
    """
    results = []
    for symbol, group in adjusted_df.groupby("symbol", sort=False):
        results.append(compute_stock_signals(group))
    if not results:
        return pd.DataFrame()
    return pd.concat(results, ignore_index=True)


def calculate_regime(
    new_52w_highs: int,
    new_52w_lows: int,
    new_6m_highs: int,
    new_6m_lows: int,
    new_1m_highs: int,
    new_1m_lows: int,
    universe_size: int
) -> Tuple[float, str, str]:
    """
    Calculates regime value, classification label, and hex color code.
    Formula:
    composite_net = (NH_52W - NL_52W) + 0.5 * (NH_6M - NL_6M) + 0.25 * (NH_1M - NL_1M)
    regime_score = composite_net / universe_size
    """
    if universe_size <= 0:
        return 0.0, "Neutral", "#64748b"

    net_52w = new_52w_highs - new_52w_lows
    net_6m = new_6m_highs - new_6m_lows
    net_1m = new_1m_highs - new_1m_lows

    composite_net = net_52w + (0.5 * net_6m) + (0.25 * net_1m)
    regime_score = round(composite_net / universe_size, 4)

    if regime_score >= 0.15:
        label = "Strong Advance"
        color = "#0d9488"  # Dark Teal
    elif regime_score >= 0.04:
        label = "Moderate Advance"
        color = "#14b8a6"  # Medium Teal
    elif regime_score > -0.04:
        label = "Neutral / Selective"
        color = "#64748b"  # Slate Gray
    elif regime_score > -0.15:
        label = "Moderate Decline"
        color = "#f97316"  # Clay / Orange
    else:
        label = "Severe Decline"
        color = "#c2410c"  # Deep Clay / Rust

    return regime_score, label, color


def compute_daily_breadth(
    day_df: pd.DataFrame,
    universe_size: int,
    quarantined_count: int = 0
) -> Dict[str, Any]:
    """
    Computes market-wide breadth counts for a single trading session.
    """
    # Exclude quarantined stocks from breadth counts
    clean_df = day_df[~day_df["is_quarantined"]] if "is_quarantined" in day_df.columns else day_df
    active_count = len(clean_df)

    # Advancers, Decliners, Unchanged
    # Based on close vs prev_close
    advancers = int((clean_df["close"] > clean_df["prev_close"]).sum())
    decliners = int((clean_df["close"] < clean_df["prev_close"]).sum())
    unchanged = int((clean_df["close"] == clean_df["prev_close"]).sum())

    # Highs and Lows counts
    nh_1m = int(clean_df["is_new_1m_high"].sum())
    nl_1m = int(clean_df["is_new_1m_low"].sum())
    nh_3m = int(clean_df["is_new_3m_high"].sum())
    nl_3m = int(clean_df["is_new_3m_low"].sum())
    nh_6m = int(clean_df["is_new_6m_high"].sum())
    nl_6m = int(clean_df["is_new_6m_low"].sum())
    nh_52w = int(clean_df["is_new_52w_high"].sum())
    nl_52w = int(clean_df["is_new_52w_low"].sum())

    # Monthly thrust: stocks up >= 25% over 20 sessions minus down >= 25%
    up_25 = int((clean_df["gain_20d"] >= THRUST_THRESHOLD).sum())
    down_25 = int((clean_df["gain_20d"] <= -THRUST_THRESHOLD).sum())
    monthly_thrust = up_25 - down_25

    # Moving averages
    pct_above_20dma = round((clean_df["above_20_dma"].sum() / active_count * 100), 1) if active_count else 0.0
    pct_above_50dma = round((clean_df["above_50_dma"].sum() / active_count * 100), 1) if active_count else 0.0
    pct_above_200dma = round((clean_df["above_200_dma"].sum() / active_count * 100), 1) if active_count else 0.0

    # Regime
    regime_score, regime_label, regime_color = calculate_regime(
        nh_52w, nl_52w, nh_6m, nl_6m, nh_1m, nl_1m, active_count
    )

    date_str = str(clean_df["date"].iloc[0]) if not clean_df.empty else ""

    return {
        "date": date_str,
        "universe_size": active_count,
        "total_universe_capacity": universe_size,
        "quarantined_count": quarantined_count,
        "advancers": advancers,
        "decliners": decliners,
        "unchanged": unchanged,
        "highs_lows": {
            "window_1m": {"highs": nh_1m, "lows": nl_1m, "sessions": WINDOW_1M},
            "window_3m": {"highs": nh_3m, "lows": nl_3m, "sessions": WINDOW_3M},
            "window_6m": {"highs": nh_6m, "lows": nl_6m, "sessions": WINDOW_6M},
            "window_52w": {"highs": nh_52w, "lows": nl_52w, "sessions": WINDOW_52W},
        },
        "monthly_thrust": {
            "value": monthly_thrust,
            "stocks_up_25pct": up_25,
            "stocks_down_25pct": down_25,
            "window_sessions": THRUST_WINDOW,
            "threshold_pct": int(THRUST_THRESHOLD * 100)
        },
        "moving_averages": {
            "pct_above_20dma": pct_above_20dma,
            "pct_above_50dma": pct_above_50dma,
            "pct_above_200dma": pct_above_200dma,
        },
        "regime": {
            "score": regime_score,
            "label": regime_label,
            "color": regime_color,
        }
    }


def compute_industry_clusters(
    day_df: pd.DataFrame,
    industry_map: Dict[str, str],
    min_stocks_threshold: int = 3
) -> List[Dict[str, Any]]:
    """
    Computes industry cluster metrics for industries with at least min_stocks_threshold stocks:
    - share of stocks at 3-month high today
    - share of stocks at 1-month high today
    """
    df = day_df.copy()
    if "is_quarantined" in df.columns:
        df = df[~df["is_quarantined"]]

    df["industry"] = df["symbol"].map(industry_map).fillna("Diversified")

    clusters = []
    for ind_name, group in df.groupby("industry"):
        total_stocks = len(group)
        if total_stocks < min_stocks_threshold:
            continue

        c_3m = int(group["is_new_3m_high"].sum())
        c_1m = int(group["is_new_1m_high"].sum())
        share_3m = round(c_3m / total_stocks * 100.0, 1)
        share_1m = round(c_1m / total_stocks * 100.0, 1)
        avg_gain_20d = round(float(group["gain_20d"].mean() * 100.0), 2)
        median_gain_20d = round(float(group["gain_20d"].median() * 100.0), 2)

        clusters.append({
            "industry": ind_name,
            "total_stocks": total_stocks,
            "count_3m_high": c_3m,
            "share_3m_high": share_3m,
            "count_1m_high": c_1m,
            "share_1m_high": share_1m,
            "avg_gain_20d": avg_gain_20d,
            "median_gain_20d": median_gain_20d,
            "stocks": group["symbol"].tolist(),
        })

    # Sort descending by 3-month high share, then 1-month
    clusters.sort(key=lambda x: (x["share_3m_high"], x["share_1m_high"], x["total_stocks"]), reverse=True)
    return clusters
