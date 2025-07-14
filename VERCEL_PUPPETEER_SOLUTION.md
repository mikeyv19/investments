# Vercel Puppeteer Issue Analysis & Solution Options

## Current Issue
Your refresh functionality is failing on Vercel because:
1. **Puppeteer is not installed** in `scripts/package.json` (only has @supabase/supabase-js and dotenv)
2. **Vercel serverless functions have limitations** with Puppeteer due to:
   - 50MB deployment size limit
   - Read-only filesystem (except `/tmp`)
   - No ability to install Chrome/Chromium binaries

## Your Current Architecture
```
Frontend (EarningsDataGrid) 
    ↓ POST request
API Route (/api/companies/[ticker]/refresh)
    ↓ exec() command
run-single-stock.js 
    ↓ spawns
scrape-single-stock.js (requires Puppeteer)
```

## Solution Options

### Option 1: GitHub Actions Triggered via API (Recommended)
**How it works:**
- Frontend calls your API route
- API route triggers a GitHub Actions workflow using GitHub API
- GitHub Actions runs the scraper (has full Puppeteer support)
- Results are saved directly to Supabase

**Pros:**
- Works perfectly with your existing scraper code
- No code changes needed to the scraper itself
- Free GitHub Actions minutes (2,000/month for free accounts)
- Can handle multiple concurrent refreshes

**Implementation:**
1. Create a GitHub Actions workflow that accepts webhook/dispatch events
2. Modify API route to trigger the workflow via GitHub API
3. Add status tracking in database for user feedback

### Option 2: Separate Scraping Service
**How it works:**
- Deploy scraper as a separate service (e.g., Railway, Render, or AWS Lambda with container)
- API route calls the external scraping service
- Service runs Puppeteer and returns results

**Pros:**
- Complete control over environment
- Can scale independently

**Cons:**
- Additional service to maintain
- Potential costs for hosting

### Option 3: Vercel Edge Functions with Browserless
**How it works:**
- Use a headless browser service like Browserless.io
- API route connects to external browser service
- No local Puppeteer needed

**Pros:**
- Works within Vercel's constraints
- No infrastructure to manage

**Cons:**
- Requires paid service (Browserless has free tier but limited)
- Need to modify scraper code

### Option 4: Background Job Queue
**How it works:**
- Use a job queue service (Inngest, Trigger.dev, QStash)
- API route queues the refresh job
- Worker processes job with Puppeteer support

**Pros:**
- Reliable job processing
- Built-in retries and monitoring

**Cons:**
- Another service dependency
- May have costs

## Recommendation
**Option 1 (GitHub Actions)** is the best fit because:
- You already mentioned GitHub Actions in CLAUDE.md
- Zero changes to your working scraper code
- Free for your use case
- Easy to implement
- Can be triggered on-demand from your API

Would you like me to implement the GitHub Actions solution? This would involve:
1. Creating a `.github/workflows/refresh-ticker.yml` workflow
2. Modifying the `/api/companies/[ticker]/refresh` route to trigger the workflow
3. Adding status tracking so users can see refresh progress