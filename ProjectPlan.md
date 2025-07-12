# Earnings Tracker Web App - Initialization Plan

## Project Overview
Free-to-run web app for tracking stock earnings dates, expected EPS, and year-over-year comparisons using Vercel + Supabase free tiers.

---

## Phase 1: Project Setup

### 1.1 Create Next.js Project
```bash
npx create-next-app@latest earnings-tracker --typescript --tailwind --eslint --app
cd earnings-tracker
```

### 1.2 Set up Supabase Project
- Create new Supabase project (name: "earnings-tracker")
- Save connection details for environment variables
- Note: Free tier allows 2 active projects

### 1.3 Deploy to Vercel
- Connect GitHub repository to Vercel
- Configure environment variables in Vercel dashboard

---

## Phase 2: Database Schema (Supabase)

```sql
-- Earnings table
CREATE TABLE earnings (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  company_name VARCHAR(255),
  earnings_date DATE NOT NULL,
  earnings_time VARCHAR(20), -- 'BMO', 'AMC', 'TBD'
  expected_eps DECIMAL(10,4),
  previous_year_eps DECIMAL(10,4),
  quarter VARCHAR(10), -- 'Q1 2024', etc.
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, earnings_date)
);

-- Cache table for API responses
CREATE TABLE api_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE,
  data JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_earnings_symbol ON earnings(symbol);
CREATE INDEX idx_earnings_date ON earnings(earnings_date);
CREATE INDEX idx_cache_key ON api_cache(cache_key);
CREATE INDEX idx_cache_expires ON api_cache(expires_at);
```

---

## Phase 3: API Strategy (Free Tier Optimized)

### Primary Data Source: Polygon.io
- **Rate Limit:** 5 requests/minute = 7,200/day free
- **Best for:** High-quality earnings data
- **Endpoint:** `/v2/reference/dividends` and earnings calendar

### Backup: Alpha Vantage
- **Rate Limit:** 25 requests/day
- **Use when:** Polygon quota exceeded
- **Endpoint:** `EARNINGS` function

### Vercel Function Limits (Free Tier)
- **Compute:** 100GB-hours/month
- **Execution:** 10-second limit per function
- **Rate:** 12 invocations per minute per function

---

## Phase 4: Smart Caching Strategy

### Caching Rules
1. **Earnings data:** Cache for 24 hours (dates rarely change)
2. **Stock info:** Cache for 1 hour
3. **API responses:** Cache in Supabase with expiration
4. **Popular stocks:** Pre-populate database

### Cache Hierarchy
1. **Supabase cache table** (primary)
2. **Vercel Edge Config** (1KB free - for most frequent data)
3. **API fallback** (when cache misses)

---

## Phase 5: File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── earnings/
│   │   │   └── route.ts          # Main earnings endpoint
│   │   ├── stock/
│   │   │   └── [symbol]/
│   │   │       └── route.ts      # Individual stock data
│   │   ├── cache/
│   │   │   └── route.ts          # Cache management
│   │   └── search/
│   │       └── route.ts          # Stock symbol search
│   ├── components/
│   │   ├── StockSearch.tsx       # Search component
│   │   ├── EarningsCard.tsx      # Individual earnings display
│   │   ├── EarningsCalendar.tsx  # Calendar view
│   │   └── Watchlist.tsx         # User favorites
│   ├── lib/
│   │   ├── supabase.ts           # Database client
│   │   ├── polygon.ts            # Polygon.io API
│   │   ├── alphavantage.ts       # Alpha Vantage API
│   │   ├── cache.ts              # Caching logic
│   │   └── utils.ts              # Helper functions
│   ├── types/
│   │   └── earnings.ts           # TypeScript definitions
│   └── page.tsx                  # Main app page
├── middleware.ts                 # Rate limiting
└── next.config.js               # Next.js configuration
```

---

## Phase 6: Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# APIs
POLYGON_API_KEY=your_polygon_key
ALPHA_VANTAGE_API_KEY=your_alphavantage_key

# App Configuration
NEXT_PUBLIC_APP_URL=your_vercel_url
CACHE_DURATION_HOURS=24
```

