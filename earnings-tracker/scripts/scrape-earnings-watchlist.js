/**
 * Earnings Scraper Script for GitHub Actions
 * 
 * This script fetches earnings data ONLY for stocks in user watchlists
 * to avoid unnecessary API calls and data storage
 */

const { createClient } = require('@supabase/supabase-js')

// Environment variables (set in GitHub Secrets)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Get all unique tickers from all user watchlists
 */
async function getWatchlistTickers() {
  try {
    console.log('Fetching watchlist tickers...')
    
    // Get all companies that are in at least one watchlist
    const { data: watchlistStocks, error } = await supabase
      .from('watchlist_stocks')
      .select(`
        company:companies(
          id,
          ticker,
          company_name
        )
      `)
    
    if (error) {
      console.error('Error fetching watchlist stocks:', error)
      return new Map()
    }
    
    // Create a map of ticker -> company info to avoid duplicates
    const tickerMap = new Map()
    
    watchlistStocks.forEach(item => {
      if (item.company) {
        tickerMap.set(item.company.ticker, {
          id: item.company.id,
          ticker: item.company.ticker,
          company_name: item.company.company_name
        })
      }
    })
    
    console.log(`Found ${tickerMap.size} unique tickers across all watchlists`)
    return tickerMap
  } catch (error) {
    console.error('Error in getWatchlistTickers:', error)
    return new Map()
  }
}

/**
 * Fetch earnings data from SEC EDGAR API for a specific ticker
 */
async function fetchEarningsFromSEC(ticker) {
  try {
    // This is a placeholder for SEC API integration
    // In production, this would call the SEC EDGAR API
    console.log(`Would fetch SEC data for ${ticker}`)
    
    // For now, return null to indicate no data
    return null
  } catch (error) {
    console.error(`Error fetching SEC data for ${ticker}:`, error)
    return null
  }
}

/**
 * Scrape earnings estimates from financial websites
 * Only for the specific tickers we're tracking
 */
async function scrapeEarningsEstimates(tickers) {
  const earningsData = []
  
  // This is where you would implement web scraping
  // For now, it's a placeholder that shows the concept
  
  console.log(`Would scrape earnings estimates for ${tickers.length} tickers`)
  
  // Example implementation structure:
  for (const ticker of tickers) {
    try {
      // 1. Check if ticker has upcoming earnings
      // 2. Scrape earnings date and estimates
      // 3. Add to earningsData array
      
      // Placeholder data for testing
      const mockData = {
        ticker: ticker,
        earningsDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        marketTiming: Math.random() > 0.5 ? 'before' : 'after',
        epsEstimate: (Math.random() * 5).toFixed(2)
      }
      
      // Only add if earnings date is in the future
      if (new Date(mockData.earningsDate) > new Date()) {
        earningsData.push(mockData)
      }
      
    } catch (error) {
      console.error(`Error scraping ${ticker}:`, error)
    }
  }
  
  return earningsData
}

/**
 * Update database with scraped earnings data
 */
async function updateDatabase(tickerMap, earningsData) {
  const results = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  }
  
  for (const earning of earningsData) {
    try {
      const company = tickerMap.get(earning.ticker)
      
      if (!company) {
        console.log(`Skipping ${earning.ticker} - not in watchlists`)
        results.skipped++
        continue
      }
      
      // Upsert earnings estimate
      const { error: upsertError } = await supabase
        .from('earnings_estimates')
        .upsert({
          company_id: company.id,
          earnings_date: earning.earningsDate,
          market_timing: earning.marketTiming,
          eps_estimate: parseFloat(earning.epsEstimate) || null,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'company_id,earnings_date'
        })
      
      if (upsertError) {
        console.error(`Error upserting earnings for ${earning.ticker}:`, upsertError)
        results.errors++
      } else {
        results.inserted++
      }
      
    } catch (error) {
      console.error(`Error processing ${earning.ticker}:`, error)
      results.errors++
    }
  }
  
  return results
}

/**
 * Clean up old earnings estimates
 */
async function cleanupOldEstimates() {
  // Only clean up estimates for companies in watchlists
  const tickerMap = await getWatchlistTickers()
  const companyIds = Array.from(tickerMap.values()).map(c => c.id)
  
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { error } = await supabase
    .from('earnings_estimates')
    .delete()
    .in('company_id', companyIds)
    .lt('earnings_date', thirtyDaysAgo.toISOString().split('T')[0])
  
  if (error) {
    console.error('Cleanup error:', error)
  } else {
    console.log('Cleaned up old estimates for watchlist companies')
  }
}

/**
 * Main function
 */
async function main() {
  console.log('===== Earnings Scraper (Watchlist Only) =====')
  console.log(`Time: ${new Date().toISOString()}`)
  
  try {
    // Step 1: Get all tickers from watchlists
    const tickerMap = await getWatchlistTickers()
    
    if (tickerMap.size === 0) {
      console.log('No tickers found in any watchlists. Exiting.')
      return
    }
    
    const tickers = Array.from(tickerMap.keys())
    console.log(`Processing tickers: ${tickers.join(', ')}`)
    
    // Step 2: Fetch historical EPS from SEC (if needed)
    console.log('\nFetching historical EPS data...')
    for (const [ticker, company] of tickerMap) {
      await fetchEarningsFromSEC(ticker)
      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Step 3: Scrape earnings estimates
    console.log('\nScraping earnings estimates...')
    const earningsData = await scrapeEarningsEstimates(tickers)
    console.log(`Found ${earningsData.length} upcoming earnings`)
    
    if (earningsData.length === 0) {
      console.log('No upcoming earnings found for watchlist stocks')
      return
    }
    
    // Step 4: Update database
    console.log('\nUpdating database...')
    const results = await updateDatabase(tickerMap, earningsData)
    
    console.log('\nUpdate complete:')
    console.log(`- Inserted/Updated: ${results.inserted}`)
    console.log(`- Skipped: ${results.skipped}`)
    console.log(`- Errors: ${results.errors}`)
    
    // Step 5: Clean up old data
    console.log('\nCleaning up old estimates...')
    await cleanupOldEstimates()
    
    // Step 6: Summary report
    const { data: summary } = await supabase
      .from('earnings_estimates')
      .select('company_id', { count: 'exact' })
      .in('company_id', Array.from(tickerMap.values()).map(c => c.id))
      .gte('earnings_date', new Date().toISOString().split('T')[0])
    
    console.log(`\nTotal upcoming earnings in database: ${summary?.length || 0}`)
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the scraper
main().then(() => {
  console.log('\nScraper finished successfully')
  process.exit(0)
}).catch(error => {
  console.error('Scraper failed:', error)
  process.exit(1)
})