/**
 * Test script to verify watchlist functionality
 * Run this locally to check what stocks would be scraped
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

// Use environment variables or update these for testing
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://borpmguppzkklueyzcew.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testWatchlistCheck() {
  console.log('=== Watchlist Check Test ===\n')
  
  try {
    // 1. Check total watchlists
    const { data: watchlists, count: watchlistCount } = await supabase
      .from('user_watchlists')
      .select('*', { count: 'exact' })
    
    console.log(`Total watchlists: ${watchlistCount || 0}`)
    
    if (watchlists && watchlists.length > 0) {
      console.log('\nWatchlists:')
      watchlists.forEach(wl => {
        console.log(`  - ${wl.name} (ID: ${wl.id})`)
      })
    }
    
    // 2. Check stocks in watchlists
    const { data: watchlistStocks } = await supabase
      .from('watchlist_stocks')
      .select(`
        watchlist:user_watchlists(name),
        company:companies(ticker, company_name)
      `)
    
    // Group by ticker to find unique stocks
    const uniqueStocks = new Map()
    const stocksByWatchlist = new Map()
    
    if (watchlistStocks) {
      watchlistStocks.forEach(item => {
        if (item.company) {
          uniqueStocks.set(item.company.ticker, item.company)
          
          const watchlistName = item.watchlist?.name || 'Unknown'
          if (!stocksByWatchlist.has(watchlistName)) {
            stocksByWatchlist.set(watchlistName, [])
          }
          stocksByWatchlist.get(watchlistName).push(item.company.ticker)
        }
      })
    }
    
    console.log(`\nUnique stocks across all watchlists: ${uniqueStocks.size}`)
    
    if (uniqueStocks.size > 0) {
      console.log('\nStocks that would be scraped:')
      Array.from(uniqueStocks.values()).forEach(stock => {
        console.log(`  - ${stock.ticker}: ${stock.company_name}`)
      })
      
      console.log('\nStocks by watchlist:')
      stocksByWatchlist.forEach((stocks, watchlistName) => {
        console.log(`  ${watchlistName}: ${stocks.join(', ')}`)
      })
    } else {
      console.log('\n⚠️  WARNING: No stocks found in any watchlists!')
      console.log('The scraper will not fetch any data.')
      console.log('Please add stocks to watchlists before running the scraper.')
    }
    
    // 3. Check upcoming earnings in database
    const { data: upcomingEarnings, count: earningsCount } = await supabase
      .from('earnings_estimates')
      .select(`
        earnings_date,
        market_timing,
        eps_estimate,
        company:companies(ticker, company_name)
      `, { count: 'exact' })
      .gte('earnings_date', new Date().toISOString().split('T')[0])
      .order('earnings_date', { ascending: true })
    
    console.log(`\nUpcoming earnings in database: ${earningsCount || 0}`)
    
    if (upcomingEarnings && upcomingEarnings.length > 0) {
      console.log('\nNext 5 earnings:')
      upcomingEarnings.slice(0, 5).forEach(earning => {
        console.log(`  - ${earning.earnings_date} ${earning.market_timing}: ${earning.company?.ticker} (Est: $${earning.eps_estimate})`)
      })
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the test
testWatchlistCheck()