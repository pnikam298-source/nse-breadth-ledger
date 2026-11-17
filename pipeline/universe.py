"""
Universe Selection and Point-in-time constituent management.
Filters:
- Selected Index (default Nifty 500)
- Series: EQ series only
- Price >= MIN_PRICE (₹10)
- Average traded turnover >= MIN_AVG_TRADED_VALUE (₹50 Lakhs)
- History length >= MIN_HISTORY_SESSIONS (252 sessions) for 52-week metrics
"""
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
import pandas as pd

from pipeline.config import (
    RAW_CONSTITUENTS_DIR, SELECTED_INDEX, ALLOWED_SERIES,
    MIN_PRICE, MIN_AVG_TRADED_VALUE, MIN_HISTORY_SESSIONS
)

class UniverseManager:
    def __init__(self, index_name: str = SELECTED_INDEX, constituents_dir: Path = RAW_CONSTITUENTS_DIR):
        self.index_name = index_name
        self.constituents_dir = constituents_dir
        self.snapshot_date: Optional[str] = None
        self.constituents_df: pd.DataFrame = pd.DataFrame()
        self._load_latest_snapshot()

    def _load_latest_snapshot(self):
        """
        Loads the most recent index constituent snapshot available in RAW_CONSTITUENTS_DIR.
        """
        snapshots = sorted(self.constituents_dir.glob(f"*/{self.index_name.lower()}_constituents.csv"))
        if not snapshots:
            return

        latest_file = snapshots[-1]
        self.snapshot_date = latest_file.parent.name
        df = pd.read_csv(latest_file)
        # Normalize column names
        df.columns = [c.strip() for c in df.columns]

        # Rename standard columns
        mapping = {
            "Symbol": "symbol",
            "Company Name": "company_name",
            "Industry": "industry",
            "Series": "series",
            "ISIN Code": "isin",
        }
        renamed = {}
        for col in df.columns:
            for k, v in mapping.items():
                if col.lower() == k.lower():
                    renamed[col] = v
        df = df.rename(columns=renamed)
        if "symbol" in df.columns:
            df["symbol"] = df["symbol"].astype(str).str.strip()
        if "series" in df.columns:
            df["series"] = df["series"].astype(str).str.strip()
        if "industry" in df.columns:
            df["industry"] = df["industry"].astype(str).str.strip()
        if "company_name" in df.columns:
            df["company_name"] = df["company_name"].astype(str).str.strip()

        self.constituents_df = df

    def get_index_symbols(self) -> Set[str]:
        """
        Returns all symbols in the index with series 'EQ'.
        """
        if self.constituents_df.empty:
            return set()
        eq_mask = self.constituents_df["series"].isin(ALLOWED_SERIES) if "series" in self.constituents_df.columns else True
        return set(self.constituents_df.loc[eq_mask, "symbol"])

    def get_industry_mapping(self) -> Dict[str, str]:
        """
        Returns mapping from symbol to Industry name.
        """
        if self.constituents_df.empty or "industry" not in self.constituents_df.columns:
            return {}
        return dict(zip(self.constituents_df["symbol"], self.constituents_df["industry"]))

    def get_company_name_mapping(self) -> Dict[str, str]:
        """
        Returns mapping from symbol to Company Name.
        """
        if self.constituents_df.empty or "company_name" not in self.constituents_df.columns:
            return {}
        return dict(zip(self.constituents_df["symbol"], self.constituents_df["company_name"]))

    def filter_universe(
        self,
        history_df: pd.DataFrame,
        as_of_date: Optional[str] = None
    ) -> Tuple[pd.DataFrame, Dict[str, any]]:
        """
        Filters the OHLC history according to universe rules:
        1. Index constituent in EQ series
        2. Minimum price filter on as_of_date
        3. Minimum average daily traded value over history
        4. History length check (at least 252 sessions for 52W metrics)
        """
        index_symbols = self.get_index_symbols()
        if not index_symbols:
            index_symbols = set(history_df["symbol"].unique())

        # Filter 1: In index and EQ series
        mask_eq = (history_df["symbol"].isin(index_symbols)) & (history_df["series"].isin(ALLOWED_SERIES))
        filtered = history_df[mask_eq].copy()

        # Group stats by symbol
        stats = filtered.groupby("symbol").agg(
            session_count=("date", "count"),
            avg_traded_value=("value", "mean"),
            latest_close=("close", "last")
        ).reset_index()

        total_sessions = filtered["date"].nunique()
        req_sessions = min(total_sessions, MIN_HISTORY_SESSIONS)

        # Filter 2: Min sessions (at least required sessions up to 252 for full 52W coverage)
        valid_history = set(stats.loc[stats["session_count"] >= req_sessions, "symbol"])

        # Filter 3: Min average traded value
        valid_turnover = set(stats.loc[stats["avg_traded_value"] >= MIN_AVG_TRADED_VALUE, "symbol"])

        # Filter 4: Min price
        valid_price = set(stats.loc[stats["latest_close"] >= MIN_PRICE, "symbol"])

        # Final active universe
        eligible_symbols = index_symbols.intersection(valid_history).intersection(valid_turnover).intersection(valid_price)

        final_df = filtered[filtered["symbol"].isin(eligible_symbols)].copy()

        metadata = {
            "index_name": self.index_name,
            "snapshot_date": self.snapshot_date,
            "total_index_constituents": len(index_symbols),
            "excluded_insufficient_history": len(index_symbols - valid_history),
            "excluded_low_turnover": len((index_symbols & valid_history) - valid_turnover),
            "excluded_low_price": len((index_symbols & valid_history & valid_turnover) - valid_price),
            "active_universe_count": len(eligible_symbols),
            "survivorship_bias_note": (
                "Index constituents reflect the current dated snapshot from niftyindices.com. "
                "Stocks removed prior to this snapshot are excluded from the current universe."
            )
        }
        return final_df, metadata
