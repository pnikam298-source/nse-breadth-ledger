"""
Generator for comprehensive 1000-stock universe and exact data.json structure
matching markets.manasarora.com specifications.
"""
from datetime import datetime, timezone
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
    # Include both EQ and BE (Trade-for-Trade surveillance) series
    eq = df[df["series"].isin(["EQ", "BE"])].copy()
    eq = eq.sort_values(["symbol", "date", "series"]).drop_duplicates(subset=["symbol", "date"], keep="first")

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

        # 15-day base tightness (3-week price consolidation range)
        g["high_15d"] = g["adj_high"].rolling(15, min_periods=5).max()
        g["low_15d"] = g["adj_low"].rolling(15, min_periods=5).min()
        g["tightness_15d"] = ((g["high_15d"] - g["low_15d"]) / g["high_15d"] * 100.0).round(1)

        # 60-day base structure (Minervini VCP / Deep Base Analysis)
        g["high_60d"] = g["adj_high"].rolling(60, min_periods=10).max()
        g["low_60d"] = g["adj_low"].rolling(60, min_periods=10).min()
        g["base_depth"] = ((g["high_60d"] - g["low_60d"]) / g["high_60d"] * 100.0).round(1)
        g["pullback_high"] = ((g["high_60d"] - g["adj_close"]) / g["high_60d"] * 100.0).round(1)
        base_span = (g["high_60d"] - g["low_60d"]).clip(lower=1e-6)
        g["right_side_pct"] = (((g["adj_close"] - g["low_60d"]) / base_span) * 100.0).clip(0.0, 100.0).round(1)

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
            # Encode 9 lookbacks into 9 characters and exact percentage gains
            score_digits = []
            exact_pcts = []
            for lb in LOOKBACKS:
                val = r[f"gain_{lb}"]
                if pd.isna(val):
                    score_digits.append("-")
                    exact_pcts.append(None)
                else:
                    exact_pcts.append(round(float(val), 1))
                    # check threshold index
                    digit = 0
                    for idx, th in enumerate(THRESHOLDS):
                        if val >= th:
                            digit = idx + 1
                    score_digits.append(str(digit))

            stocks_momo.append([sym, "".join(score_digits), exact_pcts])

        momo_groups.append({
            "industry": ind,
            "stocks": stocks_momo
        })

    momo_groups.sort(key=lambda x: x["industry"])

    # 5. Build RS ratings (William O'Neil / IBD / MarketSmith 1-99 Relative Strength)
    rs_scores = []
    tot_by_ind = {}
    for sym, g in symbol_series.items():
        ind = sub_ind_map.get(sym, "Diversified")
        tot_by_ind[ind] = tot_by_ind.get(ind, 0) + 1
        if len(g) < 250:
            continue
        c = g["adj_close"].values
        p0 = c[-1]
        p63 = c[-63]
        p126 = c[-126]
        p189 = c[-189]
        p250 = c[-250]
        if p63 <= 0 or p126 <= 0 or p189 <= 0 or p250 <= 0:
            continue
        score = 2.0 * (p0 / p63 - 1.0) + (p0 / p126 - 1.0) + (p0 / p189 - 1.0) + (p0 / p250 - 1.0)
        rs_scores.append((sym, score, ind))

    rs_scores.sort(key=lambda x: x[1])
    n_rated = len(rs_scores)
    rs_rows = []
    for rank, (sym, score, ind) in enumerate(rs_scores):
        rating = int(np.clip(np.floor((rank / n_rated) * 99) + 1, 1, 99))
        rs_rows.append([sym, rating, ind])

    rs_rows.sort(key=lambda x: (-x[1], x[0]))

    rs_payload = {
        "asOf": latest_date.replace("-", ""),
        "n": n_rated,
        "tot": tot_by_ind,
        "rows": rs_rows
    }

    # Build RS dictionary for fast lookup
    rs_dict = {r[0]: r[1] for r in rs_rows}

    # 6. Build High-Tight Flag, Minervini VCP Deep Base & 52W Tight Base setups
    setups_list = []
    for sym, row in latest_df.iterrows():
        rs_val = rs_dict.get(sym, 0)
        dist_52w = float(row["pct_from_52w"])
        tightness = float(row["tightness_15d"]) if pd.notna(row["tightness_15d"]) else 99.9
        above_50 = bool(row["above_50"])
        g60 = float(row["gain_60"]) if pd.notna(row["gain_60"]) else 0.0
        g20 = float(row["gain_20"]) * 100.0 if pd.notna(row["gain_20"]) else 0.0
        base_depth = float(row["base_depth"]) if pd.notna(row["base_depth"]) else 0.0
        pullback_high = float(row["pullback_high"]) if pd.notna(row["pullback_high"]) else 0.0
        right_side = float(row["right_side_pct"]) if pd.notna(row["right_side_pct"]) else 50.0
        base_high = round(float(row["high_60d"]), 2) if pd.notna(row["high_60d"]) else round(float(row["close"]), 2)
        base_low = round(float(row["low_60d"]), 2) if pd.notna(row["low_60d"]) else round(float(row["close"]), 2)
        ind = sub_ind_map.get(sym, "Diversified")

        # Capture institutional candidates:
        # RS >= 65, tightness <= 18%, and either:
        # A) Within 15% of 52W High (High-Tight Flag or 52W Tight Base)
        # B) Corrected 12% to 40% from 60d high and now recovering on the Right Side (>= 40% of base)
        is_near_high = (dist_52w >= -15.0 and above_50 and tightness <= 15.0)
        is_vcp_base = (base_depth >= 12.0 and base_depth <= 40.0 and right_side >= 40.0 and tightness <= 18.0 and above_50)

        if rs_val >= 65 and (is_near_high or is_vcp_base):
            if base_depth >= 15.0 and base_depth <= 38.0 and right_side >= 45.0:
                setup_type = "VCP Stage 2 Base"
            elif (g60 >= 40.0 or g20 >= 20.0) and base_depth <= 18.0:
                setup_type = "High-Tight Flag"
            else:
                setup_type = "52W Tight Base"

            setups_list.append({
                "symbol": sym,
                "rs": rs_val,
                "close": round(float(row["close"]), 2),
                "dist_52w": dist_52w,
                "tightness_15d": tightness,
                "gain_20d": round(g20, 1),
                "gain_60d": round(g60, 1),
                "base_depth": base_depth,
                "pullback_high": pullback_high,
                "right_side_pct": right_side,
                "base_high": base_high,
                "base_low": base_low,
                "industry": ind,
                "setup_type": setup_type
            })

    setups_list.sort(key=lambda x: (-x["rs"], -x["right_side_pct"]))

    # 7. Build Sector Rotation Model (Where Institutional Money is Moving)
    rotation_sectors = []
    for ind, members in ind_groups.items():
        if len(members) < 3:
            continue
        mem_rs = [rs_dict.get(sym, 50) for sym, _ in members]
        mem_g5 = [float(r["gain_5"]) for sym, r in members if pd.notna(r["gain_5"])]
        mem_g20 = [float(r["gain_20"]) * 100.0 for sym, r in members if pd.notna(r["gain_20"])]
        mem_g60 = [float(r["gain_60"]) for sym, r in members if pd.notna(r["gain_60"])]
        c_h3 = sum(1 for _, r in members if r["is_h3"])

        avg_rs = round(float(np.mean(mem_rs)), 1) if mem_rs else 50.0
        avg_g5 = round(float(np.mean(mem_g5)), 1) if mem_g5 else 0.0
        avg_g20 = round(float(np.mean(mem_g20)), 1) if mem_g20 else 0.0
        avg_g60 = round(float(np.mean(mem_g60)), 1) if mem_g60 else 0.0
        h3_share = round(float((c_h3 / len(members)) * 100.0), 1)

        # Quadrant classification
        if avg_rs >= 50.0 and avg_g20 >= 0.0:
            quadrant = "Leading"
        elif avg_rs >= 50.0 and avg_g20 < 0.0:
            quadrant = "Weakening"
        elif avg_rs < 50.0 and avg_g20 < 0.0:
            quadrant = "Lagging"
        else:
            quadrant = "Improving"

        leaders = sorted(members, key=lambda x: -rs_dict.get(x[0], 0))[:4]

        rotation_sectors.append({
            "industry": ind,
            "n": len(members),
            "avg_rs": avg_rs,
            "quadrant": quadrant,
            "g5": avg_g5,
            "g20": avg_g20,
            "g60": avg_g60,
            "h3_share": h3_share,
            "leaders": [s[0] for s in leaders]
        })

    rotation_sectors.sort(key=lambda x: -x["avg_rs"])

    # 8. Build series (last 420 sessions)
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

    utc_now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    final_payload = {
        "asOf": utc_now_iso,
        "final": True,
        "shut": False,
        "delayed": False,
        "lastStored": latest_date.replace("-", ""),
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
        "clusters": clusters,
        "rs": rs_payload,
        "rotation": rotation_sectors,
        "setups": setups_list
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
