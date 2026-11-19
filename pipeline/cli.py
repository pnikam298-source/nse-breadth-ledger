"""
CLI Orchestrator for NSE Breadth Ledger Pipeline.
Commands:
- backfill: Ingests constituents, corporate actions, and downloads historical bhavcopies (default 420 sessions)
- run: Runs daily pipeline for target date (or latest available)
- validate: Runs validation gates on current processed dataset
"""
import argparse
from datetime import date, datetime, timedelta
import json
import logging
from pathlib import Path
import sys
from typing import List, Optional
import pandas as pd

from pipeline.config import (
    DEFAULT_BACKFILL_SESSIONS, RAW_BHAVCOPY_DIR, PARQUET_ALL_OHLC,
    PARQUET_UNIVERSE_HISTORY, SELECTED_INDEX, PUBLIC_DATA_DIR
)
from pipeline.raw_store import RawStore
from pipeline.parsers import detect_and_parse
from pipeline.ingest import IngestionManager
from pipeline.universe import UniverseManager
from pipeline.adjust import CorporateActionsManager, PriceAdjuster
from pipeline.metrics import (
    compute_all_stock_signals, compute_daily_breadth,
    compute_industry_clusters, calculate_regime, WINDOW_52W
)
from pipeline.validator import ValidationEngine
from pipeline.publisher import Publisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("NSE_Breadth_Ledger")

