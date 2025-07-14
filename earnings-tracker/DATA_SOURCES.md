# Stock Data Refresh - Information Sources

This document details where each piece of information comes from when refreshing stock data in the Earnings Tracker application.

## Data Fields and Their Sources

### 1. **Company Information**
- **Ticker Symbol**: User input / existing database
- **Company Name**: 
  - Primary: Yahoo Finance web scraping
  - Fallback: SEC EDGAR API company search
  - Storage: `companies` table

### 2. **Historical EPS Data**
- **Source**: SEC EDGAR API
- **Endpoint**: `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json`
- **Fields Retrieved**:
  - `fiscal_period`: Quarter/year of the earnings (e.g., "Q3 2023")
  - `eps_actual`: Actual reported EPS value
  - `filing_date`: Date when the earnings were filed with SEC
- **Storage**: `historical_eps` table
- **Cache**: 7-day retention policy
- **Rate Limit**: 10 requests/second (SEC requirement)

### 3. **Earnings Estimates & Dates**
- **Primary Source**: Yahoo Finance (web scraping)
  - URL: `https://finance.yahoo.com/quote/{ticker}`
  - **Fields Retrieved**:
    - `earnings_date`: Next earnings announcement date (if range provided, uses first date)
    - `earnings_date_range`: Original date range string (e.g., "Jul 28 - Aug 1, 2025")
    - `eps_estimate`: Analyst consensus EPS estimate
    - `year_ago_eps`: EPS from same quarter last year
- **Secondary Source**: EarningsWhispers (web scraping) - **TIME ONLY**
  - URL: `https://www.earningswhispers.com/stocks/{ticker}`
  - **Fields Retrieved**:
    - `market_timing`: "Before Market" or "After Market"
    - `earnings_time`: Specific time (e.g., "4:30 PM ET")
  - **Note**: EarningsWhispers date is NEVER used; only time and market timing
- **Fallback Sources** (if time/timing not found):
  - Nasdaq
  - MarketWatch
  - Benzinga
- **Storage**: `earnings_estimates` table

### 4. **Metadata**
- **Last Updated**: System timestamp when refresh occurs
- **Data Quality Indicators**:
  - Source reliability ranking
  - Fallback source used (if any)
  - Scraping errors/warnings

## Refresh Process Flow

1. **Manual Refresh** (single stock):
   - User clicks refresh button → `/api/companies/[ticker]/refresh`
   - Runs `run-single-stock.js` script
   - Updates both historical EPS and earnings estimates

2. **Automated Daily Refresh**:
   - GitHub Actions workflow at 10 PM UTC
   - Runs `refresh-all-stocks.js`
   - Processes all stocks in user watchlists
   - Rate limited to 1 stock/second

3. **Historical EPS Refresh**:
   - Can be triggered separately via `/api/companies/[ticker]/historical-eps` POST
   - Force refreshes from SEC EDGAR
   - Bypasses 7-day cache

## Date Handling Logic

When refreshing earnings dates:
1. **Yahoo Finance** provides the earnings date (sometimes as a range)
2. If a date range is provided (e.g., "Jul 28 - Aug 1, 2025"):
   - The first date (Jul 28) is extracted and stored as `earnings_date`
   - The full range string is preserved in `earnings_date_range`
3. **EarningsWhispers** is consulted ONLY for:
   - Market timing (before/after market)
   - Specific time (if available)
   - The date from EarningsWhispers is NEVER used
4. This ensures consistency with Yahoo Finance as the primary source

## Data Source Reliability

### Most Reliable
1. **SEC EDGAR API**: Official regulatory filings
   - 100% accurate for historical data
   - May have 1-2 day delay after earnings release

### Moderately Reliable
2. **Yahoo Finance**: Major financial portal
   - Good for estimates and dates
   - Occasionally missing market timing

3. **EarningsWhispers**: Specialized earnings site
   - Excellent for market timing details
   - Limited ticker coverage

### Backup Sources
4. **Other financial sites**: Variable reliability
   - Used only when primary sources fail
   - May have less accurate estimates

## Update Frequency

- **Historical EPS**: Cached for 7 days, then refreshed from SEC
- **Earnings Estimates**: Refreshed daily via GitHub Actions
- **Manual Refresh**: Available anytime (rate limited)

## Error Handling

When a data source fails:
1. System attempts next source in priority order
2. Partial data updates are allowed (e.g., date without estimate)
3. Errors are logged but don't block other updates
4. User sees warning if critical data missing

## Compliance Notes

- SEC EDGAR API requires proper User-Agent header with contact email
- Web scraping respects robots.txt and rate limits
- No API keys required for current data sources
- All data is publicly available information