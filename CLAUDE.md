# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Earnings Tracker Web Application** that helps users track stock earnings dates efficiently. The project is designed to operate entirely within free tier limits of various services while providing a fast, reliable user experience.

**Tech Stack:**
- Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- Backend: Vercel Serverless Functions
- Database: Supabase (PostgreSQL)
- APIs: Polygon.io (primary), Alpha Vantage (backup)
- Deployment: Vercel

## Key Commands

### Initial Setup
```bash
# Create Next.js project with TypeScript and Tailwind
npx create-next-app@latest earnings-tracker --typescript --tailwind --eslint --app
cd earnings-tracker

# Install dependencies (once package.json exists)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel
```

### Database Management
```bash
# Connect to Supabase via CLI (if supabase CLI is installed)
supabase db push

# Run migrations
supabase migration up
```

## Architecture & Code Structure

### Directory Layout
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── earnings/      # Earnings data endpoints
│   │   ├── stocks/        # Stock lookup endpoints
│   │   └── cache/         # Cache management
│   ├── components/        # React components
│   │   ├── EarningsCalendar.tsx
│   │   ├── StockSearch.tsx
│   │   └── EarningsCard.tsx
│   ├── lib/              # Core utilities
│   │   ├── supabase.ts   # Database client
│   │   ├── polygon.ts    # Polygon.io integration
│   │   ├── alphavantage.ts # Alpha Vantage fallback
│   │   └── cache.ts      # Caching logic
│   └── types/            # TypeScript definitions
├── middleware.ts          # Rate limiting middleware
└── next.config.js        # Next.js configuration
```

### Key Architectural Patterns

1. **Multi-Layer Caching Strategy**
   - Database cache in Supabase (24-hour TTL for earnings data)
   - Edge caching via Vercel Edge Config
   - Client-side caching with React Query/SWR

2. **API Integration with Fallback**
   - Primary: Polygon.io (5 req/min limit)
   - Fallback: Alpha Vantage (25 req/day limit)
   - Automatic failover when rate limits hit

3. **Rate Limiting Considerations**
   - Middleware-based rate limiting per IP
   - Careful API call management to stay within free tiers
   - Request batching where possible

4. **Database Schema**
   ```sql
   -- earnings table: stores earnings date information
   -- api_cache table: caches API responses with TTL
   ```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POLYGON_API_KEY=
ALPHA_VANTAGE_API_KEY=
NEXT_PUBLIC_APP_URL=
CACHE_DURATION_HOURS=24
```

## Development Workflow

1. **Feature Development**
   - Check existing patterns in similar components
   - Ensure TypeScript types are properly defined
   - Implement caching for any new API calls
   - Test with rate limiting in mind

2. **API Integration**
   - Always implement error handling and fallbacks
   - Use the cache layer before making external API calls
   - Log API usage to monitor rate limits

3. **Performance Optimization**
   - Target <2 second API response times
   - Keep database queries under 100ms
   - Use React Server Components where possible
   - Implement loading states for better UX

## Current Project Status

The project is currently in the planning phase. The ProjectPlan.md file contains a detailed 10-phase implementation plan. To begin development:

1. Execute Phase 1: Set up the Next.js project structure
2. Create Supabase project and implement database schema
3. Set up environment variables and API connections
4. Begin implementing core features following the phase plan