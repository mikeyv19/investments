# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Personal Earnings Tracker** web application that combines historical EPS data from SEC EDGAR API with current earnings estimates from investor.com scraping. The application allows users to track stock earnings dates, manage personal watchlists, and view earnings data in a powerful data grid.

**Tech Stack:**
- Frontend/Backend: Next.js 14+ (App Router) with Vercel Serverless Functions
- Database: Supabase (PostgreSQL with Row Level Security)
- Authentication: Supabase Auth (email/password)
- Data Sources: 
  - SEC EDGAR API for historical EPS data
  - Investor.com web scraping for earnings estimates
- Automation: GitHub Actions for daily scraping
- Deployment: Vercel

## Key Commands

```bash
# Navigate to project
cd earnings-tracker

# Install dependencies
npm install

# Run development server
npm run dev              # Starts on localhost:3000

# Production build
npm run build           # Build for production
npm start              # Run production build locally

# Linting
npm run lint           # Run ESLint

# Database setup (requires Supabase CLI)
supabase db push       # Push schema changes
supabase migration up  # Run migrations

# Scripts for scraping (GitHub Actions)
cd scripts
npm install
npm run scrape         # Run earnings scraper
```

## Architecture & Code Structure

### Directory Layout
```
earnings-tracker/
├── src/
│   └── app/
│       ├── api/                    # API endpoints (Vercel Functions)
│       │   ├── companies/          # Company search and data
│       │   ├── watchlists/         # Watchlist management
│       │   ├── health/             # Health check
│       │   └── user/               # User profile
│       ├── components/             # React components
│       │   ├── EarningsDataGrid.tsx    # Main data grid with filtering
│       │   ├── WatchlistManager.tsx    # Watchlist CRUD operations
│       │   └── auth/                   # Auth components
│       ├── contexts/               # React contexts
│       │   └── AuthContext.tsx     # Authentication state
│       ├── lib/                    # Utilities and integrations
│       │   ├── sec-edgar.ts        # SEC EDGAR API client
│       │   ├── scrapers/           # Web scraping logic
│       │   └── supabase*.ts        # Supabase clients
│       ├── types/                  # TypeScript definitions
│       │   └── index.ts            # All type definitions
│       └── dashboard/              # Dashboard pages
│           └── earnings/page.tsx   # Main earnings dashboard
├── scripts/                        # Automation scripts
│   ├── scrape-earnings.js          # Puppeteer scraper for GitHub Actions
│   └── package.json                # Script dependencies
├── supabase/
│   └── schema.sql                  # Database schema
└── .github/
    └── workflows/
        └── scrape-earnings.yml     # GitHub Actions workflow
```

## Database Schema

The application uses these main tables:

```sql
-- Core tables
companies (id, ticker, company_name, created_at)
user_watchlists (id, user_id, name, created_at, updated_at)
watchlist_stocks (id, watchlist_id, company_id, added_at)
historical_eps (id, company_id, fiscal_period, eps_actual, filing_date)
earnings_estimates (id, company_id, earnings_date, market_timing, eps_estimate, last_updated)
```

All tables have Row Level Security (RLS) enabled for data protection.

## Environment Variables

Required in `.env.local`:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>

# App Configuration
NEXT_PUBLIC_APP_URL=<your-vercel-url>
```

GitHub Secrets for Actions:
```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## API Endpoints

### Companies
- `GET /api/companies/search?q={query}` - Search companies by ticker/name
- `GET /api/companies/[ticker]/historical-eps` - Get historical EPS data
- `POST /api/companies/[ticker]/historical-eps` - Force refresh EPS data

### Watchlists
- `GET /api/watchlists` - Get user's watchlists
- `POST /api/watchlists` - Create new watchlist
- `GET /api/watchlists/[id]` - Get watchlist with stocks
- `PUT /api/watchlists/[id]` - Update watchlist name
- `DELETE /api/watchlists/[id]` - Delete watchlist
- `POST /api/watchlists/[id]/stocks` - Add stock to watchlist
- `DELETE /api/watchlists/[id]/stocks?ticker={ticker}` - Remove stock

### User
- `GET /api/user/profile` - Get user profile
- `GET /api/health` - Health check

## Key Features

1. **SEC EDGAR Integration**: Fetches historical EPS data with proper rate limiting (10 req/sec max)
2. **Automated Scraping**: GitHub Actions runs daily to update earnings estimates
3. **Data Grid**: Advanced filtering, sorting, searching, and CSV export
4. **Watchlist Management**: Create multiple named watchlists with drag-and-drop
5. **Authentication**: Email/password login with Supabase Auth
6. **Real-time Updates**: Earnings data refreshed daily via automation

## Development Workflow

1. **Database Setup**:
   ```bash
   # Apply schema
   supabase db push
   ```

2. **Start Development**:
   ```bash
   npm run dev
   ```

3. **Test SEC API**:
   ```bash
   # Test company search
   curl http://localhost:3000/api/companies/search?q=AAPL
   
   # Get historical EPS
   curl http://localhost:3000/api/companies/AAPL/historical-eps
   ```

4. **Test Scraper Locally**:
   ```bash
   cd scripts
   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scrape-earnings.js
   ```

## SEC API Compliance

**IMPORTANT**: Update the User-Agent in `/src/app/lib/sec-edgar.ts` with your contact information:
```typescript
const USER_AGENT = process.env.CONTACT_EMAIL || 'contact@example.com'
```

Rate limiting is built-in: max 10 requests/second as per SEC requirements.

## Deployment Checklist

- [ ] Update User-Agent in sec-edgar.ts with contact info
- [ ] Set up Supabase project and apply schema
- [ ] Configure environment variables in Vercel
- [ ] Set up GitHub Secrets for Actions
- [ ] Enable GitHub Actions workflow
- [ ] Test authentication flow
- [ ] Verify SEC API integration
- [ ] Test scraper in production

## Performance Considerations

- SEC API calls are rate-limited to 10/second
- Historical EPS data is cached for 7 days
- Earnings estimates updated daily via GitHub Actions
- Data grid handles up to 10,000 rows efficiently
- Watchlist operations are optimized with proper indexes

## Security Notes

- All user data is protected with Row Level Security
- Service role key only used in GitHub Actions
- API routes validate authentication
- No sensitive data exposed to client

## Current Status

The project has been restructured to match the Project Plan specifications:
- ✅ Removed legacy API integrations (Polygon, Alpha Vantage, Finnhub)
- ✅ Implemented SEC EDGAR API integration
- ✅ Created investor.com scraping infrastructure
- ✅ Built advanced data grid with filtering/sorting
- ✅ Implemented multi-watchlist management
- ✅ Set up GitHub Actions for automation
- ✅ Updated database schema to new requirements

The application is ready for deployment and testing.