class PipelineRunner:
    def __init__(self, index_name: str = SELECTED_INDEX):
        self.index_name = index_name
        self.raw_store = RawStore()
        self.ingest_manager = IngestionManager(self.raw_store)
        self.universe_mgr = UniverseManager(self.index_name)
        self.corp_mgr = CorporateActionsManager()
        self.adjuster = PriceAdjuster(self.corp_mgr)
        self.validator = ValidationEngine()
        self.publisher = Publisher()

    def run_backfill(self, num_sessions: int = DEFAULT_BACKFILL_SESSIONS, end_date: Optional[date] = None):
        """
        Backfills at least num_sessions of trading history.
        Downloads constituents, corporate actions, holidays, and daily bhavcopies.
        """
        target_end = end_date or date.today()
        logger.info(f"Starting backfill for {num_sessions} sessions up to {target_end}...")

        # 1. Ingest constituents, corporate actions, and holidays
        logger.info("Ingesting index constituents from niftyindices.com...")
        try:
            self.ingest_manager.ingest_constituents(self.index_name, target_end)
            self.universe_mgr._load_latest_snapshot()
        except Exception as e:
            logger.warning(f"Could not ingest fresh constituents: {e}")

        logger.info("Ingesting corporate actions from NSE...")
        try:
            self.ingest_manager.ingest_corporate_actions(from_date="01-01-2024")
            self.corp_mgr = CorporateActionsManager()
            self.adjuster = PriceAdjuster(self.corp_mgr)
        except Exception as e:
            logger.warning(f"Could not ingest corporate actions: {e}")

        logger.info("Ingesting holidays from NSE...")
        holidays_set = set()
        try:
            h_path = self.ingest_manager.ingest_holidays()
            with open(h_path, "r") as f:
                h_data = json.load(f)
                for h in h_data.get("CM", []):
                    try:
                        holidays_set.add(datetime.strptime(h["tradingDate"], "%d-%b-%Y").strftime("%Y-%m-%d"))
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Could not ingest holidays: {e}")

        # 2. Iterate backwards across weekdays until num_sessions downloaded
        downloaded_paths = []
        curr = target_end
        attempts = 0
        max_attempts = int(num_sessions * 1.6)

        logger.info(f"Scanning bhavcopies for {num_sessions} trading sessions...")
        while len(downloaded_paths) < num_sessions and attempts < max_attempts:
            if curr.weekday() < 5:  # Weekday
                d_str = curr.strftime("%Y-%m-%d")
                if d_str not in holidays_set:
                    bhav_path = self.ingest_manager.ingest_bhavcopy(curr)
                    if bhav_path:
                        downloaded_paths.append((d_str, bhav_path))
                        if len(downloaded_paths) % 25 == 0:
                            logger.info(f"Progress: {len(downloaded_paths)}/{num_sessions} sessions downloaded...")
                    import time
                    time.sleep(0.1)  # Polite pacing to avoid Akamai rate-limiting
            curr -= timedelta(days=1)
            attempts += 1

        logger.info(f"Successfully collected {len(downloaded_paths)} bhavcopies.")

        # 3. Parse and process all bhavcopies
        self._process_and_publish(holidays_set=holidays_set)

    def run_daily(self, target_date: Optional[date] = None) -> bool:
        """
        Runs the daily pipeline for target_date (or today).
        Downloads today's bhavcopy, processes, runs validation gates, and publishes.
        """
        target = target_date or date.today()
        d_str = target.strftime("%Y-%m-%d")
        logger.info(f"Running daily pipeline for {d_str}...")

        # Ingest today's bhavcopy & index closes
        bhav_path = self.ingest_manager.ingest_bhavcopy(target)
        if not bhav_path:
            logger.warning(f"Bhavcopy for {target} not yet available from NSE or market holiday.")
            return False

        idx_path = self.ingest_manager.ingest_index_closes(target)
        if idx_path:
            logger.info(f"Successfully obtained index closes: {idx_path}")

        logger.info(f"Successfully obtained bhavcopy: {bhav_path}")
        report = self._process_and_publish()
        return report.get("overall_status") in ["PASSED", "PASS", "WARN"]

    def _process_and_publish(self, holidays_set: Optional[set] = None):
        """
        Parses all raw bhavcopies, applies universe filters, adjusts prices backwards,
        computes breadth metrics, runs validation gates, and publishes static JSONs.
        """
        logger.info("Parsing raw bhavcopies from storage...")
        all_files = sorted(RAW_BHAVCOPY_DIR.glob("**/*.*"))
        bhav_files = [f for f in all_files if f.suffix in [".zip", ".csv"] and not f.name.endswith(".tmp")]

        parsed_dfs = []
        for fpath in bhav_files:
            try:
                raw_bytes = self.raw_store.get_file(fpath)
                if not raw_bytes:
                    continue
                df = detect_and_parse(raw_bytes)
                if not df.empty:
                    parsed_dfs.append(df)
            except Exception as e:
                logger.error(f"Error parsing {fpath}: {e}")

        if not parsed_dfs:
            raise RuntimeError("No valid bhavcopy files found to process!")

        combined_ohlc = pd.concat(parsed_dfs, ignore_index=True).drop_duplicates(subset=["date", "symbol", "series"])
        combined_ohlc = combined_ohlc.sort_values(["symbol", "date"]).reset_index(drop=True)

        logger.info(f"Total OHLC records across all symbols and dates: {len(combined_ohlc)}")
        PARQUET_ALL_OHLC.parent.mkdir(parents=True, exist_ok=True)
        combined_ohlc.to_parquet(PARQUET_ALL_OHLC, index=False)

        # Universe filtering
        logger.info(f"Filtering universe according to {self.index_name} rules...")
        universe_df, u_meta = self.universe_mgr.filter_universe(combined_ohlc)
        universe_symbols = set(universe_df["symbol"].unique())
        logger.info(f"Active universe symbols: {len(universe_symbols)} (out of {u_meta['total_index_constituents']})")

        # Adjust prices backwards & check corporate actions
        logger.info("Applying backwards price adjustment & corporate action verification...")
        adjusted_df, quarantined_records = self.adjuster.adjust_history(universe_df)

        # Compute stock signals (rolling windows, highs/lows, thrust, DMAs)
        logger.info("Computing quantitative metrics and rolling signals...")
        signaled_df = compute_all_stock_signals(adjusted_df)
        signaled_df.to_parquet(PARQUET_UNIVERSE_HISTORY, index=False)

        # Get unique dates in ascending order
        trading_dates = sorted(signaled_df["date"].unique())
        if not trading_dates:
            raise RuntimeError("No trading dates found in processed universe history!")

        latest_date = trading_dates[-1]
        prior_date = trading_dates[-2] if len(trading_dates) > 1 else None
        logger.info(f"Latest trading session: {latest_date} (Prior: {prior_date})")

        # Extract latest day and prior day dataframes
        latest_day_df = signaled_df[signaled_df["date"] == latest_date].copy()
        prior_day_df = signaled_df[signaled_df["date"] == prior_date].copy() if prior_date else None

        # Compute breadth metrics for latest session
        latest_breadth = compute_daily_breadth(
            latest_day_df,
            universe_size=len(universe_symbols),
            quarantined_count=len(quarantined_records)
        )

        # Compute industry clusters for latest session
        ind_map = self.universe_mgr.get_industry_mapping()
        ind_clusters = compute_industry_clusters(latest_day_df, ind_map, min_stocks_threshold=3)

        # Compute last 60 sessions heatmap
        heatmap_dates = trading_dates[-60:]
        heatmap_payload = []
        for d in heatmap_dates:
            d_df = signaled_df[signaled_df["date"] == d]
            d_breadth = compute_daily_breadth(d_df, universe_size=len(universe_symbols))
            hl = d_breadth["highs_lows"]
            heatmap_payload.append({
                "date": d,
                "regime_score": d_breadth["regime"]["score"],
                "regime_label": d_breadth["regime"]["label"],
                "color": d_breadth["regime"]["color"],
                "new_52w_highs": hl["window_52w"]["highs"],
                "new_52w_lows": hl["window_52w"]["lows"],
                "new_1m_highs": hl["window_1m"]["highs"],
                "new_1m_lows": hl["window_1m"]["lows"],
                "monthly_thrust": d_breadth["monthly_thrust"]["value"],
                "advancers": d_breadth["advancers"],
                "decliners": d_breadth["decliners"],
            })

        # Compute last 10 sessions table
        sessions_10_dates = list(reversed(trading_dates[-10:]))
        sessions_10_payload = []
        for d in sessions_10_dates:
            d_df = signaled_df[signaled_df["date"] == d]
            d_breadth = compute_daily_breadth(d_df, universe_size=len(universe_symbols))
            hl = d_breadth["highs_lows"]
            sessions_10_payload.append({
                "date": d,
                "universe_size": d_breadth["universe_size"],
                "advancers": d_breadth["advancers"],
                "decliners": d_breadth["decliners"],
                "unchanged": d_breadth["unchanged"],
                "new_52w_highs": hl["window_52w"]["highs"],
                "new_52w_lows": hl["window_52w"]["lows"],
                "monthly_thrust": d_breadth["monthly_thrust"]["value"],
                "regime_score": d_breadth["regime"]["score"],
                "regime_label": d_breadth["regime"]["label"],
            })

        # Compute Highs Scanner / Explorer list & Stocks payload
        name_map = self.universe_mgr.get_company_name_mapping()
        highs_scanner_payload = []
        stocks_payload = []
        for _, row in latest_day_df.iterrows():
            sym = row["symbol"]
            highs_scanner_payload.append({
                "symbol": sym,
                "name": name_map.get(sym, sym),
                "industry": ind_map.get(sym, "Diversified"),
                "close": float(row["close"]),
                "high_52w": float(row["high_52w"]),
                "low_52w": float(row["low_52w"]),
                "pct_from_52w_high": float(row["pct_from_52w_high"]),
                "is_new_52w_high": bool(row["is_new_52w_high"]),
                "is_new_6m_high": bool(row["is_new_6m_high"]),
                "is_new_1m_high": bool(row["is_new_1m_high"]),
                "gain_20d": float(round(row["gain_20d"] * 100.0, 2)),
            })

            # Format for frontend template
            stocks_payload.append({
                "s": sym,
                "n": name_map.get(sym, sym),
                "i": ind_map.get(sym, "Diversified"),
                "c": float(row["close"]),
                "h52": float(row["high_52w"]),
                "l52": float(row["low_52w"]),
                "f": {
                    "h1": bool(row["is_new_1m_high"]),
                    "h3": bool(row["is_new_3m_high"]),
                    "h6": bool(row["is_new_6m_high"]),
                    "h52": bool(row["is_new_52w_high"]),
                    "l1": bool(row["is_new_1m_low"]),
                    "l6": bool(row["is_new_6m_low"]),
                    "l52": bool(row["is_new_52w_low"]),
                },
                "g": {
                    "5": round(float(row.get("gain_5d", 0.0) * 100.0), 2),
                    "10": round(float(row.get("gain_10d", 0.0) * 100.0), 2),
                    "20": round(float(row["gain_20d"] * 100.0), 2),
                    "50": round(float(row.get("gain_50d", 0.0) * 100.0), 2),
                }
            })
        # Sort by pct_from_52w_high ascending (closest to 52W high first)
        highs_scanner_payload.sort(key=lambda x: x["pct_from_52w_high"])

        # Prepare all payloads for validation
        output_payloads = {
            "latest.json": {
                "as_of_date": latest_date,
                "as_of_timestamp": datetime.now().isoformat(),
                "data_status": "ok",
                "universe_size": latest_breadth["universe_size"],
                "quarantined_count": len(quarantined_records),
                "index_name": self.index_name,
                "total_universe_capacity": len(universe_symbols),
                "validation_passed": True,
                "disclaimer": "Market information only"
            },
            "breadth.json": latest_breadth,
            "heatmap_60.json": heatmap_payload,
            "industries.json": ind_clusters,
            "highs_52w.json": highs_scanner_payload,
            "sessions_10.json": sessions_10_payload,
        }

        # Run Validation Gates
        logger.info("Executing 8 Validation Gates...")
        validation_report = self.validator.validate_all_gates(
            as_of_date=latest_date,
            current_bhav_df=latest_day_df,
            prior_bhav_df=prior_day_df,
            universe_history_df=signaled_df,
            universe_symbols=universe_symbols,
            quarantined_records=quarantined_records,
            daily_breadth=latest_breadth,
            output_payloads=output_payloads,
            holidays_set=holidays_set
        )

        logger.info(f"Validation Result: {validation_report['overall_status']}")
        for gate_name, gate_info in validation_report["gates"].items():
            status_tag = "PASS" if gate_info.get("passed") else "FAIL"
            logger.info(f" - [{status_tag}] {gate_name}: {gate_info.get('message', '')}")

        # Publish
        logger.info("Publishing outputs to public/data/...")
        published = self.publisher.publish_all(
            as_of_date=latest_date,
            breadth_payload=latest_breadth,
            heatmap_payload=heatmap_payload,
            industries_payload=ind_clusters,
            highs_scanner_payload=highs_scanner_payload,
            sessions_10_payload=sessions_10_payload,
            stocks_payload=stocks_payload,
            validation_report=validation_report,
            universe_size=latest_breadth["universe_size"],
            quarantined_count=len(quarantined_records),
            index_name=self.index_name
        )

        if published:
            logger.info("All files validated and published successfully!")
            # Also generate comprehensive 1000-stock data.json matching exact dashboard spec
            try:
                from pipeline.manas_generator import build_data_json
                build_data_json()
                logger.info("Successfully refreshed 1000-stock dashboard data.json!")
            except Exception as e:
                logger.warning(f"Could not build data.json: {e}")
        else:
            logger.error("Validation failed! Publishing aborted; live data preserved; status marked delayed.")

        return validation_report

def main():
    parser = argparse.ArgumentParser(description="NSE Breadth Ledger Data Pipeline CLI")
    subparsers = parser.add_subparsers(dest="command", help="Subcommand to run")

    backfill_p = subparsers.add_parser("backfill", help="Backfill historical trading sessions")
    backfill_p.add_argument("--sessions", type=int, default=DEFAULT_BACKFILL_SESSIONS, help="Number of sessions to backfill")
    backfill_p.add_argument("--index", type=str, default=SELECTED_INDEX, help="Index name (default NIFTY_500)")

    run_p = subparsers.add_parser("run", help="Run daily pipeline update")
    run_p.add_argument("--index", type=str, default=SELECTED_INDEX, help="Index name")

    args = parser.parse_args()
    runner = PipelineRunner(index_name=getattr(args, "index", SELECTED_INDEX))

    if args.command == "backfill":
        runner.run_backfill(num_sessions=args.sessions)
    elif args.command == "run":
        success = runner.run_daily()
        if not success:
            sys.exit(1)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
