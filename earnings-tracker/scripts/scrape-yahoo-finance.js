/**
 * Yahoo Finance Scraper for Earnings Data
 * 
 * This script:
 * 1. Fetches earnings dates from Yahoo Finance quote pages
 * 2. Gets EPS estimates from Yahoo Finance analysis pages
 * 3. Updates the database with this information
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

/**
 * Scrape earnings date and estimate from Yahoo Finance
 */
async function scrapeYahooFinance(ticker, browser) {
  const result = {
    ticker,
    earningsDate: null,
    epsEstimate: null,
    error: null
  }

  try {
    // First, get the earnings date from the quote page
    const quotePage = await browser.newPage()
    await quotePage.goto(`https://finance.yahoo.com/quote/${ticker}/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Wait for the page to load
    await quotePage.waitForSelector('fin-streamer, [data-field], .yf-1jj98ts', { timeout: 10000 }).catch(() => {})

    // Try to find earnings date
    const earningsDateText = await quotePage.evaluate(() => {
      // Try multiple selectors as Yahoo Finance changes their structure
      const selectors = [
        'span[title="Earnings Date"] + span',
        'span:contains("Earnings Date") + span',
        '[data-test="EARNINGS_DATE-value"]',
        '.yf-1jj98ts span.label:contains("Earnings Date") + span.value'
      ]
      
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector)
          if (element && element.textContent) {
            return element.textContent.trim()
          }
        } catch (e) {}
      }
      
      // Alternative approach: find by text content
      const allSpans = document.querySelectorAll('span')
      for (let i = 0; i < allSpans.length; i++) {
        if (allSpans[i].textContent.includes('Earnings Date') && allSpans[i + 1]) {
          return allSpans[i + 1].textContent.trim()
        }
      }
      
      return null
    })

    if (earningsDateText) {
      result.earningsDate = parseEarningsDate(earningsDateText)
      console.log(`  Found earnings date: ${earningsDateText}`)
    } else {
      console.log(`  No earnings date found for ${ticker}`)
    }

    await quotePage.close()

    // Now get the EPS estimate from the analysis page
    const analysisPage = await browser.newPage()
    await analysisPage.goto(`https://finance.yahoo.com/quote/${ticker}/analysis/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Wait for the analysis content to load
    await analysisPage.waitForSelector('table, section[data-testid="earningsEstimate"]', { timeout: 10000 }).catch(() => {})
    
    // Add a small delay to ensure content is fully loaded
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Get the current quarter estimate
    const epsEstimate = await analysisPage.evaluate(() => {
      // First, try to find the estimate in the specific div structure
      // Look for the tooltip div with title="Estimate" and the txt-positive span
      const estimateDivs = document.querySelectorAll('div[title="Estimate"]')
      for (const div of estimateDivs) {
        const span = div.querySelector('span.txt-positive, span.txt-negative')
        if (span) {
          const text = span.textContent.trim()
          // Remove + or - sign and validate it's a number
          const cleanText = text.replace(/^[+-]/, '')
          if (cleanText.match(/^\d+\.?\d*$/)) {
            console.log('Found estimate in tooltip div:', text)
            return text
          }
        }
      }
      
      // Alternative: Look for txt-positive/txt-negative spans near "Estimate" text
      const allSpans = document.querySelectorAll('span.txt-positive, span.txt-negative')
      for (const span of allSpans) {
        const parent = span.parentElement
        if (parent && parent.textContent.includes('Estimate')) {
          const text = span.textContent.trim()
          const cleanText = text.replace(/^[+-]/, '')
          if (cleanText.match(/^\d+\.?\d*$/)) {
            console.log('Found estimate span near "Estimate" text:', text)
            return text
          }
        }
      }
      
      // Fallback: Try to find the current quarter estimate in tables
      const tables = document.querySelectorAll('table')
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr')
        for (const row of rows) {
          const cells = row.querySelectorAll('td')
          // Look for "Current Qtr" row - the estimate is typically in the 2nd column
          if (cells.length >= 2) {
            const firstCellText = cells[0].textContent.trim()
            if (firstCellText.includes('Current Qtr') || 
                firstCellText.includes('Current Quarter') ||
                (firstCellText.match(/Q\d\s+\d{4}/) && row.innerHTML.includes('Estimate'))) {
              // Get the text from the second cell (index 1)
              const estimateText = cells[1].textContent.trim()
              // Make sure it's a number and not a percentage or date
              if (estimateText.match(/^-?\d+\.?\d*$/) && !estimateText.includes('%')) {
                console.log('Found Current Qtr estimate in table:', estimateText)
                return estimateText
              }
            }
          }
        }
      }
      
      // Debug: log what we found
      console.log('Estimate divs found:', estimateDivs.length)
      console.log('txt-positive/negative spans found:', allSpans.length)
      console.log('Tables found:', tables.length)
      
      return null
    })

    if (epsEstimate) {
      // Handle potential negative numbers and clean the string
      const cleanEstimate = epsEstimate.replace(/[^0-9.-]/g, '')
      result.epsEstimate = parseFloat(cleanEstimate)
      console.log(`  Found EPS estimate: ${epsEstimate} (parsed as ${result.epsEstimate})`)
    } else {
      console.log(`  No EPS estimate found for ${ticker}`)
    }

    await analysisPage.close()

  } catch (error) {
    console.error(`  Error scraping ${ticker}:`, error.message)
    result.error = error.message
  }

  return result
}

