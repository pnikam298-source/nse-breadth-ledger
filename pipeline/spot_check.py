"""
Secondary source spot-check validator.
Verifies closing prices of benchmark stocks against Yahoo Finance for the target date.
"""
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
import yfinance as yf

from pipeline.config import SPOT_CHECK_SYMBOLS, SPOT_CHECK_TOLERANCE_PCT

class SpotChecker:
    def __init__(self, symbols: Optional[List[str]] = None, tolerance: float = SPOT_CHECK_TOLERANCE_PCT):
        self.symbols = symbols or SPOT_CHECK_SYMBOLS
        self.tolerance = tolerance

    def verify_prices(self, as_of_date: str, bhav_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Spot-checks close prices for benchmark stocks against Yahoo Finance.
        Returns check summary with pass/fail and per-symbol deviations.
        """
        results = {
            "date": as_of_date,
            "tolerance_pct": round(self.tolerance * 100, 2),
            "passed": True,
            "symbols_checked": [],
            "max_deviation_pct": 0.0,
            "errors": [],
        }

        # Filter bhavcopy for spot symbols in EQ series
        bhav_sub = bhav_df[(bhav_df["symbol"].isin(self.symbols)) & (bhav_df["series"] == "EQ")]
        bhav_map = dict(zip(bhav_sub["symbol"], bhav_sub["close"]))

        # Query yfinance with .NS suffix
        yf_tickers = [f"{s}.NS" for s in self.symbols]
        try:
            # Download recent 5 days
            yf_data = yf.download(yf_tickers, period="5d", progress=False)
            if yf_data.empty:
                results["passed"] = True
                results["warning"] = "Secondary source returned empty (offline or temporary rate limit). Spot check skipped with warning."
                return results

            # Extract Close Series for date
            closes_df = yf_data["Close"]
            # Look for matching date in index (format YYYY-MM-DD)
            match_row = None
            for idx in closes_df.index:
                idx_str = pd.to_datetime(idx).strftime("%Y-%m-%d")
                if idx_str == as_of_date:
                    match_row = closes_df.loc[idx]
                    break

            if match_row is None:
                # If exact date not found yet (e.g. yfinance has not updated evening close), use last row
                last_idx_str = pd.to_datetime(closes_df.index[-1]).strftime("%Y-%m-%d")
                if last_idx_str == as_of_date:
                    match_row = closes_df.iloc[-1]
                else:
                    results["passed"] = True
                    results["warning"] = f"Secondary source date {last_idx_str} differs from target {as_of_date}. Skipped strict fail."
                    return results

            max_dev = 0.0
            for sym in self.symbols:
                yf_sym = f"{sym}.NS"
                if yf_sym not in match_row or sym not in bhav_map:
                    continue

                bhav_close = float(bhav_map[sym])
                yf_close = float(match_row[yf_sym])

                if bhav_close > 0 and yf_close > 0:
                    dev_pct = abs(bhav_close - yf_close) / bhav_close
                    max_dev = max(max_dev, dev_pct)
                    sym_pass = dev_pct <= self.tolerance

                    results["symbols_checked"].append({
                        "symbol": sym,
                        "bhav_close": bhav_close,
                        "secondary_close": round(yf_close, 2),
                        "deviation_pct": round(dev_pct * 100, 3),
                        "passed": sym_pass,
                    })

                    if not sym_pass:
                        results["passed"] = False
                        results["errors"].append(
                            f"{sym} price discrepancy: Bhavcopy={bhav_close}, Secondary={yf_close} (Dev: {dev_pct*100:.2f}%)"
                        )

            results["max_deviation_pct"] = round(max_dev * 100, 3)

        except Exception as e:
            results["passed"] = False
            results["errors"].append(f"Spot-check fetch exception: {str(e)}")

        return results
