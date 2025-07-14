/**
 * Optimized Refresh All Stocks in Database
 * 
 * This script runs daily via GitHub Actions to refresh ALL stocks
 * in the companies table. It reuses a single browser instance for efficiency.
 * 
 * It respects rate limits with 3 second delay between stocks.
 */

const { createClient } = require('@supabase/supabase-js')
const puppeteer = require('puppeteer')
const { getPuppeteerOptions } = require('./chrome-finder')
const { scrapeYahooFinance } = require('./scrape-yahoo-finance')
const { scrapeEarningsWhispers } = require('./scrape-earnings-whispers')
const { getEarningsTiming } = require('./scrape-earnings-timing')

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Rate limit delay (3 seconds between stocks)
const RATE_LIMIT_DELAY = 3000

/**
 * Get all tickers from the companies table
 */
async function getAllTickers() {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, ticker, company_name')
      .order('ticker', { ascending: true })
    
    if (error) {
      console.error('Error fetching companies:', error.message)
      return []
    }
    
    return companies || []
  } catch (error) {
    console.error('Error in getAllTickers:', error.message)
    return []
  }
}

/**
 * Refresh a single stock using the shared browser instance
 */
async function refreshStockWithBrowser(company, browser) {
  const { ticker, company_name } = company
  
  try {
    // Fetch Yahoo Finance data
    const yahooData = await scrapeYahooFinance(ticker, browser)
    
    // Also get EarningsWhispers data
    const whisperData = await scrapeEarningsWhispers(ticker, browser)
    
    // If EarningsWhispers didn't get timing, try multiple sources
    let multiSourceTiming = null
    if (!whisperData.earningsTime && !whisperData.marketTiming) {
      multiSourceTiming = await getEarningsTiming(ticker, browser)
    }
    
    // Merge the data
    const mergedData = {
      ...yahooData,
      companyName: yahooData.companyName || company_name,
      earningsDate: yahooData.earningsDate,
      earningsDateRange: yahooData.earningsDateRange,
      earningsTime: whisperData.earningsTime || multiSourceTiming?.time || null,
      marketTiming: whisperData.marketTiming || multiSourceTiming?.timing || 'after'
    }

    // Update company name if needed
    if (mergedData.companyName && mergedData.companyName !== company_name) {
      await supabase
        .from('companies')
        .update({ company_name: mergedData.companyName })
        .eq('id', company.id)
    }

    // Update earnings data
    if (mergedData.earningsDate || mergedData.epsEstimate || mergedData.yearAgoEPS) {
      const updateData = {
        company_id: company.id,
        earnings_date: mergedData.earningsDate,
        market_timing: mergedData.marketTiming,
        earnings_time: mergedData.earningsTime,
        eps_estimate: mergedData.epsEstimate,
        year_ago_eps: mergedData.yearAgoEPS,
        earnings_date_range: mergedData.earningsDateRange || null,
        last_updated: new Date().toISOString()
      }
      
      // Delete ALL existing records for this company first
      // This handles cases where the earnings date changes
      await supabase
        .from('earnings_estimates')
        .delete()
        .eq('company_id', company.id)
      
      // Insert new data
      const { error } = await supabase
        .from('earnings_estimates')
        .insert(updateData)

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }
      
      return { 
        success: true, 
        message: `Updated: Date=${mergedData.earningsDate}, Est=${mergedData.epsEstimate}` 
      }
    } else {
      return { success: false, message: 'No earnings data found' }
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

/**
 * Main refresh function
 */
async function refreshAllStocks() {
  console.log('========================================')
  console.log('Starting Daily Stock Refresh (Optimized)')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('========================================\n')
  
  const startTime = Date.now()
  let browser = null
  
  try {
    // Get all tickers from the database
    console.log('Fetching all tickers from database...')
    const companies = await getAllTickers()
    
    if (companies.length === 0) {
      console.log('No tickers found in database')
      return
    }
    
    console.log(`Found ${companies.length} tickers to refresh`)
    console.log(`Tickers: ${companies.map(c => c.ticker).join(', ')}`)
    console.log('\n')
    
    // Launch browser once
    console.log('Launching browser...')
    browser = await puppeteer.launch(getPuppeteerOptions())
    console.log('Browser launched successfully\n')
    
    // Track results
    const results = {
      total: companies.length,
      successful: 0,
      failed: 0,
      errors: []
    }
    
    // Process each ticker with the shared browser
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]
      const progress = `[${i + 1}/${companies.length}]`
      
      console.log(`${progress} Processing ${company.ticker}...`)
      
      const tickerStartTime = Date.now()
      const result = await refreshStockWithBrowser(company, browser)
      const duration = ((Date.now() - tickerStartTime) / 1000).toFixed(1)
      
      if (result.success) {
        results.successful++
        console.log(`${progress} ✅ ${company.ticker}: ${result.message} (${duration}s)`)
      } else {
        results.failed++
        results.errors.push(`${company.ticker}: ${result.message}`)
        console.log(`${progress} ❌ ${company.ticker}: ${result.message} (${duration}s)`)
      }
      
      // Rate limit delay (except for last stock)
      if (i < companies.length - 1) {
        console.log(`Waiting ${RATE_LIMIT_DELAY/1000} seconds...`)
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      }
      
      console.log('') // Empty line for readability
    }
    
    // Summary
    console.log('========================================')
    console.log('REFRESH SUMMARY')
    console.log('========================================')
    console.log(`Total stocks: ${results.total}`)
    console.log(`Successful: ${results.successful}`)
    console.log(`Failed: ${results.failed}`)
    
    if (results.errors.length > 0) {
      console.log('\nFailed stocks:')
      results.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log(`\nTotal time: ${totalTime} minutes`)
    console.log('========================================')
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('Critical error:', error.message)
    process.exit(1)
  } finally {
    // Always close browser
    if (browser) {
      await browser.close()
      console.log('Browser closed')
    }
  }
}

// Run if called directly
if (require.main === module) {
  refreshAllStocks()
}