---

## Phase 7: Core API Implementation

### Cache Management (`lib/cache.ts`)
```typescript
export const getCachedData = async (key: string) => {
  // 1. Check Supabase cache
  // 2. Return if valid and not expired
  // 3. Return null if cache miss
}

export const setCachedData = async (key: string, data: any, hours: number = 24) => {
  // Store in Supabase with expiration
}
```

### Main Earnings API (`app/api/earnings/route.ts`)
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  
  // 1. Validate input
  // 2. Check cache first
  // 3. Try Polygon.io (if rate limit allows)
  // 4. Fallback to Alpha Vantage
  // 5. Cache successful result
  // 6. Return formatted data
}
```

---

## Phase 8: Rate Limiting Strategy

### Client-Side Protection
```typescript
// Implement request debouncing
// Show loading states
// Queue requests when rate limited
```

### Server-Side Management
```typescript
// Track API usage in database
// Implement graceful fallbacks
// Return cached data when APIs exhausted
```

### User Experience
- Show "last updated" timestamps
- Display when using cached vs live data
- Provide feedback on rate limit status

---

## Phase 9: Free Tier Optimization

### Vercel Optimizations
1. **Static Generation:** Pre-build popular stock pages
2. **ISR:** Incremental Static Regeneration for calendars
3. **Edge Functions:** Simple data lookups
4. **Code Splitting:** Minimize bundle size

### Database Optimizations
1. **Indexes:** On frequently queried columns
2. **Batch Operations:** Group database writes
3. **Connection Pooling:** Reuse connections
4. **Query Optimization:** Efficient SQL queries

---

## Phase 10: MVP Features

### Core Features
1. **Stock Symbol Search** with autocomplete
2. **Next Earnings Date** display
3. **Expected vs Previous Year EPS** comparison
4. **Earnings Time** (before/after market)
5. **Simple Calendar View** of upcoming earnings

### Nice-to-Have Features
1. **Watchlist/Favorites** (localStorage)
2. **Export to Calendar** (.ics file)
3. **Email Reminders** (using free email service)
4. **Historical EPS Trends** (simple charts)

---

## Development Timeline

### Week 1
- [ ] Project setup and deployment
- [ ] Database schema creation
- [ ] Basic API integration (Polygon.io)
- [ ] Simple stock lookup UI

### Week 2
- [ ] Caching implementation
- [ ] Alpha Vantage fallback
- [ ] Enhanced UI components
- [ ] Rate limiting and optimization

### Week 3 (Polish)
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] User experience improvements
- [ ] Documentation

---

## Success Metrics

### Technical
- API response time < 2 seconds
- 99% uptime on free tier
- Zero rate limit violations
- Database queries < 100ms

### User Experience
- Search results in < 1 second
- Accurate earnings data
- Clear loading/error states
- Mobile responsive design

---

## Risk Mitigation

### API Limits
- **Multiple data sources** for redundancy
- **Aggressive caching** to reduce API calls
- **User feedback** when data is stale

### Vercel Limits
- **Efficient functions** with minimal compute
- **Static generation** where possible
- **Edge caching** for repeated requests

### Database Limits
- **Connection pooling** to avoid connection limits
- **Efficient queries** to reduce compute
- **Regular cleanup** of expired cache data

---

## Next Steps

1. **Set up development environment**
2. **Create Supabase project and tables**
3. **Implement basic API integration**
4. **Build minimal UI for testing**
5. **Deploy to Vercel for validation**
6. **Iterate based on real usage patterns**

---

## Resources

- [Polygon.io API Docs](https://polygon.io/docs)
- [Alpha Vantage API Docs](https://www.alphavantage.co/documentation/)
- [Vercel Limits Documentation](https://vercel.com/docs/concepts/limits/overview)
- [Supabase Free Tier Limits](https://supabase.com/pricing)