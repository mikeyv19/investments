/**
 * Enhanced Watchlist Scraper with Real SEC Data
 * 
 * This script:
 * 1. Fetches stocks from user watchlists
 * 2. Gets real historical EPS data from SEC EDGAR
 * 3. Determines the year-ago quarter for comparison
 * 4. Updates the database with historical data
 */

const { createClient } = require('@supabase/supabase-js')

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// SEC EDGAR configuration
const SEC_API_BASE = 'https://data.sec.gov'
const USER_AGENT = 'mattmass123@gmail.com'
const RATE_LIMIT_MS = 100

let lastRequestTime = 0

/**
 * Rate-limited fetch for SEC API
 */
async function rateLimitedFetch(url, options = {}) {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => 
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
    )
  }

  lastRequestTime = Date.now()

  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      ...options.headers
    }
  })

  return response
}

/**
 * Get company CIK from ticker
 */
async function getCIKFromTicker(ticker) {
  try {
    const response = await rateLimitedFetch(
      'https://www.sec.gov/files/company_tickers.json'
    )

    if (!response.ok) {
      console.error(`Failed to fetch company tickers: ${response.status}`)
      return null
    }

    const data = await response.json()
    const company = Object.values(data).find(
      c => c.ticker === ticker.toUpperCase()
    )

    return company ? String(company.cik_str).padStart(10, '0') : null
  } catch (error) {
    console.error(`Error getting CIK for ${ticker}:`, error.message)
    return null
  }
}

/**
 * Get historical EPS data from SEC
 */
async function getHistoricalEPS(cik, ticker) {
  try {
    const response = await rateLimitedFetch(
      `${SEC_API_BASE}/api/xbrl/companyfacts/CIK${cik}.json`
    )

    if (!response.ok) {
      console.error(`Failed to fetch company facts for ${ticker}: ${response.status}`)
      return []
    }

    const data = await response.json()
    const epsData = []

    // Look for EPS data
    const epsConcepts = ['EarningsPerShareDiluted', 'EarningsPerShareBasic', 'EarningsPerShare']

    for (const concept of epsConcepts) {
      const conceptData = data.facts?.['us-gaap']?.[concept]

      if (conceptData?.units?.['USD/shares']) {
        const epsValues = conceptData.units['USD/shares']

        for (const entry of epsValues) {
          if (entry.form === '10-Q' && entry.fp && entry.fy) {
            epsData.push({
              fiscal_period: `${entry.fp} ${entry.fy}`,
              eps_actual: entry.val,
              filing_date: entry.filed,
              end_date: entry.end
            })
          }
        }
        break
      }
    }

    // Sort by filing date (newest first)
    return epsData.sort((a, b) => 
      new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime()
    )
  } catch (error) {
    console.error(`Error fetching EPS for ${ticker}:`, error.message)
    return []
  }
}

/**
 * Get all unique tickers from watchlists
 */
async function getWatchlistTickers() {
  try {
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
    
    return tickerMap
  } catch (error) {
    console.error('Error in getWatchlistTickers:', error)
    return new Map()
  }
}

/**
 * Determine next expected quarter
 */
function getNextQuarter(latestQuarter) {
  const match = latestQuarter.match(/Q(\d) (\d{4})/)
  if (!match) return null

  const quarter = parseInt(match[1])
  const year = parseInt(match[2])

  if (quarter < 4) {
    return `Q${quarter + 1} ${year}`
  } else {
    return `Q1 ${year + 1}`
  }
}

/**
 * Get year-ago quarter
 */
function getYearAgoQuarter(currentQuarter) {
  const match = currentQuarter.match(/Q(\d) (\d{4})/)
  if (!match) return null

  const quarter = match[1]
  const year = parseInt(match[2]) - 1
  return `Q${quarter} ${year}`
}

/**
 * Main scraping function
 */
