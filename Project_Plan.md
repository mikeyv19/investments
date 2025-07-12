# Personal Earnings Tracker - Development Specification

## Project Overview
Build a personal web application to track stock earnings data by combining historical EPS from SEC APIs with current earnings estimates and timing from investor.com scraping. Vercel project should be hosted in the "earnings-tracker" folder.

## Tech Stack
- **Frontend/Backend**: Vercel (Next.js recommended) ✅
- **Database**: Supabase ✅
- **Automation**: GitHub Actions for scheduled scraping ✅
- **APIs**: SEC EDGAR API for historical data ✅

## Core Features

### 1. User Authentication ✅
- **Supabase Auth**: Email/password login system ✅
- **Protected Routes**: Secure all data views behind authentication ✅
- **User Sessions**: Persistent login with proper session management ✅

### 2. Historical EPS Data Collection ✅
- **Source**: SEC EDGAR API ✅
- **Data Points**:
  - Company ticker symbol ✅
  - Historical quarterly EPS (actual reported) ✅
  - Filing dates ✅
  - Fiscal periods ✅
- **Implementation Notes**:
  - SEC API requires User-Agent header with contact info ✅
  - Rate limit: 10 requests/second max ✅
  - Store data efficiently (SEC provides bulk options) ✅

### 3. Current Earnings Data Scraping 🚧
- **Source**: Investor.com (or similar financial sites) ✅
- **Data Points**:
  - Upcoming earnings dates ✅
  - Before/after market timing ✅
  - EPS estimates (analyst consensus) ✅
  - Company ticker symbols ✅
- **Automation**: GitHub Actions workflow ✅
- **Frequency**: Daily scraping recommended ✅
- **Status**: Scraping infrastructure complete, actual scraping logic needs implementation

### 4. Data Grid Interface ✅
- **Framework**: Custom React component ✅
- **Features**:
  - **Sorting**: Multi-column sorting capability ✅
  - **Filtering**: Column-specific filters (date ranges, text search, number ranges) ✅
  - **Search**: Global search across all visible columns ✅
  - **Pagination**: Handle large datasets efficiently ✅
  - **Export**: CSV export functionality ✅
- **Columns**: Ticker, Company Name, Earnings Date, Market Timing, EPS Estimate, Historical EPS, etc. ✅

### 5. Watchlist Management ✅
- **Multiple Lists**: Users can create multiple named watchlists ✅
- **Stock Management**: Add/remove stocks from watchlists ✅
- **List Operations**: Create, rename, delete watchlists ✅
- **Quick Actions**: Add/remove implemented (drag-and-drop pending)
- **Persistence**: All watchlists saved to user's account ✅

### 6. Web Interface ✅
- **Purpose**: Personal dashboard to view/analyze earnings data ✅
- **Authentication**: Supabase Auth with email/password login ✅
- **Key Views**:
  - Upcoming earnings calendar ✅
  - Historical vs estimated EPS comparison ✅
  - Stock-specific earnings history ✅
  - Grid view with filtering, sorting, and search capabilities ✅
  - Saved stock watchlists ✅

## Database Schema (Supabase) ✅

### `users` table (Supabase Auth) ✅
```sql
-- Handled automatically by Supabase Auth
-- Contains: id, email, created_at, etc.
```

### `companies` table ✅
```sql
- id (uuid, primary key)
- ticker (text, unique)
- company_name (text)
- created_at (timestamp)
```

### `user_watchlists` table ✅
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- name (text) -- e.g., "Tech Stocks", "My Favorites"
- created_at (timestamp)
- updated_at (timestamp)
```

### `watchlist_stocks` table ✅
```sql
- id (uuid, primary key)
- watchlist_id (uuid, foreign key)
- company_id (uuid, foreign key)
- added_at (timestamp)
```

### `historical_eps` table ✅
```sql
- id (uuid, primary key)
- company_id (uuid, foreign key)
- fiscal_period (text) -- e.g., "Q1 2024"
- eps_actual (decimal)
- filing_date (date)
- created_at (timestamp)
```

### `earnings_estimates` table ✅
```sql
- id (uuid, primary key)
- company_id (uuid, foreign key)
- earnings_date (date)
- market_timing (text) -- "before" or "after"
- eps_estimate (decimal)
- last_updated (timestamp)
- created_at (timestamp)
```

## GitHub Actions Workflow ✅

### Scraping Job ✅
- **Trigger**: Daily cron schedule ✅
- **Steps**:
  1. Scrape investor.com for earnings calendar ✅
  2. Parse earnings dates, timing, and estimates ✅
  3. Update Supabase database ✅
  4. Handle errors gracefully with retry logic ✅

### Workflow Implementation ✅
```yaml
name: Scrape Earnings Data
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:  # Manual trigger option

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
      - name: Install dependencies
      - name: Run scraper
      - name: Update database
