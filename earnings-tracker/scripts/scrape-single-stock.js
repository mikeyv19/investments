/**
 * Single Stock Scraper
 * Fetches SEC historical data and Yahoo Finance earnings data for a specific ticker
 */

const { createClient } = require('@supabase/supabase-js')
const puppeteer = require('puppeteer')
const path = require('path')
const { getPuppeteerOptions } = require('./chrome-finder')

// Set Puppeteer cache directory (only if not skipping download)
if (process.env.PUPPETEER_SKIP_DOWNLOAD !== 'true') {
  process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer')
}

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// SEC configuration
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

// Import Yahoo Finance scraper
const { scrapeYahooFinance } = require('./scrape-yahoo-finance')
const { scrapeEarningsWhispers } = require('./scrape-earnings-whispers')
const { getEarningsTiming } = require('./scrape-earnings-timing')

/**
 * Scrape data for a single stock
 */
async function scrapeSingleStock(ticker) {
  console.log(`\n===== Fetching data for ${ticker} =====`)
  console.log(`Time: ${new Date().toISOString()}\n`)

  try {
    // First check if company exists in database
    let { data: company, error } = await supabase
      .from('companies')
      .select('id, ticker, company_name')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (error || !company) {
      console.log(`Company ${ticker} not found in database. Creating...`)
      
      // Create the company
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({ 
          ticker: ticker.toUpperCase(),
          company_name: ticker.toUpperCase() // Will be updated with real name later
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating company:', createError)
        return { success: false, error: createError.message }
      }

      company = newCompany
      console.log(`Created company: ${company.ticker}`)
    }

    // Skip SEC data fetching - we'll get it from Yahoo Finance instead
    // console.log('\n1. Fetching SEC data...')
    // This is now handled by Yahoo Finance scraping which includes historical EPS

    // Fetch Yahoo Finance data
    console.log('\nFetching Yahoo Finance data (including historical EPS)...')
    const browser = await puppeteer.launch(getPuppeteerOptions())

    const yahooData = await scrapeYahooFinance(ticker, browser)
    console.log('   Yahoo data received:', JSON.stringify({
      earningsDate: yahooData.earningsDate,
      earningsDateRange: yahooData.earningsDateRange
    }, null, 2))
    
    // Also get EarningsWhispers data
    console.log('   Checking EarningsWhispers for exact timing...')
    const whisperData = await scrapeEarningsWhispers(ticker, browser)
    
    // If EarningsWhispers didn't get timing, try multiple sources
    let multiSourceTiming = null
    if (!whisperData.earningsTime && !whisperData.marketTiming) {
      console.log('   EarningsWhispers timing not found, trying other sources...')
      multiSourceTiming = await getEarningsTiming(ticker, browser)
      if (multiSourceTiming) {
        console.log(`   ✓ Found timing from ${multiSourceTiming.source}`)
      }
    }
    
    await browser.close()
    
    // Merge the data - ALWAYS use Yahoo's date, only use other sources for time/timing
    const mergedData = {
      ...yahooData,
      companyName: yahooData.companyName, // Include company name from Yahoo
      // Always use Yahoo Finance date and preserve the date range
      earningsDate: yahooData.earningsDate,
      earningsDateRange: yahooData.earningsDateRange,
      // Only use other sources for time and market timing
      earningsTime: whisperData.earningsTime || multiSourceTiming?.time || null,
      marketTiming: whisperData.marketTiming || multiSourceTiming?.timing || 'after'
    }

    // Update company name if we found one
    if (mergedData.companyName && (!company.company_name || company.company_name !== mergedData.companyName)) {
      const { error: updateError } = await supabase
        .from('companies')
        .update({ company_name: mergedData.companyName })
        .eq('id', company.id)

      if (updateError) {
        console.error('   Error updating company name:', updateError.message)
      } else {
        console.log(`   ✓ Updated company name to: ${mergedData.companyName}`)
      }
    }

    if (mergedData.earningsDate || mergedData.epsEstimate || mergedData.yearAgoEPS) {
      console.log('   ✓ Found earnings data:')
      if (mergedData.earningsDate) console.log(`     Earnings date: ${mergedData.earningsDate}`)
      if (mergedData.earningsTime) console.log(`     Earnings time: ${mergedData.earningsTime} (${mergedData.marketTiming} market)`)
      if (mergedData.epsEstimate) console.log(`     EPS estimate: $${mergedData.epsEstimate}`)
      if (mergedData.yearAgoEPS) console.log(`     Year-ago EPS: $${mergedData.yearAgoEPS}`)

      // Update database
      if (mergedData.earningsDate) {
        // First, check if earnings_date_range column exists
        const updateData = {
          company_id: company.id,
          earnings_date: mergedData.earningsDate,
          market_timing: mergedData.marketTiming,
          earnings_time: mergedData.earningsTime,
          eps_estimate: mergedData.epsEstimate,
          year_ago_eps: mergedData.yearAgoEPS,
          last_updated: new Date().toISOString()
        }
        
        // Always set earnings_date_range (null if no range)
        updateData.earnings_date_range = mergedData.earningsDateRange || null
        
        console.log('   Attempting to save:', JSON.stringify({
          earnings_date: updateData.earnings_date,
          earnings_date_range: updateData.earnings_date_range,
          market_timing: updateData.market_timing
        }, null, 2))
        
        // First delete ALL existing records for this company to avoid constraint issues
        // This handles cases where the earnings date changes
        const { error: deleteError } = await supabase
          .from('earnings_estimates')
          .delete()
          .eq('company_id', company.id)
        
        if (deleteError && deleteError.code !== 'PGRST116') {
          console.error('   Error deleting old estimate:', deleteError.message)
        }
        
        // Now insert the new data
        const { error: estimateError } = await supabase
          .from('earnings_estimates')
          .insert(updateData)

        if (estimateError) {
          console.error('   Error saving earnings estimate:', estimateError.message)
          console.error('   Full error:', JSON.stringify(estimateError, null, 2))
        } else {
          console.log('   ✓ Saved earnings estimate')
        }
      }
      
    } else {
      console.log('   No Yahoo Finance data found')
    }

    console.log(`\n✅ Completed fetching data for ${ticker}`)
    return { success: true, ticker }

  } catch (error) {
    console.error(`\n❌ Error fetching data for ${ticker}:`, error.message)
    return { success: false, error: error.message }
  }
}

// Run if called directly
if (require.main === module) {
  const ticker = process.argv[2]
  
  if (!ticker) {
    console.error('Usage: node scrape-single-stock.js TICKER')
    process.exit(1)
  }

  scrapeSingleStock(ticker).then(result => {
    if (result.success) {
      console.log('\nScraper finished successfully!')
    } else {
      console.log('\nScraper failed:', result.error)
    }
    process.exit(result.success ? 0 : 1)
  })
}

module.exports.scrapeSingleStock = scrapeSingleStock