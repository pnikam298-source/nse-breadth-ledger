"""
Bhavcopy Parsers for different file-format eras.
Normalizes all eras to canonical schema:
date, symbol, series, open, high, low, close, prev_close, volume, value, isin
"""
import io
import zipfile
from datetime import datetime
from typing import Optional
import pandas as pd

CANONICAL_COLUMNS = [
    "date", "symbol", "series", "open", "high", "low", "close",
    "prev_close", "volume", "value", "isin"
]

class BaseBhavcopyParser:
    def parse(self, raw_bytes: bytes, target_date: Optional[str] = None) -> pd.DataFrame:
        raise NotImplementedError

class UDiFFParser(BaseBhavcopyParser):
    """
    Parser for NSE UDiFF format (post-July 2024 / modern).
    Columns: TradDt, TckrSymb, SctySrs, OpnPric, HghPric, LwPric, ClsPric, PrvsClsgPric, TtlTradgVol, TtlTrfVal, ISIN
    """
    def parse(self, raw_bytes: bytes, target_date: Optional[str] = None) -> pd.DataFrame:
        csv_bytes = _extract_csv_bytes(raw_bytes)
        df = pd.read_csv(io.BytesIO(csv_bytes), dtype=str)
        # Clean column names
        df.columns = [c.strip() for c in df.columns]

        mapping = {
            "TradDt": "date",
            "TckrSymb": "symbol",
            "SctySrs": "series",
            "OpnPric": "open",
            "HghPric": "high",
            "LwPric": "low",
            "ClsPric": "close",
            "PrvsClsgPric": "prev_close",
            "TtlTradgVol": "volume",
            "TtlTrfVal": "value",
            "ISIN": "isin",
        }
        res = df[list(mapping.keys())].rename(columns=mapping)
        return _normalize_canonical(res, target_date)

class LegacyCMParser(BaseBhavcopyParser):
    """
    Parser for Legacy NSE CM Bhavcopy (pre-July 2024, e.g. cmDDMMMYYYYbhav.csv.zip).
    Columns: TIMESTAMP, SYMBOL, SERIES, OPEN, HIGH, LOW, CLOSE, PREVCLOSE, TOTTRDQTY, TOTTRDVAL, ISIN
    """
    def parse(self, raw_bytes: bytes, target_date: Optional[str] = None) -> pd.DataFrame:
        csv_bytes = _extract_csv_bytes(raw_bytes)
        df = pd.read_csv(io.BytesIO(csv_bytes), dtype=str)
        df.columns = [c.strip().upper() for c in df.columns]

        # Handle date parsing
        if "TIMESTAMP" in df.columns:
            date_col = df["TIMESTAMP"].apply(_parse_legacy_date)
        else:
            date_col = target_date

        res = pd.DataFrame({
            "date": date_col,
            "symbol": df["SYMBOL"],
            "series": df["SERIES"],
            "open": df["OPEN"],
            "high": df["HIGH"],
            "low": df["LOW"],
            "close": df["CLOSE"],
            "prev_close": df["PREVCLOSE"],
            "volume": df["TOTTRDQTY"],
            "value": df["TOTTRDVAL"],
            "isin": df["ISIN"] if "ISIN" in df.columns else "",
        })
        return _normalize_canonical(res, target_date)

class SecBhavParser(BaseBhavcopyParser):
    """
    Parser for Security-wise Bhavdata Full (sec_bhavdata_full_DDMMYYYY.csv).
    """
    def parse(self, raw_bytes: bytes, target_date: Optional[str] = None) -> pd.DataFrame:
        csv_bytes = _extract_csv_bytes(raw_bytes)
        df = pd.read_csv(io.BytesIO(csv_bytes), dtype=str)
        df.columns = [c.strip().upper() for c in df.columns]

        date_col = target_date
        if "DATE1" in df.columns:
            date_col = df["DATE1"].apply(_parse_legacy_date)

        val = df["TURNOVER_LACS"].astype(float, errors="ignore") * 100000.0 if "TURNOVER_LACS" in df.columns else df.get("TOTTRDVAL", 0)

        res = pd.DataFrame({
            "date": date_col,
            "symbol": df["SYMBOL"],
            "series": df["SERIES"],
            "open": df["OPEN_PRICE"],
            "high": df["HIGH_PRICE"],
            "low": df["LOW_PRICE"],
            "close": df["CLOSE_PRICE"],
            "prev_close": df["PREV_CLOSE"],
            "volume": df["TTL_TRD_QNTY"],
            "value": val,
            "isin": df["ISIN"] if "ISIN" in df.columns else "",
        })
        return _normalize_canonical(res, target_date)

def _extract_csv_bytes(raw_bytes: bytes) -> bytes:
    if raw_bytes.startswith(b"PK\x03\x04"):
        # Zip archive
        with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
            csv_name = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
            return z.read(csv_name)
    return raw_bytes

def _parse_legacy_date(val: str) -> str:
    # Formats: 10-MAY-2024 or 10-May-2024 or 2024-05-10
    val = str(val).strip()
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return val

def _normalize_canonical(df: pd.DataFrame, fallback_date: Optional[str] = None) -> pd.DataFrame:
    df = df.copy()
    if fallback_date and ("date" not in df.columns or df["date"].isna().all()):
        df["date"] = fallback_date

    # Strip whitespace
    df["symbol"] = df["symbol"].astype(str).str.strip()
    df["series"] = df["series"].astype(str).str.strip()
    df["isin"] = df["isin"].astype(str).str.strip()
    df["date"] = df["date"].astype(str).str.strip()

    # Convert numeric fields
    numeric_cols = ["open", "high", "low", "close", "prev_close", "volume", "value"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col].astype(str).str.replace(",", ""), errors="coerce")

    df["volume"] = df["volume"].fillna(0).astype("int64")
    df["value"] = df["value"].fillna(0.0).astype("float64")
    return df[CANONICAL_COLUMNS]

def detect_and_parse(raw_bytes: bytes, target_date: Optional[str] = None) -> pd.DataFrame:
    """
    Automatically detects the bhavcopy era format and parses into canonical DataFrame.
    """
    csv_bytes = _extract_csv_bytes(raw_bytes)
    # Peek header
    first_line = csv_bytes.split(b"\n", 1)[0].decode("utf-8", errors="ignore")
    headers = [h.strip().upper() for h in first_line.split(",")]

    if "TRADDT" in headers or "TCKRSYMB" in headers:
        return UDiFFParser().parse(raw_bytes, target_date)
    elif "TOTTRDQTY" in headers and "PREVCLOSE" in headers:
        return LegacyCMParser().parse(raw_bytes, target_date)
    elif "TURNOVER_LACS" in headers or "TTL_TRD_QNTY" in headers:
        return SecBhavParser().parse(raw_bytes, target_date)
    else:
        # Fallback to UDiFF
        return UDiFFParser().parse(raw_bytes, target_date)