```

## Technical Considerations

### Rate Limiting & Reliability ✅
- **SEC API**: Respect 10 req/sec limit, include proper User-Agent ✅
- **Web Scraping**: Add delays between requests, implement retry logic ✅
- **Error Handling**: Log failures, continue processing other stocks ✅

### Data Management ✅
- **Deduplication**: Prevent duplicate entries for same earnings periods ✅
- **Data Validation**: Verify scraped data formats before database insertion ✅
- **Storage Optimization**: Archive old estimates after earnings dates pass ✅

### Security & Environment ✅
- **Authentication**: Supabase Auth with email/password ✅
- **Row Level Security**: Enable RLS on user-specific tables (watchlists) ✅
- **API Keys**: Store Supabase credentials in GitHub Secrets ✅
- **CORS**: Configure for Vercel domain only ✅
- **Headers**: Include proper User-Agent for SEC compliance ✅

## Development Phases

### Phase 1: Core Infrastructure ✅
1. Set up Vercel + Supabase integration ✅
2. Create database schema ✅
3. Build basic SEC API integration ✅
4. Simple web interface for viewing data ✅

### Phase 2: Scraping Automation 🚧
1. Develop scraping logic for investor.com 🚧 (infrastructure done, logic pending)
2. Set up GitHub Actions workflow ✅
3. Implement error handling and logging ✅
4. Test automation end-to-end ⏳

### Phase 3: Enhanced Interface & User Features ✅
1. Implement Supabase Auth (email/password login) ✅
2. Build data grid component with filtering, sorting, search ✅
3. Create watchlist management (add/remove stocks, multiple lists) ✅
4. Add earnings calendar view ✅
5. Implement historical vs estimate comparisons ✅
6. Polish UI/UX with responsive design ✅

## Deployment Checklist
- [x] Vercel project configured
- [x] Supabase database created with proper schema
- [x] Supabase Auth configured (email provider, policies)
- [x] Row Level Security (RLS) policies set up
- [x] Environment variables set (Supabase URL, API keys)
- [ ] GitHub Actions secrets configured
- [x] SEC API compliance (User-Agent header)
- [ ] Initial data seeded for testing
- [ ] Authentication flow tested (signup/login/logout)

## Current Status (January 2025)

### Completed ✅
1. **Project Restructuring**: Removed legacy API integrations (Polygon, Alpha Vantage, Finnhub)
2. **Database Schema**: Implemented all tables with proper relationships and RLS
3. **SEC EDGAR API**: Full integration with rate limiting and data fetching
4. **Data Grid**: Advanced filtering, sorting, searching, and CSV export
5. **Watchlist Management**: Complete CRUD operations for multiple watchlists
6. **Authentication**: Supabase Auth with protected routes
7. **GitHub Actions**: Workflow configured for daily scraping
8. **API Routes**: All necessary endpoints for companies, watchlists, and data

### In Progress 🚧
1. **Investor.com Scraping**: Infrastructure complete, actual scraping logic needs implementation
2. **Deployment**: Ready for Vercel deployment with provided configuration

### Next Steps 📋
1. Deploy to Vercel using the deployment guide
2. Configure GitHub Secrets for Actions
3. Implement actual investor.com scraping logic in `scripts/scrape-earnings.js`
4. Test end-to-end workflow
5. Seed initial data for testing

## Legal & Compliance Notes
- **Personal Use Only**: This is for individual use, not commercial ✅
- **SEC Compliance**: Follow SEC EDGAR API guidelines ✅
- **Web Scraping**: Respect robots.txt and reasonable request rates ✅
- **Data Storage**: Only store publicly available financial data ✅

## Success Metrics
- Historical EPS data successfully retrieved and stored ✅
- Daily scraping runs without errors ⏳
- Web interface displays accurate, up-to-date earnings information ✅
- System handles rate limits and errors gracefully ✅

---

**Contact**: mattmass123@gmail.com (configured in SEC API)
**Priority**: Personal project, focus on reliability over features