async function scrapeEarningsData() {
  console.log('===== Enhanced Watchlist Scraper with SEC Data =====')
  console.log(`Time: ${new Date().toISOString()}\n`)

  try {
    // Get all watchlist tickers
    console.log('Fetching watchlist tickers...')
    const tickerMap = await getWatchlistTickers()
    
    if (tickerMap.size === 0) {
      console.log('No tickers found in watchlists')
      return
    }

    console.log(`Found ${tickerMap.size} unique tickers: ${Array.from(tickerMap.keys()).join(', ')}\n`)

    // Get ticker to CIK mapping
    console.log('Getting CIK mappings...')
    const tickerToCIK = new Map()
    
    for (const [ticker, company] of tickerMap) {
      const cik = await getCIKFromTicker(ticker)
      if (cik) {
        tickerToCIK.set(ticker, cik)
        console.log(`  ${ticker} -> CIK: ${cik}`)
      } else {
        console.log(`  ${ticker} -> CIK not found`)
      }
    }

    console.log('\nFetching historical EPS data from SEC...')
    
    const updateResults = {
      updated: 0,
      errors: 0,
      companies: []
    }

    for (const [ticker, company] of tickerMap) {
      const cik = tickerToCIK.get(ticker)
      if (!cik) {
        console.log(`\nSkipping ${ticker} - no CIK found`)
        updateResults.errors++
        continue
      }

      console.log(`\nProcessing ${ticker}...`)
      
      // Get historical EPS data
      const epsData = await getHistoricalEPS(cik, ticker)
      
      if (epsData.length === 0) {
        console.log(`  No EPS data found`)
        updateResults.errors++
        continue
      }

      // Determine quarters
      const latestQuarter = epsData[0].fiscal_period
      const latestEPS = epsData[0].eps_actual
      const nextQuarter = getNextQuarter(latestQuarter)
      const yearAgoQuarter = getYearAgoQuarter(nextQuarter)
      
      console.log(`  Latest: ${latestQuarter} - EPS: $${latestEPS}`)
      console.log(`  Next expected: ${nextQuarter}`)
      console.log(`  Year-ago comparison: ${yearAgoQuarter}`)

      // Find year-ago EPS
      const yearAgoData = epsData.find(entry => entry.fiscal_period === yearAgoQuarter)
      if (yearAgoData) {
        console.log(`  Year-ago EPS: $${yearAgoData.eps_actual}`)
      }

      // Update database with historical EPS
      // Remove duplicates before inserting
      const uniqueEps = Array.from(
        new Map(epsData.slice(0, 8).map(item => [item.fiscal_period, item])).values()
      )
      
      const epsToInsert = uniqueEps.map(entry => ({
        company_id: company.id,
        fiscal_period: entry.fiscal_period,
        eps_actual: parseFloat(entry.eps_actual),
        filing_date: entry.filing_date
      }))

      const { error } = await supabase
        .from('historical_eps')
        .upsert(epsToInsert, {
          onConflict: 'company_id,fiscal_period',
          ignoreDuplicates: false
        })

      if (error) {
        console.error(`  Database error:`, error.message)
        updateResults.errors++
      } else {
        console.log(`  Updated ${epsToInsert.length} EPS records`)
        updateResults.updated++
        updateResults.companies.push({
          ticker,
          latestQuarter,
          latestEPS,
          nextQuarter,
          yearAgoQuarter,
          yearAgoEPS: yearAgoData?.eps_actual
        })
      }

      // Add delay between companies
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
    }

    // Summary
    console.log('\n===== Summary =====')
    console.log(`Companies processed: ${updateResults.updated}`)
    console.log(`Errors: ${updateResults.errors}`)
    
    if (updateResults.companies.length > 0) {
      console.log('\nUpdated companies:')
      updateResults.companies.forEach(c => {
        console.log(`  ${c.ticker}:`)
        console.log(`    Latest: ${c.latestQuarter} ($${c.latestEPS})`)
        console.log(`    Next: ${c.nextQuarter}`)
        if (c.yearAgoEPS) {
          console.log(`    YoY comparison: $${c.yearAgoEPS} -> Next earnings`)
        }
      })
    }

  } catch (error) {
    console.error('Scraper error:', error)
  }
}

// Run the scraper
scrapeEarningsData().then(async () => {
  console.log('\nNow running Yahoo Finance scraper for earnings dates and estimates...\n')
  
  // Run Yahoo Finance scraper after SEC data
  try {
    const { scrapeEarningsData: scrapeYahoo } = require('./scrape-yahoo-finance')
    await scrapeYahoo()
  } catch (error) {
    console.error('Error running Yahoo Finance scraper:', error.message)
  }
  
  console.log('\nAll scrapers finished!')
  process.exit(0)
})