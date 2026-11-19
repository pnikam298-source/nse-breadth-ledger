"""
Ingestion module: Downloads official NSE bhavcopies, Nifty index constituents,
corporate actions, and holidays, saving them immutably via RawStore.
"""
from datetime import date, datetime
import io
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import jugaad_data.nse as jnse

from pipeline.config import (
    RAW_BHAVCOPY_DIR, RAW_CONSTITUENTS_DIR, RAW_CORP_ACTIONS_DIR,
    RAW_HOLIDAYS_DIR, RAW_INDICES_DIR, INDEX_CONSTITUENT_URLS, BROWSER_HEADERS, NSE_API_HEADERS
)
from pipeline.raw_store import RawStore

def get_robust_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(total=3, backoff_factor=1.0, status_forcelist=[429, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.headers.update(BROWSER_HEADERS)
    return s

class IngestionManager:
    def __init__(self, raw_store: Optional[RawStore] = None):
        self.raw_store = raw_store or RawStore()
        self.session = get_robust_session()

    def download_bhavcopy(self, dt: date) -> Optional[bytes]:
        """
        Downloads raw bhavcopy for the given date.
        Tries UDiFF format first, then legacy CM format if older.
        Returns raw bytes or None if holiday/weekend/missing.
        """
        # Try jugaad-data first (which handles cookies and format endpoints)
        try:
            raw_text = jnse.bhavcopy_udiff_raw(dt)
            if raw_text and len(raw_text) > 1000:
                return raw_text.encode("utf-8")
        except Exception:
            pass

        # Try legacy format if before or around mid-2024
        try:
            raw_text = jnse.bhavcopy_old_raw(dt)
            if raw_text and len(raw_text) > 1000:
                return raw_text.encode("utf-8")
        except Exception:
            pass

        # Direct HTTP fallback
        d_str = dt.strftime("%Y%m%d")
        udiff_url = f"https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{d_str}_F_0000.csv.zip"
        try:
            r = self.session.get(udiff_url, timeout=15)
            if r.status_code == 200 and len(r.content) > 1000:
                return r.content
        except Exception:
            pass

        return None

    def ingest_bhavcopy(self, dt: date) -> Optional[Path]:
        """
        Downloads and saves bhavcopy immutably.
        """
        d_str = dt.strftime("%Y%m%d")
        zip_path = RAW_BHAVCOPY_DIR / str(dt.year) / f"{dt.month:02d}" / f"BhavCopy_NSE_CM_{d_str}.csv.zip"
        csv_path = RAW_BHAVCOPY_DIR / str(dt.year) / f"{dt.month:02d}" / f"BhavCopy_NSE_CM_{d_str}.csv"

        if zip_path.exists():
            return zip_path
        if csv_path.exists():
            return csv_path

        raw_bytes = self.download_bhavcopy(dt)
        if not raw_bytes:
            return None

        # Check if raw_bytes is zip or plain csv
        if not raw_bytes.startswith(b"PK\x03\x04"):
            target_path = csv_path
        else:
            target_path = zip_path

        stored_path = self.raw_store.store_file(
            target_path,
            raw_bytes,
            metadata={"date": dt.strftime("%Y-%m-%d"), "type": "bhavcopy"}
        )
        return stored_path

    def ingest_constituents(self, index_name: str = "NIFTY_500", snapshot_date: Optional[date] = None) -> Path:
        """
        Downloads and saves index constituent CSV from niftyindices.com.
        """
        url = INDEX_CONSTITUENT_URLS.get(index_name)
        if not url:
            raise ValueError(f"Unknown index {index_name}. Supported: {list(INDEX_CONSTITUENT_URLS.keys())}")

        snap_dt = snapshot_date or date.today()
        d_str = snap_dt.strftime("%Y%m%d")
        target_path = RAW_CONSTITUENTS_DIR / d_str / f"{index_name.lower()}_constituents.csv"

        if target_path.exists():
            return target_path

        r = self.session.get(url, timeout=20)
        r.raise_for_status()
        content = r.content

        return self.raw_store.store_file(
            target_path,
            content,
            metadata={"index": index_name, "snapshot_date": snap_dt.strftime("%Y-%m-%d")}
        )

    def ingest_corporate_actions(self, from_date: str = "01-01-2024", to_date: Optional[str] = None) -> Path:
        """
        Fetches historical corporate actions from NSE API and stores immutably.
        """
        today_str = (to_date or date.today().strftime("%d-%m-%Y"))
        d_key = datetime.now().strftime("%Y%m%d")
        target_path = RAW_CORP_ACTIONS_DIR / f"corp_actions_{d_key}.json"

        if target_path.exists():
            return target_path

        params = {"index": "equities", "from_date": from_date, "to_date": today_str}
        r = self.session.get(
            "https://www.nseindia.com/api/corporates-corporateActions",
            params=params,
            headers=NSE_API_HEADERS,
            timeout=25
        )
        r.raise_for_status()

        return self.raw_store.store_file(
            target_path,
            r.content,
            metadata={"from_date": from_date, "to_date": today_str, "type": "corporate_actions"}
        )

    def ingest_holidays(self) -> Path:
        """
        Fetches NSE trading holidays master and stores immutably.
        """
        d_key = datetime.now().strftime("%Y%m%d")
        target_path = RAW_HOLIDAYS_DIR / f"holidays_{d_key}.json"

        if target_path.exists():
            return target_path

        r = self.session.get(
            "https://www.nseindia.com/api/holiday-master?type=trading",
            headers=NSE_API_HEADERS,
            timeout=15
        )
        r.raise_for_status()

        return self.raw_store.store_file(
            target_path,
            r.content,
            metadata={"type": "trading_holidays"}
        )

    def download_index_closes(self, dt: date) -> Optional[bytes]:
        """
        Downloads official daily NSE index close CSV:
        https://nsearchives.nseindia.com/content/indices/ind_close_all_{ddmmyyyy}.csv
        """
        d_str = dt.strftime("%d%m%Y")
        url = f"https://nsearchives.nseindia.com/content/indices/ind_close_all_{d_str}.csv"
        try:
            r = self.session.get(url, timeout=15)
            if r.status_code == 200 and len(r.content) > 500:
                return r.content
        except Exception:
            pass
        return None

    def ingest_index_closes(self, dt: date) -> Optional[Path]:
        """
        Downloads and saves official NSE index closes immutably.
        """
        d_str = dt.strftime("%d%m%Y")
        target_path = RAW_INDICES_DIR / str(dt.year) / f"ind_close_all_{d_str}.csv"
        if target_path.exists():
            return target_path

        raw_bytes = self.download_index_closes(dt)
        if not raw_bytes:
            return None

        return self.raw_store.store_file(
            target_path,
            raw_bytes,
            metadata={"date": dt.strftime("%Y-%m-%d"), "type": "index_closes"}
        )
