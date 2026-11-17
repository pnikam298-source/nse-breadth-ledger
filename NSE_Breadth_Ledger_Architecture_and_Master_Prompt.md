# NSE Breadth Ledger: Solution Architecture and Master Prompt

A daily market-breadth dashboard for the Indian stock market (NSE only), modelled on the feature set of The Breadth Ledger (markets.manasarora.com).

---

# Part 1: Solution Architecture

## The data principle

Bad data comes from **adjusted-price errors, missing days, wrong universe membership, and silent pipeline failures**. The architecture is built around fixing those four problems.

1. **Official source first.** Use NSE's own end-of-day files (the daily "bhavcopy"), not Yahoo-style scrapers. They are the exchange's own record and include the day's High, Low, Close, Previous Close, volume and delivery.
2. **Publish only when validation passes.** If any check fails, the site keeps showing the last good day with a visible "data delayed" banner. It never shows wrong numbers.
3. **Store raw, derive everything.** Never edit raw files. Adjusted prices and all metrics are recomputed from raw data, so any bug can be fixed by re-running.
4. **No synthetic or placeholder data in production.**

## Architecture

```
NSE (bhavcopy, delivery file) ──┐
niftyindices.com (constituents, │
  industry classification) ─────┼─► 1. INGEST ─► 2. RAW STORE (immutable files)
NSE corporate actions ──────────┤                      │
India VIX / FII-DII (optional) ─┘                      ▼
                                           3. CLEAN + ADJUST (splits, bonus, rights, symbol changes)
                                                       │
                                                       ▼
                                           4. VALIDATE (hard gates; fail = do not publish)
                                                       │
                                                       ▼
                                           5. COMPUTE METRICS (breadth, highs/lows, thrust, industry, lists)
                                                       │
                                                       ▼
                                           6. PUBLISH static JSON/CSV to CDN
                                                       │
                                                       ▼
                                           7. FRONTEND (static site, reads JSON, no backend needed)
```

**Stack (cheap, reliable, vibe-code friendly):**

- **Pipeline:** Python (pandas, requests, pyarrow) run by **GitHub Actions** on a schedule.
- **Storage:** Parquet files in the repo or in S3/Cloudflare R2. Move to Postgres only when you add accounts and alerts.
- **Hosting:** Cloudflare Pages or Netlify, serving static HTML/JS plus JSON.
- **Frontend:** plain HTML/CSS/JS with Chart.js, or React with Vite. All calculators run in the browser.

## Data sources

| Need | Source | Notes |
|---|---|---|
| Daily OHLC, prev close, volume, series | NSE common bhavcopy (UDiFF format) | Published after close. Retry until it appears. |
| Delivery % | NSE security-wise delivery file | Optional but useful. |
| Universe and industry | Nifty index constituent CSVs (e.g. Nifty 500 list with Industry column) from niftyindices.com | Refresh monthly, and keep dated snapshots. |
| Corporate actions | NSE corporate actions, used as a **cross-check** | The NSE site blocks bots, so expect cookies and fragility. |
| Holidays | NSE holiday list | Refresh yearly. |
| Intraday (later phase) | Broker or vendor API (Kite, Upstox, Dhan, TrueData) | Check current pricing and redistribution terms. |

**Check NSE's data terms before commercial use.** Publishing derived aggregates (counts, percentages) is lower risk than redistributing raw prices, but get this confirmed.

## The key technical decision: price adjustment

Unadjusted splits and bonuses create fake "52-week lows" and break everything. Instead of only parsing messy corporate-action text:

- **Detect adjustment events from the data itself.** NSE sets each day's Previous Close to the exchange-adjusted reference price. If today's `PrevClose` differs from yesterday's `Close` by more than a small tolerance, an event happened. The ratio is your adjustment factor.
- **Cross-check against the corporate actions table.** If the data shows a jump and no action explains it (or the reverse), the stock is **quarantined** for review.
- **Apply factors backwards** to build an adjusted history, used for highs, lows, moving averages and returns.
- Verify how NSE treats cash dividends in the reference price, and decide explicitly whether to adjust for them. For breadth, splits, bonuses, rights and demergers are what matter.

## Metric definitions (lock these in a methodology page)

