"""
Corporate Action Adjustment and Quarantine Module.
Derives adjustment factors from the gap between each day's NSE PrevClose and prior day's Close.
Cross-checks against corporate actions table (splits, bonuses, rights, demergers).
Applies factors backwards to build adjusted OHLC.
Quarantines any stock with an unexplained jump (> 20%).
"""
import json
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
import pandas as pd
import numpy as np

from pipeline.config import RAW_CORP_ACTIONS_DIR, MAX_UNEXPLAINED_GAP_PCT

class CorporateActionsManager:
    def __init__(self, corp_actions_dir: Path = RAW_CORP_ACTIONS_DIR):
        self.corp_actions_dir = corp_actions_dir
        self.actions_df: pd.DataFrame = self._load_actions()

    def _load_actions(self) -> pd.DataFrame:
        files = sorted(self.corp_actions_dir.glob("corp_actions_*.json"))
        if not files:
            return pd.DataFrame()
        latest_file = files[-1]
        try:
            with open(latest_file, "r") as f:
                data = json.load(f)
            df = pd.DataFrame(data)
            if df.empty:
                return df
            # Standardize exDate to YYYY-MM-DD
            df["symbol"] = df["symbol"].astype(str).str.strip()
            df["exDate"] = pd.to_datetime(df["exDate"], format="%d-%b-%Y", errors="coerce").dt.strftime("%Y-%m-%d")
            df["subject"] = df["subject"].astype(str).fillna("")
            return df
        except Exception:
            return pd.DataFrame()

    def has_action(self, symbol: str, date_str: str) -> Tuple[bool, Optional[str]]:
        """
        Checks whether symbol had a corporate action on or near date_str (+/- 2 days window).
        """
        if self.actions_df.empty:
            # If no corporate actions loaded, return False
            return False, None

        sym_mask = (self.actions_df["symbol"] == symbol)
        if not sym_mask.any():
            return False, None

        sym_actions = self.actions_df[sym_mask]
        target_dt = pd.to_datetime(date_str)
        # Search window of 2 days to account for holiday/settlement shifts
        for _, row in sym_actions.iterrows():
            if pd.isna(row["exDate"]):
                continue
            act_dt = pd.to_datetime(row["exDate"])
            if abs((target_dt - act_dt).days) <= 2:
                return True, row["subject"]
        return False, None


class PriceAdjuster:
    def __init__(self, corp_manager: Optional[CorporateActionsManager] = None):
        self.corp_manager = corp_manager or CorporateActionsManager()
        self.quarantine_log: List[dict] = []

    def adjust_history(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[dict]]:
        """
        Adjusts OHLC history backwards per symbol.
        Returns (adjusted_df, quarantine_records).
        """
        df = df.copy()
        df["date"] = df["date"].astype(str)
        df = df.sort_values(["symbol", "date"]).reset_index(drop=True)

        quarantined_records = []
        adjusted_dfs = []

        for symbol, group in df.groupby("symbol", sort=False):
            adj_group, q_records = self._adjust_symbol_series(symbol, group)
            quarantined_records.extend(q_records)
            adjusted_dfs.append(adj_group)

        self.quarantine_log = quarantined_records
        if not adjusted_dfs:
            return df, []

        result_df = pd.concat(adjusted_dfs, ignore_index=True)
        return result_df, quarantined_records

    def _adjust_symbol_series(self, symbol: str, group: pd.DataFrame) -> Tuple[pd.DataFrame, List[dict]]:
        group = group.copy().sort_values("date").reset_index(drop=True)
        n = len(group)
        group["adj_factor"] = 1.0
        group["is_quarantined"] = False
        group["quarantine_reason"] = ""

        q_records = []

        if n <= 1:
            group["cum_factor"] = 1.0
            group["adj_open"] = group["open"]
            group["adj_high"] = group["high"]
            group["adj_low"] = group["low"]
            group["adj_close"] = group["close"]
            return group, []

        factors = np.ones(n, dtype=float)

        for i in range(1, n):
            prev_close_actual = group.at[i - 1, "close"]
            prev_close_reported = group.at[i, "prev_close"]
            curr_date = group.at[i, "date"]

            if prev_close_actual > 0 and prev_close_reported > 0:
                gap_ratio = prev_close_reported / prev_close_actual
                gap_pct = abs(gap_ratio - 1.0)

                # An adjustment event occurred if gap > 1%
                if gap_pct > 0.01:
                    has_ca, subject = self.corp_manager.has_action(symbol, curr_date)
                    if has_ca:
                        # Legitimate corporate action verified
                        factors[i] = gap_ratio
                    else:
                        # Move > 20% without explanation -> QUARANTINE
                        if gap_pct > MAX_UNEXPLAINED_GAP_PCT:
                            group.at[i, "is_quarantined"] = True
                            reason = f"Unexplained price gap of {gap_pct*100:.1f}% (PrevClose {prev_close_reported} vs prior Close {prev_close_actual}) with no corporate action"
                            group.at[i, "quarantine_reason"] = reason
                            q_records.append({
                                "date": curr_date,
                                "symbol": symbol,
                                "close_prior": float(prev_close_actual),
                                "prev_close_reported": float(prev_close_reported),
                                "gap_pct": float(round(gap_pct * 100, 2)),
                                "reason": reason,
                            })
                            # In quarantine, we do not distort factor
                            factors[i] = 1.0
                        else:
                            # Minor gap (< 20%, e.g. normal tick discrepancy or rounding): apply ratio
                            factors[i] = gap_ratio

        # Compute cumulative backward adjustment factor
        # cum_factor[t] = product of factors[s] for s > t
        cum_factors = np.ones(n, dtype=float)
        running = 1.0
        for i in range(n - 1, 0, -1):
            running *= factors[i]
            cum_factors[i - 1] = running

        group["cum_factor"] = cum_factors
        group["adj_open"] = (group["open"] * cum_factors).round(2)
        group["adj_high"] = (group["high"] * cum_factors).round(2)
        group["adj_low"] = (group["low"] * cum_factors).round(2)
        group["adj_close"] = (group["close"] * cum_factors).round(2)

        return group, q_records
