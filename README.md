# NSE Breadth Ledger

> **A quantitative daily market-breadth dashboard for the Indian stock market (NSE only).**  
> Helps swing and positional traders judge in under 60 seconds whether the market advance is broad or narrow, built purely from verified, unadjusted-free National Stock Exchange of India (NSE) data.  
> *Market information only — not investment advice.*

---

## 1. Architecture Overview

```
NSE Archives (UDiFF Bhavcopy) ──┐
niftyindices.com (Constituents) ─┼──► 1. INGEST ──► 2. RAW STORE (Immutable, SHA-256)
NSE Corporate Actions ──────────┤                           │
NSE Holiday Master ─────────────┘                           ▼
                                              3. CLEAN + BACKWARD ADJUST
                                                 (Splits, bonuses, rights, demergers)
                                                            │
                                                            ▼
                                              4. VALIDATE (8 Hard Gates)
                                                 (Fail = abort, keep last good day live)
                                                            │
                                                            ▼
                                              5. COMPUTE QUANTITATIVE METRICS
                                                 (Highs/lows, thrust, clusters, regime)
                                                            │
                                                            ▼
                                              6. PUBLISH STATIC JSON/CSV to /public/data
                                                            │
                                                            ▼
                                              7. FRONTEND (Laptop/Desktop static web app)
```

- **Data Integrity First**: Never uses mock, synthetic, or placeholder data. Every metric is computed from official NSE bhavcopy files.
- **Backward Price Adjustment**: Automatically derives adjustment factors from daily `PrevClose` vs prior `Close` gaps, cross-checked against NSE corporate actions records to prevent false 52-week lows or false breakouts.
- **Quarantine Engine**: Unexplained price gaps $> 20\%$ are isolated into quarantine and logged in the Data Quality report.
- **Zero-Tolerance Validation**: 8 automated gates run nightly. If any check fails, publishing is aborted, previous live data remains untouched, and a `data-delayed` status is broadcast.
- **Client-Side Privacy**: All calculators (including the Position Sizer) execute 100% in the user's browser; nothing is transmitted to any server.

---

## 2. Directory Structure

```
.
├── .github/
│   └── workflows/
│       └── daily_pipeline.yml         # GitHub Actions daily EOD scheduler (6:30 PM IST)
├── data/
│   ├── raw/                           # Immutable raw downloads (never overwritten)
│   │   ├── bhavcopy/YYYY/MM/          # NSE UDiFF daily bhavcopies
│   │   ├── constituents/              # Dated index constituent snapshots
│   │   ├── corporate_actions/         # NSE historical corporate actions
│   │   └── holidays/                  # NSE trading holiday calendars
│   ├── processed/                     # High-performance Parquet time series
│   │   ├── daily_ohlc.parquet
│   │   └── universe_history.parquet
│   └── metadata/
│       └── raw_checksums.json         # SHA-256 cryptographic manifest
├── pipeline/
│   ├── __init__.py
│   ├── config.py                      # Universe, threshold, and path settings
│   ├── ingest.py                      # Multi-era ingestion with retries and session handling
│   ├── parsers.py                     # UDiFF, Legacy CM, and SecBhav parsers
│   ├── raw_store.py                   # Immutable raw storage manager
│   ├── universe.py                    # Constituent selection and liquidity filters
│   ├── adjust.py                      # Corporate action adjustment & quarantine engine
│   ├── metrics.py                     # Highs/lows, thrust, clusters, regime, DMAs
│   ├── spot_check.py                  # Secondary source benchmark validator
│   ├── validator.py                   # 8 hard validation gates engine
│   ├── publisher.py                   # Atomic JSON and CSV publishing
│   └── cli.py                         # CLI entry points (backfill, daily run)
├── public/                            # Static frontend (Laptop/Desktop optimized)
│   ├── index.html                     # Main breadth dashboard & position sizer
│   ├── methodology.html               # Formulas, window definitions, and compliance
│   ├── data-quality.html              # Live 8-gate audit and quarantined stocks log
│   └── data/                          # Published static feeds read by the frontend
│       ├── latest.json
│       ├── stocks.json
│       ├── breadth.json
│       ├── heatmap_60.json
│       ├── industries.json
│       ├── sessions_10.json
│       ├── validation_report.json
│       └── lists/highs_52w.json
├── schemas/                           # Draft-07 JSON Schemas for validation
│   ├── latest.schema.json
│   ├── breadth.schema.json
│   ├── heatmap_60.schema.json
│   ├── industries.schema.json
│   ├── highs_52w.schema.json
│   └── sessions_10.schema.json
├── tests/                             # Unit and regression test suite
│   ├── test_parsers.py
│   ├── test_adjust.py
│   ├── test_metrics.py
│   ├── test_validation.py
│   └── test_regression_splits.py
└── README.md
```