- **Universe:** NSE EQ series, in the chosen index (default Nifty 500), price above a minimum (e.g. ₹10), minimum average traded value, and at least 252 sessions of history for 52-week metrics. Show the universe size on the page.
- **New N-day high today:** today's High is at least the highest adjusted High of the previous N sessions (1M ≈ 21, 3M ≈ 63, 6M ≈ 126, 52W ≈ 252 sessions). Lows work the same way.
- **Gain over N sessions:** adjusted Close today ÷ adjusted Close N sessions ago − 1.
- **Monthly thrust:** count of stocks up 25% or more over 20 sessions, minus those down 25% or more.
- **Industry cluster %:** stocks at a 3-month (and 1-month) high ÷ stocks in the industry, with at least 3 stocks.
- **Heatmap colour:** a documented rule, for example net new highs minus lows normalised by universe size, with fixed thresholds.

## Validation gates (all must pass before publishing)

1. The file is for the expected trading date, and it is a trading day per the holiday calendar.
2. Row count is within a set tolerance of the previous day. Universe coverage is above 98%.
3. No zero, negative or null prices. High ≥ Low, and Close lies within the High–Low range.
4. Any daily move above 20% (beyond circuit norms) must be explained by a corporate action, or the stock is quarantined.
5. Adjusted history has no gaps for any universe stock.
6. Advancers + decliners + unchanged equals the universe count.
7. **Spot-check test:** a small set of known stocks is compared against a second source each night, with a tolerance.
8. Output JSON passes its schema check.

On failure: don't publish, send an alert (email or Telegram), and show a banner. Never fill gaps with guesses.

## Output files (what the frontend reads)

```
/data/latest.json          meta: as-of date, universe size, data status
/data/breadth.json         highs/lows counts per window, thrust, DMA %, A/D
/data/heatmap_60.json      last 60 sessions with regime values
/data/industries.json      cluster % and momentum matrix per industry
/data/lists/highs_52w.json stocks at or near highs, with industry, % from high
/data/sessions_10.json     last 10 sessions
/data/history/YYYY.parquet or JSON   for future use
```

## Schedule

- Run a loop from about 6:30 PM IST, retrying every 10–15 minutes until the file appears, with a hard timeout. Note that GitHub Actions cron uses UTC.
- Run a full **backfill** once, with at least 400 sessions (a 52-week window plus warm-up) before launch.
- Run a monthly universe and industry refresh, and a yearly holiday refresh.

---

# Part 2: Master Prompt

Paste this into your vibe-coding tool (Claude Code, Cursor, etc.). Build in the phases it specifies.

````
ROLE
You are a senior full-stack engineer and quantitative data engineer with fintech experience. Build "NSE Breadth Ledger": a daily market-breadth dashboard for the Indian stock market (NSE only). Data correctness is the top priority. Never use mock, random or placeholder data in production code.

PRODUCT GOAL
Help swing and positional traders judge in under 60 seconds whether the advance is broad or narrow, using market-wide counts built from NSE data. It is market information, not investment advice.

TECH STACK
- Pipeline: Python 3.11+, pandas, pyarrow, requests, pytest. Scheduled with GitHub Actions.
- Storage: raw files kept immutable under /data/raw; processed Parquet under /data/processed.
- Output: static JSON and CSV under /public/data, read by the frontend.
- Frontend: static site (Vite + vanilla JS or React), Chart.js for charts, mobile-first, light and dark themes. No backend. All calculators run client-side and send nothing anywhere.

