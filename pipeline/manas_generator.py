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
    PROCESSED_DIR, PUBLIC_DATA_DIR, METADATA_DIR, RAW_INDICES_DIR, PARQUET_NIFTY_HISTORY,
    WINDOW_1M, WINDOW_3M, WINDOW_6M, WINDOW_52W
)

LOOKBACKS = [5, 10, 20, 30, 60, 90, 125, 180, 250]
THRESHOLDS = [10, 15, 20, 25, 30, 40, 50, 75, 100]

def compute_official_indices_payload(latest_date: str) -> Dict[str, Any]:
    """
    Extracts authentic official NSE index changes and computes NIFTY 50 technical positioning.
    Primary source: data/raw/indices/{year}/ind_close_all_{ddmmyyyy}.csv
    Secondary source: calculation from historical Nifty parquet and constituents
    """
    dt_obj = datetime.strptime(latest_date, "%Y-%m-%d").date()
    d_str = dt_obj.strftime("%d%m%Y")
    year_str = str(dt_obj.year)

    idx_file = RAW_INDICES_DIR / year_str / f"ind_close_all_{d_str}.csv"
    
    # Attempt download if not locally available
    if not idx_file.exists():
        try:
            from pipeline.ingest import IngestionManager
            IngestionManager().ingest_index_closes(dt_obj)
        except Exception:
            pass

    nifty_chg = 0.0
    midcap_chg = 0.0
    smallcap_chg = 0.0
    vix_chg = 0.0
    nifty_close = None

    if idx_file.exists():
        try:
            idf = pd.read_csv(idx_file)
            idf.columns = [c.strip() for c in idf.columns]
            idf["Index Name"] = idf["Index Name"].astype(str).str.strip()

            def get_idx_stat(name):
                row = idf[idf["Index Name"].str.lower() == name.lower()]
                if not row.empty:
                    c_val = row.iloc[0].get("Change(%)", 0.0)
                    cls_val = row.iloc[0].get("Closing Index Value", None)
                    try:
                        c_num = float(c_val)
                    except:
                        c_num = 0.0
                    try:
                        cls_num = float(cls_val) if cls_val is not None else None
                    except:
                        cls_num = None
                    return c_num, cls_num
                return 0.0, None

            nifty_chg, nifty_close = get_idx_stat("Nifty 50")
            midcap_chg, _ = get_idx_stat("NIFTY Midcap 100")
            if midcap_chg == 0.0:
                midcap_chg, _ = get_idx_stat("Nifty Midcap 150")
            smallcap_chg, _ = get_idx_stat("NIFTY Smallcap 100")
            if smallcap_chg == 0.0:
                smallcap_chg, _ = get_idx_stat("Nifty Smallcap 250")
            vix_chg, _ = get_idx_stat("India VIX")
        except Exception as e:
            print(f"Warning: Error parsing index file {idx_file}: {e}")

    # Compute Nifty 50 vs50 and fromHigh using Nifty historical parquet
    vs50 = 0.0
    from_high = 0.0
    try:
        if PARQUET_NIFTY_HISTORY.exists():
            nh_df = pd.read_parquet(PARQUET_NIFTY_HISTORY)
            if nifty_close and (latest_date not in nh_df["date"].values):
                nh_df = pd.concat([nh_df, pd.DataFrame([{"date": latest_date, "close": nifty_close}])], ignore_index=True)
                nh_df.to_parquet(PARQUET_NIFTY_HISTORY, index=False)
            nh_df = nh_df.sort_values("date").reset_index(drop=True)
            nh_df["sma50"] = nh_df["close"].rolling(50, min_periods=20).mean()
            nh_df["high52w"] = nh_df["close"].rolling(252, min_periods=50).max()
            
            sub = nh_df[nh_df["date"] <= latest_date]
            if not sub.empty:
                last_r = sub.iloc[-1]
                c_val = float(last_r["close"])
                s50 = float(last_r["sma50"])
                h52 = float(last_r["high52w"])
                vs50 = round(((c_val - s50) / s50) * 100, 1) if s50 > 0 else 0.0
                from_high = round(((c_val - h52) / h52) * 100, 1) if h52 > 0 else 0.0
                if nifty_chg == 0.0 and len(sub) > 1:
                    prev_c = float(sub.iloc[-2]["close"])
                    nifty_chg = round(((c_val - prev_c) / prev_c) * 100, 2)
    except Exception as e:
        print(f"Warning: Error computing Nifty historical metrics: {e}")

    return {
        "nifty": {
            "chg": nifty_chg,
            "vs50": vs50,
            "fromHigh": from_high
        },
        "indexChg": {
            "nifty": nifty_chg,
            "midcap": midcap_chg,
            "smallcap": smallcap_chg,
            "vix": vix_chg
        }
    }

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
        g["dist_from_floor"] = (((g["adj_close"] - g["low_15d"]) / g["low_15d"].clip(lower=1e-6)) * 100.0).round(1)

        # 50 DMA, 50 EMA and 20 DMA
        g["sma_50"] = g["adj_close"].rolling(50, min_periods=10).mean()
        g["above_50"] = g["adj_close"] > g["sma_50"]
        g["ema_50"] = g["adj_close"].ewm(span=50, adjust=False).mean()
        g["pct_ema50"] = ((g["adj_close"] - g["ema_50"]) / g["ema_50"] * 100.0).round(1)
        g["sma_5"] = g["adj_close"].rolling(5, min_periods=3).mean()
        g["above_5"] = g["adj_close"] > g["sma_5"]

        # 30-Day Average Volume
        g["vol_30d"] = g["volume"].rolling(30, min_periods=5).mean().fillna(0.0)

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

    # 6. Build Institutional Volume Surge & RVOL Expansion Scanner
    # Criteria: NSE Price >= 30, 1D Gain > 3%, 30D Avg Vol > 200K, RVOL 1D > 3.0
    volume_surge_list = []
    for sym, row in latest_df.iterrows():
        close_p = round(float(row["close"]), 2)
        prev_close_p = round(float(row["prev_close"]), 2) if row["prev_close"] > 0 else close_p
        pct_chg = round(((close_p - prev_close_p) / prev_close_p) * 100.0, 2)
        vol = int(row["volume"]) if pd.notna(row["volume"]) else 0
        vol_30d = int(round(float(row["vol_30d"]))) if ("vol_30d" in row and pd.notna(row["vol_30d"])) else 0
        rvol = round(float(vol / (vol_30d if vol_30d > 0 else 1)), 2)
        val_cr = round(float(row["value"] / 1e7), 2) if ("value" in row and pd.notna(row["value"])) else round(float(close_p * vol / 1e7), 2)
        rs_val = rs_dict.get(sym, 50)
        ind = sub_ind_map.get(sym, "Diversified")

        # Candidate pool: Price >= 20, RVOL >= 1.5, 1D Gain >= 1.0%, 30D Vol >= 50,000
        if close_p >= 20.0 and rvol >= 1.5 and pct_chg >= 1.0 and vol_30d >= 50000:
            volume_surge_list.append({
                "symbol": sym,
                "close": close_p,
                "prev_close": prev_close_p,
                "pct_chg_1d": pct_chg,
                "volume": vol,
                "vol_30d": vol_30d,
                "rvol_1d": rvol,
                "value_cr": val_cr,
                "rs": rs_val,
                "industry": ind,
            })

    volume_surge_list.sort(key=lambda x: -x["rvol_1d"])

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

    # Compute official index metrics (Nifty 50, Midcap, Smallcap, India VIX)
    idx_payload = compute_official_indices_payload(latest_date)

    utc_now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    final_payload = {
        "asOf": utc_now_iso,
        "final": True,
        "shut": False,
        "delayed": False,
        "lastStored": latest_date.replace("-", ""),
        "universe": len(latest_df),
        "today": today_obj,
        "nifty": idx_payload["nifty"],
        "indexChg": idx_payload["indexChg"],
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
        "volume_surge": volume_surge_list
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
