/**
 * Earnings Scraper Script for GitHub Actions
 * 
 * This script runs in Node.js environment and updates Supabase
 * with scraped earnings data from investor.com
 */

const { createClient } = require('@supabase/supabase-js')
const puppeteer = require('puppeteer')

// Environment variables (set in GitHub Secrets)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Investor.com earnings calendar URL
const EARNINGS_CALENDAR_URL = 'https://www.investors.com/market-trend/stock-market-today/earnings-calendar/'

/**
 * Parse earnings date and timing
 */
function parseEarningsInfo(dateText, timeText) {
  // Parse date (handle various formats)
  const date = new Date(dateText)
  const formattedDate = date.toISOString().split('T')[0]
  
  // Determine market timing
  const timing = timeText.toLowerCase().includes('after') ? 'after' : 'before'
  
  return { date: formattedDate, timing }
}

/**
 * Scrape earnings calendar using Puppeteer
 */
async function scrapeEarningsCalendar() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  const earnings = []
  
  try {
    const page = await browser.newPage()
    
    // Set user agent
    await page.setUserAgent('Personal Earnings Tracker Bot (for personal use only)')
    
    // Go to earnings calendar
    await page.goto(EARNINGS_CALENDAR_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    
    // Wait for earnings table to load
    await page.waitForSelector('.earnings-table, .earnings-calendar', {
      timeout: 10000
    })
    
    // Extract earnings data
    const scrapedData = await page.evaluate(() => {
      const data = []
      
      // Try different selectors that investor.com might use
      const rows = document.querySelectorAll(
        '.earnings-table tr, .earnings-calendar-row, [data-earnings-row]'
      )
      
      rows.forEach(row => {
        const ticker = row.querySelector('.ticker, .symbol, [data-symbol]')?.textContent?.trim()
        const company = row.querySelector('.company-name, .name, [data-company]')?.textContent?.trim()
        const date = row.querySelector('.earnings-date, .date, [data-date]')?.textContent?.trim()
        const time = row.querySelector('.earnings-time, .time, [data-time]')?.textContent?.trim()
        const estimate = row.querySelector('.eps-estimate, .estimate, [data-estimate]')?.textContent?.trim()
        
        if (ticker && date) {
          data.push({
            ticker: ticker.toUpperCase(),
            companyName: company || ticker,
            earningsDate: date,
            marketTiming: time || 'unknown',
            epsEstimate: estimate || 'N/A'
          })
        }
      })
      
      return data
    })
    
    // Process and validate scraped data
    for (const item of scrapedData) {
      try {
        const { date, timing } = parseEarningsInfo(item.earningsDate, item.marketTiming)
        
        earnings.push({
          ticker: item.ticker,
          companyName: item.companyName,
          earningsDate: date,
          marketTiming: timing,
          epsEstimate: parseFloat(item.epsEstimate.replace(/[$,]/g, '')) || null
        })
      } catch (error) {
        console.error(`Error processing ${item.ticker}:`, error)
      }
    }
    
  } catch (error) {
    console.error('Scraping error:', error)
  } finally {
    await browser.close()
  }
  
  return earnings
}

/**
 * Update database with scraped earnings data
 */
async function updateDatabase(earningsData) {
  const results = {
    inserted: 0,
    updated: 0,
    errors: 0
  }
  
  for (const earning of earningsData) {
    try {
      // First, ensure company exists
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('ticker', earning.ticker)
        .single()
      
      let companyId
      
      if (companyError || !company) {
        // Insert new company
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert({
            ticker: earning.ticker,
            company_name: earning.companyName
          })
          .select('id')
          .single()
        
        if (insertError) {
          console.error(`Error inserting company ${earning.ticker}:`, insertError)
          results.errors++
          continue
        }
        
        companyId = newCompany.id
      } else {
        companyId = company.id
      }
      
      // Upsert earnings estimate
      const { error: upsertError } = await supabase
        .from('earnings_estimates')
        .upsert({
          company_id: companyId,
          earnings_date: earning.earningsDate,
          market_timing: earning.marketTiming,
          eps_estimate: earning.epsEstimate,
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
 * Main function
 */
async function main() {
  console.log('Starting earnings scraper...')
  console.log(`Time: ${new Date().toISOString()}`)
  
  try {
    // Scrape earnings data
    console.log('Scraping investor.com...')
    const earningsData = await scrapeEarningsCalendar()
    console.log(`Found ${earningsData.length} earnings entries`)
    
    if (earningsData.length === 0) {
      console.warn('No earnings data found')
      return
    }
    
    // Update database
    console.log('Updating database...')
    const results = await updateDatabase(earningsData)
    
    console.log('Update complete:')
    console.log(`- Inserted/Updated: ${results.inserted}`)
    console.log(`- Errors: ${results.errors}`)
    
    // Clean up old estimates (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: cleanupError } = await supabase
      .from('earnings_estimates')
      .delete()
      .lt('earnings_date', thirtyDaysAgo.toISOString().split('T')[0])
    
    if (cleanupError) {
      console.error('Cleanup error:', cleanupError)
    } else {
      console.log('Cleaned up old estimates')
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the scraper
main().then(() => {
  console.log('Scraper finished successfully')
  process.exit(0)
}).catch(error => {
  console.error('Scraper failed:', error)
  process.exit(1)
})