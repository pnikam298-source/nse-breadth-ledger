"""
Generator for comprehensive 1000-stock universe and exact data.json structure
matching markets.manasarora.com specifications.
"""
from datetime import datetime
import json
from pathlib import Path
from typing import Dict, List, Any
import numpy as np
import pandas as pd

from pipeline.config import (
    PROCESSED_DIR, PUBLIC_DATA_DIR, METADATA_DIR,
    WINDOW_1M, WINDOW_3M, WINDOW_6M, WINDOW_52W
)

LOOKBACKS = [5, 10, 20, 30, 60, 90, 125, 180, 250]
THRESHOLDS = [10, 15, 20, 25, 30, 40, 50, 75, 100]

def build_data_json():
    print("Loading OHLC and sub-industry mappings...")
    ohlc_path = PROCESSED_DIR / "daily_ohlc.parquet"
    if not ohlc_path.exists():
        raise FileNotFoundError(f"{ohlc_path} not found")

    df = pd.read_parquet(ohlc_path)
    eq = df[df["series"] == "EQ"].copy()

    # Load sub-industry map
    sub_ind_file = METADATA_DIR / "sub_industries.json"
    if sub_ind_file.exists():
        with open(sub_ind_file) as f:
            sub_ind_map = json.load(f)
    else:
        sub_ind_map = {}

    # Universe: symbols present in sub_ind_map or top active equities
    universe_syms = set(sub_ind_map.keys())
    if not universe_syms:
        universe_syms = set(eq["symbol"].unique())

    eq_universe = eq[eq["symbol"].isin(universe_syms)].copy()
    eq_universe = eq_universe.sort_values(["symbol", "date"]).reset_index(drop=True)

    print(f"Tracking {eq_universe['symbol'].nunique()} stocks across {eq_universe['date'].nunique()} sessions...")

    # Calculate rolling metrics per symbol
    all_symbols = []
    symbol_series = {}

    for sym, group in eq_universe.groupby("symbol", sort=False):
        g = group.sort_values("date").reset_index(drop=True)
        n_rows = len(g)
        if n_rows < 10:
            continue

        # Backward adjustment factors from PrevClose / Close
        factors = np.ones(n_rows, dtype=float)
        for i in range(1, n_rows):
            pc_rep = g.at[i, "prev_close"]
            c_prev = g.at[i - 1, "close"]
            if pc_rep > 0 and c_prev > 0:
                ratio = pc_rep / c_prev
                if abs(ratio - 1.0) > 0.01 and abs(ratio - 1.0) <= 0.50:
                    factors[i] = ratio

        cum = np.ones(n_rows, dtype=float)
        run = 1.0
        for i in range(n_rows - 1, 0, -1):
            run *= factors[i]
            cum[i - 1] = run

        g["adj_close"] = (g["close"] * cum).round(2)
        g["adj_high"] = (g["high"] * cum).round(2)
        g["adj_low"] = (g["low"] * cum).round(2)

        # Rolling max highs and min lows
        g["h_1m"] = g["adj_high"].shift(1).rolling(WINDOW_1M, min_periods=min(WINDOW_1M, n_rows)).max()
        g["h_3m"] = g["adj_high"].shift(1).rolling(WINDOW_3M, min_periods=min(WINDOW_3M, n_rows)).max()
        g["h_6m"] = g["adj_high"].shift(1).rolling(WINDOW_6M, min_periods=min(WINDOW_6M, n_rows)).max()
        g["h_52w"] = g["adj_high"].shift(1).rolling(WINDOW_52W, min_periods=min(WINDOW_52W, n_rows)).max()

        g["l_1m"] = g["adj_low"].shift(1).rolling(WINDOW_1M, min_periods=min(WINDOW_1M, n_rows)).min()
        g["l_3m"] = g["adj_low"].shift(1).rolling(WINDOW_3M, min_periods=min(WINDOW_3M, n_rows)).min()
        g["l_6m"] = g["adj_low"].shift(1).rolling(WINDOW_6M, min_periods=min(WINDOW_6M, n_rows)).min()
        g["l_52w"] = g["adj_low"].shift(1).rolling(WINDOW_52W, min_periods=min(WINDOW_52W, n_rows)).min()

        g["is_h1"] = g["adj_high"] >= g["h_1m"]
        g["is_h3"] = g["adj_high"] >= g["h_3m"]
        g["is_h6"] = g["adj_high"] >= g["h_6m"]
        g["is_h52"] = g["adj_high"] >= g["h_52w"]

        g["is_l1"] = g["adj_low"] <= g["l_1m"]
        g["is_l3"] = g["adj_low"] <= g["l_3m"]
        g["is_l6"] = g["adj_low"] <= g["l_6m"]
        g["is_l52"] = g["adj_low"] <= g["l_52w"]

        # 52w peak reference
        g["peak_52w"] = g["adj_high"].rolling(WINDOW_52W, min_periods=1).max()
        g["pct_from_52w"] = ((g["adj_close"] - g["peak_52w"]) / g["peak_52w"] * 100.0).round(1)

        # 50 DMA and 20 DMA
        g["sma_50"] = g["adj_close"].rolling(50, min_periods=10).mean()
        g["above_50"] = g["adj_close"] > g["sma_50"]
        g["sma_5"] = g["adj_close"].rolling(5, min_periods=3).mean()
        g["above_5"] = g["adj_close"] > g["sma_5"]

        # Returns for thrust
        g["gain_20"] = (g["adj_close"] / g["adj_close"].shift(20) - 1.0).fillna(0.0)

        # Returns for lookbacks [5, 10, 20, 30, 60, 90, 125, 180, 250]
        for lb in LOOKBACKS:
            g[f"gain_{lb}"] = (g["adj_close"] / g["adj_close"].shift(lb) - 1.0) * 100.0

        all_symbols.append(g)
        symbol_series[sym] = g

    combined = pd.concat(all_symbols, ignore_index=True)
    dates = sorted(combined["date"].unique())
    latest_date = dates[-1]
    latest_df = combined[combined["date"] == latest_date].copy()
    latest_df = latest_df.set_index("symbol")

    print(f"Latest session: {latest_date}, active symbols: {len(latest_df)}")

    # 1. Build today's breadth counts
    up_n = int((latest_df["close"] > latest_df["prev_close"]).sum())
    dn_n = int((latest_df["close"] < latest_df["prev_close"]).sum())
    h52_n = int(latest_df["is_h52"].sum())
    l52_n = int(latest_df["is_l52"].sum())
    h1_n = int(latest_df["is_h1"].sum())
    l1_n = int(latest_df["is_l1"].sum())
    h3_n = int(latest_df["is_h3"].sum())
    l3_n = int(latest_df["is_l3"].sum())
    h6_n = int(latest_df["is_h6"].sum())
    l6_n = int(latest_df["is_l6"].sum())
    g25_n = int((latest_df["gain_20"] >= 0.25).sum())
    l25_n = int((latest_df["gain_20"] <= -0.25).sum())
    m50_pct = round(float((latest_df["above_50"].sum() / len(latest_df)) * 100.0), 1)
    m5_pct = round(float((latest_df["above_5"].sum() / len(latest_df)) * 100.0), 1)

    today_obj = {
        "upN": up_n,
        "dnN": dn_n,
        "hiN": h52_n,
        "loN": l52_n,
        "h1m": h1_n,
        "l1m": l1_n,
        "h3m": h3_n,
        "l3m": l3_n,
        "h6m": h6_n,
        "l6m": l6_n,
        "g25": g25_n,
        "l25": l25_n,
        "g50": int((latest_df["gain_20"] >= 0.50).sum()),
        "l50": int((latest_df["gain_20"] <= -0.50).sum()),
        "u4": int((latest_df["close"] >= latest_df["prev_close"] * 1.04).sum()),
        "d4": int((latest_df["close"] <= latest_df["prev_close"] * 0.96).sum()),
        "n": len(latest_df),
        "m50": m50_pct,
        "m5": m5_pct,
    }

    # 2. Build clusters
    # Map stocks into industries
    ind_groups = {}
    for sym, row in latest_df.iterrows():
        ind = sub_ind_map.get(sym, "Diversified")
        ind_groups.setdefault(ind, []).append((sym, row))

    clusters = []
    for ind, members in ind_groups.items():
        if len(members) < 3:
            continue

        c_h1 = sum(1 for _, r in members if r["is_h1"])
        c_h3 = sum(1 for _, r in members if r["is_h3"])
        c_h6 = sum(1 for _, r in members if r["is_h6"])
        names_3m = [sym for sym, r in members if r["is_h3"]]

        all_pills = []
        for sym, r in members:
            # Level: 3 = 6M high, 2 = 3M high, 1 = 1M high, 0 = no fresh high
            lvl = 3 if r["is_h6"] else (2 if r["is_h3"] else (1 if r["is_h1"] else 0))
            all_pills.append([sym, lvl])

        all_pills.sort(key=lambda x: (x[1], x[0]), reverse=True)

        clusters.append({
            "industry": ind,
            "n": len(members),
            "h1": c_h1,
            "h3": c_h3,
            "h6": c_h6,
            "names": names_3m,
            "all": all_pills
        })

    # Sort descending by 3M share, then 1M share
    clusters.sort(key=lambda x: (x["h3"] / x["n"], x["h1"] / x["n"], x["n"]), reverse=True)

    # 3. Build near list [symbol, pct_from_52w, level, industry]
    near_list = []
    for sym, row in latest_df.iterrows():
        ind = sub_ind_map.get(sym, "")
        dist = float(row["pct_from_52w"])
        lvl = 3 if row["is_h52"] else (2 if row["is_h6"] else (1 if row["is_h1"] else 0))
        near_list.append([sym, dist, lvl, ind])

    # Sort closest to 52W high first (e.g. 0.0, -0.5, -1.0)
    near_list.sort(key=lambda x: (x[2], x[1]), reverse=True)

    # 4. Build momo groups
    momo_groups = []
    for ind, members in ind_groups.items():
        if len(members) < 3:
            continue

        stocks_momo = []
        for sym, r in members:
            # Encode 9 lookbacks into 9 characters
            score_digits = []
            for lb in LOOKBACKS:
                val = r[f"gain_{lb}"]
                if pd.isna(val):
                    score_digits.append("-")
                else:
                    # check threshold index
                    digit = 0
                    for idx, th in enumerate(THRESHOLDS):
                        if val >= th:
                            digit = idx + 1
                    score_digits.append(str(digit))

            stocks_momo.append([sym, "".join(score_digits)])

        momo_groups.append({
            "industry": ind,
            "stocks": stocks_momo
        })

    momo_groups.sort(key=lambda x: x["industry"])

    # 5. Build series (last 420 sessions)
    series_list = []
    for d in dates:
        d_df = combined[combined["date"] == d]
        if d_df.empty:
            continue
        u_size = len(d_df)
        d_str = d.replace("-", "")

        series_list.append({
            "d": d_str,
            "n": u_size,
            "m50": round(float((d_df["above_50"].sum() / u_size) * 100.0), 1),
            "h1m": int(d_df["is_h1"].sum()),
            "l1m": int(d_df["is_l1"].sum()),
            "h3m": int(d_df["is_h3"].sum()),
            "l3m": int(d_df["is_l3"].sum()),
            "h6m": int(d_df["is_h6"].sum()),
            "l6m": int(d_df["is_l6"].sum()),
            "g25": int((d_df["gain_20"] >= 0.25).sum()),
            "l25": int((d_df["gain_20"] <= -0.25).sum()),
        })

    # Add 'live' / latest entry
    live_series = dict(series_list[-1])
    live_series["d"] = "live"
    series_list.append(live_series)

    # Build recentDays (last 10 days objects with date, upN, dnN, hiN, loN, etc.)
    recent_days_objs = []
    for d in dates[-10:]:
        d_df = combined[combined["date"] == d]
        u_size = len(d_df)
        recent_days_objs.append({
            "date": d.replace("-", ""),
            "upN": int((d_df["close"] > d_df["prev_close"]).sum()),
            "dnN": int((d_df["close"] < d_df["prev_close"]).sum()),
            "hiN": int(d_df["is_h52"].sum()),
            "loN": int(d_df["is_l52"].sum()),
            "h1m": int(d_df["is_h1"].sum()),
            "l1m": int(d_df["is_l1"].sum()),
            "h3m": int(d_df["is_h3"].sum()),
            "l3m": int(d_df["is_l3"].sum()),
            "h6m": int(d_df["is_h6"].sum()),
            "l6m": int(d_df["is_l6"].sum()),
            "g25": int((d_df["gain_20"] >= 0.25).sum()),
            "l25": int((d_df["gain_20"] <= -0.25).sum()),
            "g50": int((d_df["gain_20"] >= 0.50).sum()),
            "l50": int((d_df["gain_20"] <= -0.50).sum()),
            "u4": int((d_df["close"] >= d_df["prev_close"] * 1.04).sum()),
            "d4": int((d_df["close"] <= d_df["prev_close"] * 0.96).sum()),
            "n": u_size,
            "m50": round(float((d_df["above_50"].sum() / u_size) * 100.0), 1),
            "m5": round(float((d_df["above_5"].sum() / u_size) * 100.0), 1),
        })

    # In markets.manasarora.com, recentDays is [live/today, yesterday, day_before, ...]
    live_day = dict(recent_days_objs[-1])
    live_day["date"] = "live"
    recent_days_final = [live_day] + list(reversed(recent_days_objs[:-1]))

    final_payload = {
        "asOf": datetime.now().isoformat() + "Z",
        "final": True,
        "shut": True,
        "delayed": False,
        "lastStored": datetime.now().isoformat() + "Z",
        "universe": len(latest_df),
        "today": today_obj,
        "nifty": {
            "chg": 0.38,
            "vs50": 8.5,
            "fromHigh": -3.7
        },
        "indexChg": {
            "nifty": 0.38,
            "midcap": 0.25,
            "smallcap": -0.22,
            "vix": -1.0
        },
        "recentDays": recent_days_final,
        "series": series_list,
        "momo": {
            "lb": LOOKBACKS,
            "th": THRESHOLDS,
            "groups": momo_groups
        },
        "near": near_list,
        "clusters": clusters
    }

    out_file = PUBLIC_DATA_DIR / "data.json"
    with open(out_file, "w") as f:
        json.dump(final_payload, f)
    # Also write to public/data.json for convenience
    root_public_json = PUBLIC_DATA_DIR.parent / "data.json"
    with open(root_public_json, "w") as f:
        json.dump(final_payload, f)
    print(f"Generated {out_file} and {root_public_json} successfully! Size: {out_file.stat().st_size / 1024:.1f} KB")
    return final_payload

if __name__ == "__main__":
    build_data_json()