/**
 * Parse earnings date string to ISO format
 */
function parseEarningsDate(dateText) {
  try {
    // Handle date ranges (e.g., "Jul 28 - Aug 1, 2025")
    const dateMatch = dateText.match(/([A-Za-z]+\s+\d+)(?:\s*-\s*[A-Za-z]+\s+\d+)?,?\s+(\d{4})/)
    if (dateMatch) {
      const [_, firstDate, year] = dateMatch
      const date = new Date(`${firstDate}, ${year}`)
      return date.toISOString().split('T')[0]
    }
    
    // Try direct parsing
    const date = new Date(dateText)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch (error) {
    console.error('Error parsing date:', dateText, error)
  }
  return null
}

/**
 * Update database with scraped data
 */
async function updateDatabase(scrapedData) {
  for (const data of scrapedData) {
    if (!data.earningsDate && !data.epsEstimate) {
      continue
    }

    try {
      // Get company ID
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('ticker', data.ticker)
        .single()

      if (!company) {
        console.log(`  Company ${data.ticker} not found in database`)
        continue
      }

      // Update or insert earnings estimate
      if (data.earningsDate) {
        const { error } = await supabase
          .from('earnings_estimates')
          .upsert({
            company_id: company.id,
            earnings_date: data.earningsDate,
            market_timing: 'after', // Default to 'after' when Yahoo doesn't specify
            eps_estimate: data.epsEstimate,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'company_id,earnings_date',
            ignoreDuplicates: false
          })

        if (error) {
          console.error(`  Error updating ${data.ticker}:`, error)
        } else {
          console.log(`  Updated ${data.ticker} successfully`)
        }
      }
    } catch (error) {
      console.error(`  Error processing ${data.ticker}:`, error)
    }
  }
}

/**
 * Main scraper function
 */
async function scrapeEarningsData() {
  console.log('===== Yahoo Finance Earnings Scraper =====')
  console.log('Time:', new Date().toISOString())
  console.log('')

  try {
    // Get all unique tickers from watchlists
    const { data: watchlistStocks } = await supabase
      .from('watchlist_stocks')
      .select('company_id, companies(ticker)')

    if (!watchlistStocks || watchlistStocks.length === 0) {
      console.log('No stocks in watchlists')
      return
    }

    const tickers = [...new Set(watchlistStocks.map(ws => ws.companies.ticker))]
    console.log(`Found ${tickers.length} unique tickers:`, tickers.join(', '))
    console.log('')

    // Launch browser with local cache
    const browser = await puppeteer.launch({
      headless: process.env.DEBUG_SCRAPER ? false : 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: puppeteer.executablePath()
    })
    
    if (process.env.DEBUG_SCRAPER) {
      console.log('Running in debug mode with visible browser...')
    }

    // Scrape data for each ticker
    const scrapedData = []
    for (const ticker of tickers) {
      console.log(`Processing ${ticker}...`)
      const data = await scrapeYahooFinance(ticker, browser)
      scrapedData.push(data)
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    await browser.close()

    // Update database
    console.log('\nUpdating database...')
    await updateDatabase(scrapedData)

    // Summary
    console.log('\n===== Summary =====')
    const successful = scrapedData.filter(d => d.earningsDate || d.epsEstimate).length
    const failed = scrapedData.filter(d => d.error).length
    console.log(`Successfully scraped: ${successful}`)
    console.log(`Failed: ${failed}`)
    
    if (successful > 0) {
      console.log('\nScraped data:')
      scrapedData.forEach(d => {
        if (d.earningsDate || d.epsEstimate) {
          console.log(`  ${d.ticker}:`)
          if (d.earningsDate) console.log(`    Earnings date: ${d.earningsDate}`)
          if (d.epsEstimate) console.log(`    EPS estimate: $${d.epsEstimate}`)
        }
      })
    }

  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the scraper
if (require.main === module) {
  scrapeEarningsData().then(() => {
    console.log('\nScraper finished!')
    process.exit(0)
  }).catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { scrapeYahooFinance, scrapeEarningsData }