PHASE 1: DATA PIPELINE (build and test this FIRST)
1. Ingest: download NSE end-of-day bhavcopy (current UDiFF format) for each trading date; handle NSE bot protection with proper headers/session and retries with backoff. Keep a parser per file-format era so history backfills correctly. Download Nifty index constituents with the Industry column from niftyindices.com and store dated snapshots. Fetch corporate actions and the NSE holiday calendar.
2. Raw store: save every downloaded file unchanged with a date and checksum. Never overwrite.
3. Universe: NSE EQ series only, members of the selected index (default Nifty 500; config options Nifty 50/100/200/500 and a wider total-market option), minimum price and minimum average traded value filters (configurable), at least 252 sessions of history for 52-week metrics. Use point-in-time membership snapshots where possible and document any survivorship bias.
4. Adjustment: derive adjustment factors from the gap between each day's NSE PrevClose and the prior day's Close, and cross-check against the corporate actions table. Apply factors backwards to build adjusted OHLC. Handle symbol changes and mergers. Any stock with an unexplained jump is QUARANTINED, excluded from that day's counts and listed in a data-quality report.
5. Validation gates (all must pass or publishing is aborted, the last good data stays live, and a data-delayed status is written to latest.json): correct trading date; row count and coverage within tolerance of the prior day; no null, zero or negative prices; High >= Low and Close within range; moves over 20% explained by corporate actions; no gaps in adjusted history; advancers + decliners + unchanged = universe size; nightly spot-check of a fixed set of stocks against a second source; JSON schema validation.
6. Backfill command: build at least 400 sessions of history before the first launch.
7. Scheduler: GitHub Actions runs from about 6:30 PM IST, retrying until the bhavcopy is published, with a timeout and a failure alert (email or Telegram).
8. Tests: unit tests for adjustment, window math and every metric using small hand-checked fixtures, and a regression test that known historical splits and bonuses produce no false highs or lows.

PHASE 2: METRICS (exact definitions, also shown on a Methodology page)
- New N-session high today: today's adjusted High >= max adjusted High of the previous N sessions. Lows are symmetric. Windows: 1 month (21 sessions), 6 months (126), 52 weeks (252), and 3 months (63) for industries. Counts are of stocks.
- Gain over N sessions: adjusted Close today / adjusted Close N sessions ago - 1.
- Monthly thrust: number of stocks up 25% or more over 20 sessions minus number down 25% or more.
- Industry cluster: for each industry with at least 3 tracked stocks, share of stocks at a 3-month high today and at a 1-month high today.
- Regime value per day for the heatmap: a documented formula based on net new highs minus lows, normalised by universe size, with fixed thresholds mapped to a teal (broad strength) to clay (broad weakness) scale.
- Include the as-of timestamp, universe size, quarantined count and data status in every output.

PHASE 3: FRONTEND (match every one of these features)
1. Header: title "NSE Breadth Ledger", sticky section menu ("Sections" with jump links), light/dark toggle, loading state, and a data status line showing the as-of date and a "prices delayed / final after close" note.
2. Promo/lead banner component with a countdown timer, controlled by a config file (can be switched off), linking to an offer-details modal.
3. Fresh highs vs fresh lows: a diverging bar or butterfly chart. Highs on the right and lows on the left, for 1 month, 6 months and 52 weeks.
4. Last 60 sessions heatmap: one square per day, oldest left, today right, teal to clay colour scale, tooltip with date and values, a legend ("Earlier" to "Today"), and the monthly thrust value.
5. "Where fresh highs cluster": horizontal bars per industry (dark bar = share at a 3-month high, pale bar = share at a 1-month high), only industries with at least 3 stocks. Buttons: Download industries (CSV), Copy for TradingView, Download TradingView file (.txt).
6. Broad momentum explorer: controls for Industry, "Gain of at least" (%), and "Over the last" (trading days). Show how many stocks in that industry meet the test and list them (name, industry, gain). Clicking a name opens the stock's chart on TradingView (NSE:SYMBOL). Buttons: Download CSV, Copy for TradingView, Download TradingView file. Below it, a ranking of every industry by the share of stocks meeting the same test; clicking one selects it above.
7. 52-week highs scanner: a "Show" selector (New 52-week highs today / New 6-month highs today / New 1-month highs today / Within X% of the 52-week high), a "Within (%)" input from 0.5 to 30, an Industry filter, a sortable table with TradingView links, and the same three export buttons.
8. Session log: table of the last 10 sessions, newest first, with a CSV download.
9. Position sizer, fully client-side: Long/Short toggle; entry price (₹); stop-loss as % or as a price (the two stay in sync); quick stop buttons 1%, 2%, 3%, 5%; account size (₹); risk per trade (% of account); capital per trade (% of account) as a cap; outputs for quantity, position value, capital used, risk amount (₹), and editable target boxes at several R multiples (tap to change) with profit per target. Save inputs in this browser only (localStorage in your own deployment) and never send them anywhere. Label it "a calculator, not a recommendation".
10. Lead form modal: full name, email, WhatsApp number with +91 prefix, an explicit unchecked consent checkbox, a link to the offer terms, a thank-you state. Validate inputs. Post to a configurable endpoint (Google Form, Formspree or your own API). Do not hardcode any secret. Follow India's DPDP Act: consent text, privacy policy link.
11. Footer disclaimer: market-wide counts only, built from prices delayed about 15 minutes during market hours and final after close; market information, not investment advice; breadth helps judge risk, not direction.
12. Export formats: CSV with a header row. TradingView watchlist as a plain text file of comma-separated NSE:SYMBOL entries (also offered as copy-to-clipboard).
13. Deep links: use plain #section anchors only.

