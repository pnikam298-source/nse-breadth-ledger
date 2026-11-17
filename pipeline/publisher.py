"""
Publisher module: Serializes validated datasets to public/data/ as static JSON and CSV.
Ensures atomic publishing; aborts and writes delayed state on validation failure.
"""
from datetime import datetime
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
import pandas as pd

from pipeline.config import PUBLIC_DATA_DIR, SELECTED_INDEX

class Publisher:
    def __init__(self, public_dir: Path = PUBLIC_DATA_DIR):
        self.public_dir = public_dir
        self.public_dir.mkdir(parents=True, exist_ok=True)
        (self.public_dir / "lists").mkdir(parents=True, exist_ok=True)

    def publish_all(
        self,
        as_of_date: str,
        breadth_payload: Dict[str, Any],
        heatmap_payload: List[Dict[str, Any]],
        industries_payload: List[Dict[str, Any]],
        highs_scanner_payload: List[Dict[str, Any]],
        sessions_10_payload: List[Dict[str, Any]],
        stocks_payload: List[Dict[str, Any]],
        validation_report: Dict[str, Any],
        universe_size: int,
        quarantined_count: int,
        index_name: str = SELECTED_INDEX
    ) -> bool:
        """
        Publishes all outputs if validation report passed.
        If validation failed, only updates latest.json with delayed status and writes validation_report.json.
        """
        passed = validation_report.get("passed", False)
        timestamp_str = datetime.now().isoformat()

        latest_payload = {
            "asof": as_of_date,
            "as_of_date": as_of_date,
            "as_of_timestamp": timestamp_str,
            "universe": universe_size,
            "universe_size": universe_size,
            "quarantined": quarantined_count,
            "quarantined_count": quarantined_count,
            "status": "ok" if passed else "delayed",
            "data_status": "ok" if passed else "delayed",
            "message": "All validation gates passed" if passed else "Data delayed: showing last validated session.",
            "index_name": index_name,
            "total_universe_capacity": breadth_payload.get("total_universe_capacity", universe_size),
            "validation_passed": passed,
            "disclaimer": "Market-wide counts only, built from official NSE data. Final after close. Market information, not investment advice."
        }

        # Write validation report
        self._write_json(self.public_dir / "validation_report.json", validation_report)

        if not passed:
            # Abort publishing core data files, keep existing live data, mark latest as delayed
            self._write_json(self.public_dir / "latest.json", latest_payload)
            return False

        # Atomic publish all datasets
        self._write_json(self.public_dir / "latest.json", latest_payload)
        self._write_json(self.public_dir / "breadth.json", breadth_payload)
        self._write_json(self.public_dir / "heatmap_60.json", heatmap_payload)
        self._write_json(self.public_dir / "industries.json", industries_payload)
        self._write_json(self.public_dir / "lists" / "highs_52w.json", highs_scanner_payload)
        self._write_json(self.public_dir / "sessions_10.json", sessions_10_payload)
        self._write_json(self.public_dir / "stocks.json", stocks_payload)

        # Generate CSV exports
        self._write_csv(
            self.public_dir / "sessions_10.csv",
            pd.DataFrame(sessions_10_payload)
        )

        # Industries CSV
        ind_clean = [
            {k: v for k, v in row.items() if k != "stocks"}
            for row in industries_payload
        ]
        self._write_csv(self.public_dir / "industries.csv", pd.DataFrame(ind_clean))

        # Highs scanner CSV
        self._write_csv(
            self.public_dir / "lists" / "highs_52w.csv",
            pd.DataFrame(highs_scanner_payload)
        )

        return True

    def _write_json(self, path: Path, data: Any):
        temp_path = path.with_suffix(path.suffix + ".tmp")
        with open(temp_path, "w") as f:
            json.dump(data, f, indent=2)
        temp_path.replace(path)

    def _write_csv(self, path: Path, df: pd.DataFrame):
        temp_path = path.with_suffix(path.suffix + ".tmp")
        df.to_csv(temp_path, index=False)
        temp_path.replace(path)
