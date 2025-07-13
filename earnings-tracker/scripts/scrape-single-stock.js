/**
 * Single Stock Scraper
 * Fetches SEC historical data and Yahoo Finance earnings data for a specific ticker
 */

const { createClient } = require('@supabase/supabase-js')
const puppeteer = require('puppeteer')
const path = require('path')

// Set Puppeteer cache directory
process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer')

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

    // Fetch SEC data
    console.log('\n1. Fetching SEC data...')
    const cik = await getCIKFromTicker(ticker)
    
    if (cik) {
      console.log(`   CIK: ${cik}`)
      const epsData = await getHistoricalEPS(cik, ticker)
      
      if (epsData.length > 0) {
        console.log(`   Found ${epsData.length} EPS records`)
        
        // Get real company name from SEC data if available
        if (company.company_name === ticker.toUpperCase()) {
          // Try to get company name from SEC
          // This would require additional API call - skipping for now
        }
        
        // Prepare data for database
        const uniqueEps = Array.from(
          new Map(epsData.slice(0, 8).map(item => [item.fiscal_period, item])).values()
        )
        
        const epsToInsert = uniqueEps.map(entry => ({
          company_id: company.id,
          fiscal_period: entry.fiscal_period,
          eps_actual: parseFloat(entry.eps_actual),
          filing_date: entry.filing_date
        }))

        const { error: epsError } = await supabase
          .from('historical_eps')
          .upsert(epsToInsert, {
            onConflict: 'company_id,fiscal_period',
            ignoreDuplicates: false
          })

        if (epsError) {
          console.error('   Error saving EPS data:', epsError.message)
        } else {
          console.log(`   ✓ Saved ${epsToInsert.length} EPS records`)
          
          // Show latest data
          const latest = epsData[0]
          console.log(`   Latest: ${latest.fiscal_period} - EPS: $${latest.eps_actual}`)
        }
      } else {
        console.log('   No EPS data found')
      }
    } else {
      console.log('   CIK not found - skipping SEC data')
    }

    // Add delay before Yahoo Finance
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))

    // Fetch Yahoo Finance data
    console.log('\n2. Fetching Yahoo Finance data...')
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const yahooData = await scrapeYahooFinance(ticker, browser)
    await browser.close()

    if (yahooData.earningsDate || yahooData.epsEstimate) {
      console.log('   ✓ Found Yahoo data:')
      if (yahooData.earningsDate) console.log(`     Earnings date: ${yahooData.earningsDate}`)
      if (yahooData.epsEstimate) console.log(`     EPS estimate: $${yahooData.epsEstimate}`)

      // Update database
      if (yahooData.earningsDate) {
        const { error: estimateError } = await supabase
          .from('earnings_estimates')
          .upsert({
            company_id: company.id,
            earnings_date: yahooData.earningsDate,
            market_timing: 'after', // Default
            eps_estimate: yahooData.epsEstimate,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'company_id,earnings_date',
            ignoreDuplicates: false
          })

        if (estimateError) {
          console.error('   Error saving earnings estimate:', estimateError.message)
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