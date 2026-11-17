"""
Configuration settings for NSE Breadth Ledger pipeline.
"""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"
PUBLIC_DATA_DIR = BASE_DIR / "public" / "data"
SCHEMAS_DIR = BASE_DIR / "schemas"

# Raw storage subdirectories
RAW_BHAVCOPY_DIR = RAW_DIR / "bhavcopy"
RAW_CONSTITUENTS_DIR = RAW_DIR / "constituents"
RAW_CORP_ACTIONS_DIR = RAW_DIR / "corporate_actions"
RAW_HOLIDAYS_DIR = RAW_DIR / "holidays"
RAW_CHECKSUM_FILE = METADATA_DIR / "raw_checksums.json"

# Processed storage files
PARQUET_ALL_OHLC = PROCESSED_DIR / "daily_ohlc.parquet"
PARQUET_UNIVERSE_HISTORY = PROCESSED_DIR / "universe_history.parquet"
PARQUET_CORP_ACTIONS = PROCESSED_DIR / "corporate_actions.parquet"

# Universe Configuration
# Supported indices: NIFTY_50, NIFTY_100, NIFTY_200, NIFTY_500, TOTAL_MARKET
SELECTED_INDEX = "NIFTY_500"

INDEX_CONSTITUENT_URLS = {
    "NIFTY_50": "https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv",
    "NIFTY_100": "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv",
    "NIFTY_200": "https://www.niftyindices.com/IndexConstituent/ind_nifty200list.csv",
    "NIFTY_500": "https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv",
    "TOTAL_MARKET": "https://www.niftyindices.com/IndexConstituent/ind_niftytotalmarket_list.csv",
}

# Universe Filters
ALLOWED_SERIES = ["EQ"]
MIN_PRICE = 10.0  # ₹10 minimum price
MIN_AVG_TRADED_VALUE = 5000000.0  # ₹50 Lakhs minimum average daily traded value
MIN_HISTORY_SESSIONS = 252  # 252 trading sessions required for 52-week metrics
DEFAULT_BACKFILL_SESSIONS = 420  # Minimum 400 sessions requirement

# Breadth Windows (Trading Sessions)
WINDOW_1M = 21   # 1 month (~21 sessions)
WINDOW_3M = 63   # 3 months (~63 sessions, used for industry clusters)
WINDOW_6M = 126  # 6 months (~126 sessions)
WINDOW_52W = 252 # 52 weeks (~252 sessions)
THRUST_WINDOW = 20 # 20 sessions for monthly thrust
THRUST_THRESHOLD = 0.25 # +/- 25% return threshold

# Validation Thresholds
MAX_UNEXPLAINED_GAP_PCT = 0.20  # 20% move without corporate action causes quarantine
MIN_UNIVERSE_COVERAGE_PCT = 0.98  # At least 98% of universe stocks must be present
ROW_COUNT_TOLERANCE_PCT = 0.10   # Daily row count shouldn't vary wildly (+/- 10%)
SPOT_CHECK_TOLERANCE_PCT = 0.015 # 1.5% max difference with secondary source (closing price)

# Secondary source spot check symbols
SPOT_CHECK_SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"]

# HTTP Headers for NSE & NiftyIndices
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}

NSE_API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.nseindia.com/",
}
