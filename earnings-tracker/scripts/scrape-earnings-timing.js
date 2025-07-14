/**
 * Multi-source earnings timing scraper
 * Uses multiple sources to get the most accurate earnings timing information
 */

const puppeteer = require('puppeteer')

/**
 * Scrape from Nasdaq.com
 */
async function scrapeNasdaq(ticker, browser) {
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    
    const url = `https://www.nasdaq.com/market-activity/stocks/${ticker.toLowerCase()}/earnings`
    console.log(`  Trying Nasdaq: ${url}`)
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    
    // Wait for content to load
    await page.waitForTimeout(3000)
    
    const result = await page.evaluate(() => {
      // Look for earnings date and time
      const rows = document.querySelectorAll('table tr')
      for (const row of rows) {
        const cells = row.querySelectorAll('td')
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim()
          const value = cells[1].textContent.trim()
          
          if (label.toLowerCase().includes('earnings date')) {
            // Parse the date and time
            const match = value.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)/i)
            if (match) {
              const [_, date, time] = match
              return { date, time: time || null }
            }
            return { date: value, time: null }
          }
        }
      }
      
      // Alternative: Look for specific earnings date element
      const dateElement = document.querySelector('[data-testid="earnings-date"]')
      if (dateElement) {
        return { date: dateElement.textContent.trim(), time: null }
      }
      
      return null
    })
    
    if (result) {
      console.log(`    Found on Nasdaq: ${result.date} ${result.time || ''}`)
      return result
    }
  } catch (error) {
    console.log(`    Nasdaq scrape failed: ${error.message}`)
  } finally {
    if (page) await page.close()
  }
  
  return null
}

/**
 * Scrape from MarketWatch
 */
async function scrapeMarketWatch(ticker, browser) {
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    
    const url = `https://www.marketwatch.com/investing/stock/${ticker.toLowerCase()}`
    console.log(`  Trying MarketWatch: ${url}`)
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    
    // Wait for content to load
    await page.waitForTimeout(3000)
    
    const result = await page.evaluate(() => {
      // Look for earnings information
      const keyDataElements = document.querySelectorAll('.key-data li')
      for (const element of keyDataElements) {
        const text = element.textContent.toLowerCase()
        if (text.includes('earnings') || text.includes('reports')) {
          // Extract date and timing
          const dateMatch = text.match(/(\w+\s+\d+)/i)
          const beforeMarket = text.includes('before') || text.includes('pre')
          const afterMarket = text.includes('after') || text.includes('post')
          
          if (dateMatch) {
            return {
              date: dateMatch[1],
              timing: beforeMarket ? 'before' : afterMarket ? 'after' : null
            }
          }
        }
      }
      
      return null
    })
    
    if (result) {
      console.log(`    Found on MarketWatch: ${result.date} ${result.timing || ''}`)
      return result
    }
  } catch (error) {
    console.log(`    MarketWatch scrape failed: ${error.message}`)
  } finally {
    if (page) await page.close()
  }
  
  return null
}

/**
 * Scrape from Benzinga
 */
async function scrapeBenzinga(ticker, browser) {
  let page
  try {
    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    
    const url = `https://www.benzinga.com/quote/${ticker.toUpperCase()}/earnings`
    console.log(`  Trying Benzinga: ${url}`)
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })
    
    // Wait for content to load
    await page.waitForTimeout(3000)
    
    const result = await page.evaluate(() => {
      // Look for next earnings date
      const nextEarningsElement = document.querySelector('.next-earnings-date')
      if (nextEarningsElement) {
        const text = nextEarningsElement.textContent.trim()
        const beforeMarket = text.toLowerCase().includes('before')
        const afterMarket = text.toLowerCase().includes('after')
        
        return {
          date: text.replace(/before.*|after.*/i, '').trim(),
          timing: beforeMarket ? 'before' : afterMarket ? 'after' : null
        }
      }
      
      // Alternative: Look in earnings table
      const earningsRows = document.querySelectorAll('.earnings-table tr')
      if (earningsRows.length > 1) {
        const firstRow = earningsRows[1] // Skip header
        const cells = firstRow.querySelectorAll('td')
        if (cells.length > 0) {
          const dateText = cells[0].textContent.trim()
          return { date: dateText, timing: null }
        }
      }
      
      return null
    })
    
    if (result) {
      console.log(`    Found on Benzinga: ${result.date} ${result.timing || ''}`)
      return result
    }
  } catch (error) {
    console.log(`    Benzinga scrape failed: ${error.message}`)
  } finally {
    if (page) await page.close()
  }
  
  return null
}

/**
 * Try multiple sources to get earnings timing
 */
async function getEarningsTiming(ticker, browser) {
  console.log(`  Checking multiple sources for ${ticker} earnings timing...`)
  
  const sources = [
    { name: 'Nasdaq', scraper: scrapeNasdaq },
    { name: 'MarketWatch', scraper: scrapeMarketWatch },
    { name: 'Benzinga', scraper: scrapeBenzinga }
  ]
  
  for (const source of sources) {
    try {
      const result = await source.scraper(ticker, browser)
      if (result) {
        return {
          source: source.name,
          ...result
        }
      }
    } catch (error) {
      console.log(`    ${source.name} failed: ${error.message}`)
    }
    
    // Small delay between sources
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return null
}

module.exports = { getEarningsTiming }