---

## 3. Installation & Setup

### Prerequisites
- Python 3.11+
- Internet access for downloading NSE bhavcopies

### Clone and Install Dependencies
```bash
git clone https://github.com/your-username/nse-breadth-ledger.git
cd nse-breadth-ledger

python3 -m venv .venv
source .venv/bin/activate
pip install -r <(cat <<EOF
pandas>=2.2.0
pyarrow>=15.0.0
requests>=2.31.0
pytest>=8.0.0
jsonschema>=4.20.0
jugaad-data>=0.37.0
yfinance>=0.2.35
EOF
)
```

---

## 4. Running the Pipeline

### Step 1: Run the Unit & Regression Test Suite
Verify that parsers, rolling window math, corporate action backward adjustment, and split regression protections pass:
```bash
python3 -m pytest tests/ -v
```

### Step 2: Historical Backfill (400+ Sessions)
Build at least 420 trading sessions of clean historical data:
```bash
python3 -m pipeline.cli backfill --sessions 420
```
This command:
1. Downloads the latest dated Nifty 500 snapshot from `niftyindices.com`.
2. Downloads historical NSE corporate actions and trading holiday master.
3. Downloads 420 raw bhavcopies, saving them immutably with SHA-256 checksums.
4. Performs backward price adjustments across all historical splits and bonuses.
5. Computes multi-timeframe breakout signals, monthly thrust, industry clusters, and regime values.
6. Executes all 8 hard validation gates and publishes static JSON/CSV files to `public/data/`.

### Step 3: Daily EOD Update
Run after market close (e.g. 6:30 PM IST):
```bash
python3 -m pipeline.cli run
```

---

## 5. Serving the Frontend Locally

The frontend is a static web application optimized for laptop and desktop trading screens:
```bash
python3 -m http.server 8000 --directory public
```
Open [http://localhost:8000](http://localhost:8000) in your browser:
- **Dashboard**: [http://localhost:8000/index.html](http://localhost:8000/index.html)
- **Methodology Page**: [http://localhost:8000/methodology.html](http://localhost:8000/methodology.html)
- **Data Quality Report**: [http://localhost:8000/data-quality.html](http://localhost:8000/data-quality.html)

---

## 6. How to Configure or Change the Index

The universe selection is configured in `pipeline/config.py`:
```python
# pipeline/config.py

# Supported indices: NIFTY_50, NIFTY_100, NIFTY_200, NIFTY_500, TOTAL_MARKET
SELECTED_INDEX = "NIFTY_500"

# Universe Filters
MIN_PRICE = 10.0                 # ₹10 minimum price
MIN_AVG_TRADED_VALUE = 5000000.0 # ₹50 Lakhs minimum average daily traded value
MIN_HISTORY_SESSIONS = 252       # Sessions required for 52W metrics
```
To run for Nifty 100 or Nifty Total Market:
```bash
python3 -m pipeline.cli backfill --index NIFTY_100 --sessions 420
```

---

## 7. Frontend Configuration

In `public/index.html`, customize the promotional banner, lead webhook endpoint, and compliance links via the `C` configuration object:
```javascript
const C = {
  dataPath: 'data/',                    // Relative or CDN path to public/data/
  leadEndpoint: 'https://your-api.com/leads', // Google Form / Formspree / Custom API
  privacyUrl: 'methodology.html#compliance',
  termsUrl: 'methodology.html#terms',
  promo: {
    enabled: false,                     // Set to true to display countdown banner
    text: 'Special briefing ends in',
    endsAt: '2026-12-31T18:00:00+05:30',
    details: 'Access premium sector rotation notes and breadth divergence alerts.'
  }
};
```

---

## 8. GitHub Actions Automated Scheduler

The daily workflow (`.github/workflows/daily_pipeline.yml`) runs automatically Monday through Friday at 13:00 UTC (6:30 PM IST):
1. Checks out repository and installs Python dependencies.
2. Runs unit test suite (`pytest`).
3. Executes a retry loop polling for the newly published bhavcopy until 8:00 PM IST.
4. Executes all 8 validation gates.
5. Commits and pushes verified data to GitHub Pages / hosting branch.
6. Dispatches webhook failure alert if validation fails or publishing is blocked.

---

## 9. Disclaimer & Compliance

- **SEBI (Research Analysts) Regulations, 2014**: This software is purely an analytical market-breadth calculator and informational dashboard. It does not provide buy/sell signals, target prices, or personalized investment advice.
- **DPDP Act, 2023**: Lead forms adhere to explicit, opt-in consent guidelines. The Position Sizer runs strictly in the browser with `localStorage` persistence and does not transmit financial inputs anywhere.