NON-FUNCTIONAL
- Mobile-first, responsive, accessible (contrast, keyboard focus, aria labels), fast (JSON under about 500 KB per file, gzip).
- Wide tables scroll inside their own container.
- Every metric has an info tooltip linking to the Methodology page.
- No tracking of position-sizer inputs. Analytics only with consent.

DELIVERABLES
1. Repo structure and README (setup, backfill, scheduler, how to add an index).
2. Pipeline code with tests, and a sample validation report.
3. Frontend reading the JSON in /public/data.
4. Methodology page and Data Quality page (shows quarantined stocks and last validation result).
5. Clearly marked config for the universe, thresholds, promo banner and lead form endpoint.

WORKING RULES
- Build Phase 1 and show me the validation report on real backfilled data before starting the frontend.
- If a source is blocked, fragile or ambiguous, stop and tell me rather than guessing or faking data.
- Explain every assumption in comments and in the Methodology page.
````

---

# Part 3: Things to Know Before You Start

- **Intraday vs end-of-day:** the original updates during market hours with delayed prices. Phase 1 above is **end-of-day only** (final after close), which is much cleaner and free. Live intraday needs a paid broker or vendor feed with its own licensing, so add it later.
- **First milestone:** run the backfill and read the validation report. If the data is wrong, everything built on top is wrong.
- **Always show the date:** the dashboard should always say which date it reflects.

---

# Appendix: Product Roadmap and Extra Features

## Roadmap

- **Phase 0 (week 1–2):** data pipeline for Nifty 500 EOD with corporate action adjustment, and validation.
- **Phase 1 (week 3–5):** breadth core, heatmap, 52W scanner, industry ranking, exports, position sizer.
- **Phase 2 (week 6–8):** regime score, % above DMAs, VIX/FII/DII, sector rotation, share cards.
- **Phase 3 (week 9–12):** alerts, RS rating, stock pages, historical percentile context.
- **Phase 4:** intraday data, accounts, paid tier, API.

## Differentiators to add after the clone is working

1. **Regime score (0–100):** one composite number from breadth, thrust, % above DMAs, VIX and flows.
2. **Historical context:** today's reading vs the last 5 years, and what happened after similar readings.
3. **Breadth divergence alerts:** the index makes a new high while breadth weakens.
4. **Relative strength ranking** (RS rating 1–99) for NSE stocks.
5. **Base and pattern scanners:** tight consolidations, 52-week-high breakouts on volume.
6. **Sector rotation map:** leading, weakening, lagging, improving quadrants.
7. **Stock detail pages** with industry, RS, distance from 52W high, mini chart and peers.
8. **Alerts** by Telegram, email or WhatsApp.
9. **Auto-generated daily market note** and **shareable image cards** for social media.

## NSE-specific additions

- Circuit-limit flags, series filter (EQ only), and liquidity filters.
- India VIX and FII/DII flows next to breadth.
- F&O universe toggle and sectoral index relative strength.
- Delivery % and volume spikes, and ASM/GSM surveillance flags.
- Nifty vs Equal Weight / Midcap / Smallcap divergence.

## Compliance checklist

- **SEBI:** no buy/sell/target calls unless registered as a Research Analyst or Investment Adviser. Keep it "market information, not advice."
- **Data licensing:** confirm NSE and vendor terms before commercial redistribution.
- **DPDP Act 2023:** consent, a privacy policy and a deletion path for any email or phone you collect.
- **Marketing:** explicit opt-in and an easy unsubscribe for email and WhatsApp.
- **Affiliate links:** disclose them clearly.

## Top risks

1. Bad data (unadjusted splits) destroys credibility fastest.
2. Data licensing, if you scale commercially.
3. Regulatory drift into advice.
4. Metric overload: lead with one regime score, let users drill down.
5. Competition from free tools: your edge is the interpretation layer, one clear market verdict.
