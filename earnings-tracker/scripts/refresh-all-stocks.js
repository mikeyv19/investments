/**
 * Refresh All Stocks in Database
 * 
 * This script runs daily via GitHub Actions to refresh ALL stocks
 * in the companies table, regardless of watchlist status.
 * 
 * It respects rate limits with 5 second delay between stocks.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')
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

// Rate limit delay (5 seconds between stocks to avoid rate limiting)
const RATE_LIMIT_DELAY = 5000

// Create log file
const logFile = path.join(__dirname, `refresh-logs-${new Date().toISOString().split('T')[0]}.txt`)

async function log(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(message)
  await fs.appendFile(logFile, logMessage).catch(console.error)
}

/**
 * Get all tickers that are in at least one user's watchlist
 */
async function getAllTickersInWatchlists() {
  try {
    // Get distinct companies that are in watchlists
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        id, 
        ticker, 
        company_name,
        watchlist_stocks!inner(
          watchlist_id
        )
      `)
      .order('ticker', { ascending: true })
    
    if (error) {
      await log(`Error fetching companies in watchlists: ${error.message}`)
      return []
    }
    
    // Remove duplicates (companies can be in multiple watchlists)
    const uniqueCompanies = []
    const seenIds = new Set()
    
    for (const company of companies || []) {
      if (!seenIds.has(company.id)) {
        seenIds.add(company.id)
        uniqueCompanies.push({
          id: company.id,
          ticker: company.ticker,
          company_name: company.company_name
        })
      }
    }
    
    return uniqueCompanies
  } catch (error) {
    await log(`Error in getAllTickersInWatchlists: ${error.message}`)
    return []
  }
}

/**
 * Refresh a single stock by running the scraper
 */
async function refreshStock(ticker, retryCount = 0) {
  const MAX_RETRIES = 2
  const RETRY_DELAY = 10000 // 10 seconds between retries
  
  try {
    // Run the scraper directly using child_process
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)
    
    const command = `node scrape-single-stock.js ${ticker}`
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: __dirname,
      env: {
        ...process.env,
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY
      },
      timeout: 120000 // 2 minute timeout for the entire command
    })
    
    // Check for timeout errors in stdout/stderr
    const hasTimeoutError = stdout.includes('Navigation timeout') || 
                           stderr.includes('Navigation timeout') ||
                           stdout.includes('timeout of') ||
                           stdout.includes('TimeoutError') ||
                           stdout.includes('Error scraping') && stdout.includes('timeout')
    
    // Check for success indicators in output
    const success = stdout.includes('Successfully fetched earnings data') || 
                   stdout.includes('Completed fetching data for') ||
                   stdout.includes('Updated earnings data for') ||
                   (stdout.includes('✅') && stdout.includes('Updated'))
    
    // Additional check: if we found earnings data but got a timeout on secondary sources
    const partialSuccess = stdout.includes('Found earnings date') && 
                          stdout.includes('Found EPS estimate') &&
                          stdout.includes('✓ Saved earnings estimate')
    
    if (success || partialSuccess) {
      return { success: true, message: `Successfully refreshed ${ticker}` }
    } else if (hasTimeoutError && retryCount < MAX_RETRIES) {
      // Retry for timeout errors
      await log(`  Timeout error detected for ${ticker}. Retrying in ${RETRY_DELAY/1000} seconds... (Attempt ${retryCount + 2}/${MAX_RETRIES + 1})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return refreshStock(ticker, retryCount + 1)
    } else if (hasTimeoutError && retryCount >= MAX_RETRIES) {
      return { success: false, message: `Failed to refresh ${ticker} after ${MAX_RETRIES + 1} attempts: Timeout errors` }
    } else if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
      return { success: false, message: `Failed to refresh ${ticker}: ${stderr}` }
    } else {
      return { success: false, message: `Failed to refresh ${ticker}: No data found` }
    }
  } catch (error) {
    // Check if the exec itself timed out or had a timeout-related error
    if ((error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) && retryCount < MAX_RETRIES) {
      await log(`  Command timeout for ${ticker}. Retrying in ${RETRY_DELAY/1000} seconds... (Attempt ${retryCount + 2}/${MAX_RETRIES + 1})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return refreshStock(ticker, retryCount + 1)
    }
    return { success: false, message: `Error refreshing ${ticker}: ${error.message}` }
  }
}

/**
 * Main refresh function
 */
async function refreshAllStocks() {
  await log('===== Starting Daily Stock Refresh =====')
  
  try {
    // Get all tickers that are in watchlists
    await log('Fetching all tickers from watchlists...')
    const tickers = await getAllTickersInWatchlists()
    
    if (tickers.length === 0) {
      await log('No tickers found in any watchlists')
      return
    }
    
    await log(`Found ${tickers.length} unique tickers in watchlists to refresh`)
    await log(`Tickers: ${tickers.map(t => t.ticker).join(', ')}`)
    await log('')
    
    // Track results
    const results = {
      total: tickers.length,
      successful: 0,
      failed: 0,
      errors: []
    }
    
    // Process each ticker with rate limiting
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i]
      const progress = `[${i + 1}/${tickers.length}]`
      
      await log(`${progress} Refreshing ${ticker.ticker} (${ticker.company_name})...`)
      
      const startTime = Date.now()
      const result = await refreshStock(ticker.ticker)
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      
      if (result.success) {
        results.successful++
        await log(`${progress} ✓ ${result.message} (${duration}s)`)
      } else {
        results.failed++
        results.errors.push(`${ticker.ticker}: ${result.message}`)
        await log(`${progress} ✗ ${result.message} (${duration}s)`)
      }
      
      // Rate limit delay (except for last stock)
      if (i < tickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      }
      
      await log('') // Empty line for readability
    }
    
    // Summary
    await log('===== Refresh Summary =====')
    await log(`Total stocks: ${results.total}`)
    await log(`Successful: ${results.successful}`)
    await log(`Failed: ${results.failed}`)
    
    if (results.errors.length > 0) {
      await log('\nFailed stocks:')
      
      // Group errors by type
      const timeoutErrors = results.errors.filter(e => e.includes('Timeout') || e.includes('timeout'))
      const otherErrors = results.errors.filter(e => !e.includes('Timeout') && !e.includes('timeout'))
      
      if (timeoutErrors.length > 0) {
        await log('\nTimeout errors:')
        timeoutErrors.forEach(error => log(`  - ${error}`))
      }
      
      if (otherErrors.length > 0) {
        await log('\nOther errors:')
        otherErrors.forEach(error => log(`  - ${error}`))
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    await log(`\nTotal time: ${totalTime} minutes`)
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0)
    
  } catch (error) {
    await log(`Critical error: ${error.message}`)
    process.exit(1)
  }
}

// Start time for total duration
const startTime = Date.now()

// Run the refresh
refreshAllStocks()