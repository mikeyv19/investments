/**
 * EarningsWhispers scraper to get exact earnings release times
 */

const puppeteer = require('puppeteer')
const { getPuppeteerOptions } = require('./chrome-finder')

/**
 * Parse earnings time and determine market timing
 */
function parseEarningsTime(timeStr) {
  // Convert to uppercase and remove extra spaces, also remove timezone indicators
  const normalizedTime = timeStr.toUpperCase().trim().replace(/\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT)\s*$/i, '').trim()
  
  // Check if it contains AM/PM
  const isAM = normalizedTime.includes('AM')
  const isPM = normalizedTime.includes('PM')
  
  if (!isAM && !isPM) {
    return { market_timing: 'unknown', earnings_time: normalizedTime }
  }
  
  // Extract hour
  const timeMatch = normalizedTime.match(/(\d+):(\d+)/)
  if (!timeMatch) {
    return { market_timing: 'unknown', earnings_time: normalizedTime }
  }
  
  const hour = parseInt(timeMatch[1])
  const minute = parseInt(timeMatch[2])
  
  // Convert to 24-hour format
  let hour24 = hour
  if (isPM && hour !== 12) {
    hour24 = hour + 12
  } else if (isAM && hour === 12) {
    hour24 = 0
  }
  
  // Market hours are 9:30 AM - 4:00 PM ET
  // Before market: Before 9:30 AM
  // After market: After 4:00 PM
  
  const totalMinutes = hour24 * 60 + minute
  const marketOpen = 9 * 60 + 30  // 9:30 AM
  const marketClose = 16 * 60      // 4:00 PM
  
  let market_timing
  if (totalMinutes < marketOpen) {
    market_timing = 'before'
  } else if (totalMinutes >= marketClose) {
    market_timing = 'after'
  } else {
    market_timing = 'during'
  }
  
  return { market_timing, earnings_time: normalizedTime }
}

/**
 * Scrape earnings time from EarningsWhispers
 */
async function scrapeEarningsWhispers(ticker, browser) {
  const result = {
    ticker,
    earningsDate: null,
    earningsTime: null,
    marketTiming: null,
    confirmed: false,
    error: null
  }
  
  let page
  try {
    page = await browser.newPage()
    
    // Set a more realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    
    // Enable JavaScript execution
    await page.setJavaScriptEnabled(true)
    
    // Set viewport to ensure consistent rendering
    await page.setViewport({ width: 1920, height: 1080 })
    
    // Navigate to EarningsWhispers
    const url = `https://www.earningswhispers.com/stocks/${ticker.toLowerCase()}`
    console.log(`  Navigating to ${url}`)
    
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    
    // Handle cookie consent if present
    try {
      console.log('  Checking for cookie consent banner...')
      
      // Wait a moment for cookie banner to appear
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // First check if there's a cookie overlay/modal blocking the page
      const hasOverlay = await page.evaluate(() => {
        // Look for common cookie banner containers
        const overlaySelectors = [
          '.cookie-consent',
          '.cookie-banner',
          '.cookie-notice',
          '.gdpr-consent',
          '#cookie-consent',
          '#cookie-banner',
          '[class*="cookie"]',
          '[id*="cookie"]',
          '[class*="consent"]',
          '[id*="consent"]',
          '.modal:visible',
          '.overlay:visible'
        ]
        
        for (const selector of overlaySelectors) {
          try {
            const elements = document.querySelectorAll(selector)
            for (const el of elements) {
              const rect = el.getBoundingClientRect()
              const style = window.getComputedStyle(el)
              // Check if element is visible and takes up significant space
              if (rect.width > 100 && rect.height > 50 && 
                  style.display !== 'none' && 
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0') {
                return true
              }
            }
          } catch (e) {}
        }
        return false
      })
      
      if (hasOverlay) {
        console.log('  Cookie overlay detected, attempting to accept...')
        
        // Try multiple strategies to click accept
        const strategies = [
          // Strategy 1: Click by text content
          async () => {
            return await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'))
              for (const button of buttons) {
                const text = button.textContent.toLowerCase().trim()
                if (text === 'accept' || text === 'accept all' || text === 'accept cookies' || 
                    text === 'i agree' || text === 'got it' || text === 'ok' || text === 'continue') {
                  const rect = button.getBoundingClientRect()
                  if (rect.width > 0 && rect.height > 0) {
                    button.click()
                    return true
                  }
                }
              }
              return false
            })
          },
          
          // Strategy 2: Click by class/id patterns
          async () => {
            const acceptSelectors = [
              'button[class*="accept"]',
              'button[id*="accept"]',
              'a[class*="accept"]',
              'a[id*="accept"]',
              '.accept-button',
              '#accept-button',
              'button[class*="agree"]',
              'button[class*="consent"]',
              '[onclick*="accept"]'
            ]
            
            for (const selector of acceptSelectors) {
              try {
                const element = await page.$(selector)
                if (element) {
                  await element.click()
                  return true
                }
              } catch (e) {}
            }
            return false
          },
          
          // Strategy 3: Click the most prominent button in cookie banner
          async () => {
            return await page.evaluate(() => {
              const cookieBanners = document.querySelectorAll('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]')
              for (const banner of cookieBanners) {
                const buttons = banner.querySelectorAll('button, a')
                // Often the accept button is the first or most prominent button
                if (buttons.length > 0) {
                  buttons[0].click()
                  return true
                }
              }
              return false
            })
          }
        ]
        
        // Try each strategy
        let accepted = false
        for (const strategy of strategies) {
          accepted = await strategy()
          if (accepted) break
        }
        
        if (accepted) {
          console.log('  ✓ Accepted cookie consent')
          await new Promise(resolve => setTimeout(resolve, 3000)) // Wait for modal to close and page to settle
        } else {
          console.log('  ⚠️ Could not find accept button, proceeding anyway')
        }
      } else {
        console.log('  No cookie banner detected')
      }
      
      // Additional check: See if page content is now accessible
      const isPageAccessible = await page.evaluate(() => {
        const calData = document.querySelector('#caldata')
        return calData !== null
      })
      
      if (!isPageAccessible) {
        console.log('  Page content might still be blocked, waiting longer...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Try scrolling to trigger lazy loading
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2)
        })
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
    } catch (e) {
      console.log('  Error handling cookie banner:', e.message)
    }
    
    // Wait for the calendar data box with multiple strategies
    let calDataLoaded = false
    
    // Strategy 1: Wait for the calendar data element
    try {
      await page.waitForSelector('#caldata', { timeout: 5000 })
      calDataLoaded = true
    } catch (e) {
      console.log('  Calendar data not found immediately')
    }
    
    // Strategy 2: Wait for any dynamic content to load
    if (!calDataLoaded) {
      try {
        await page.waitForFunction(
          () => {
            const calData = document.querySelector('#caldata')
            if (!calData) return false
            
            // Check if caldata has actual content
            const hasSpans = calData.querySelectorAll('span').length > 0
            const hasText = calData.textContent.trim().length > 10
            
            return hasSpans || hasText
          },
          { timeout: 10000 }
        )
        calDataLoaded = true
      } catch (e) {
        console.log('  Waiting for dynamic content to load...')
      }
    }
    
    // Strategy 3: Click on elements that might trigger loading
    if (!calDataLoaded) {
      try {
        // Sometimes clicking on the calendar icon or date triggers loading
        const clickTargets = ['#caldata', '.calendar-icon', '[class*="earnings"]']
        for (const selector of clickTargets) {
          const element = await page.$(selector)
          if (element) {
            await element.click()
            await new Promise(resolve => setTimeout(resolve, 1000))
            break
          }
        }
      } catch (e) {
        console.log('  No clickable elements found')
      }
    }
    
    // Strategy 4: Wait and check periodically with more detailed checks
    if (!calDataLoaded) {
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const hasContent = await page.evaluate(() => {
          const calData = document.querySelector('#caldata')
          if (!calData) return false
          
          // Check for any time patterns in the content
          const text = calData.textContent
          const hasTimePattern = /\d{1,2}:\d{2}\s*(AM|PM)/i.test(text)
          const hasDatePattern = /\w+\s+\d{1,2}/i.test(text)
          
          return hasTimePattern || hasDatePattern || calData.children.length > 2
        })
        if (hasContent) {
          calDataLoaded = true
          break
        }
      }
    }
    
    // Take a screenshot for debugging
    if (process.env.DEBUG_SCRAPER) {
      await page.screenshot({ path: `earnings-whispers-${ticker}.png`, fullPage: true })
      console.log(`  Screenshot saved as earnings-whispers-${ticker}.png`)
    }
    
    // Extract earnings information with multiple attempts
    let earningsData = null
    for (let attempt = 0; attempt < 3; attempt++) {
      earningsData = await page.evaluate(() => {
        const calData = document.querySelector('#caldata')
        if (!calData) {
          console.log('No #caldata element found')
          return null
        }
        
        const data = {
          date: null,
          time: null,
          confirmed: false,
          debug: {}
        }
        
        // Get the date
        const dateElement = document.querySelector('#epsdate-act')
        if (dateElement && dateElement.textContent.trim()) {
          data.date = dateElement.textContent.trim()
          data.debug.dateElement = true
        } else {
          data.debug.dateElement = false
        }
        
        // Get the time - try multiple selectors
        const timeSelectors = [
          '#epsdate-time',  // Primary selector - this is what we see in the HTML
          '.epsdate-time',
          '#caldata #epsdate-time',
          'div#epsdate-time',
          '#caldata .time',
          '#caldata .row:last-child .col-12', // Last row's content
          '#caldata .row:nth-child(4) .col-12', // 4th row often contains time
          '#caldata .row .col-12:contains("PM")', // Any col-12 with PM
          '#caldata .row .col-12:contains("AM")', // Any col-12 with AM
          '#caldata div:last-child' // Sometimes it's the last div
        ]
        
        for (const selector of timeSelectors) {
          try {
            const timeElement = document.querySelector(selector)
            if (timeElement && timeElement.textContent.trim()) {
              const text = timeElement.textContent.trim()
              // Check if it contains time pattern (with or without timezone)
              if (text.match(/\d{1,2}:\d{2}\s*(AM|PM)(\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT))?/i)) {
                data.time = text
                data.debug.timeElement = true
                data.debug.timeSelector = selector
                break
              }
            }
          } catch (e) {
            // Some selectors might fail
          }
        }
        
        // If still no time, check all text within caldata for time pattern
        if (!data.time) {
          const calDataText = calData.textContent
          const timeMatch = calDataText.match(/(\d{1,2}:\d{2}\s*(AM|PM)(\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT))?)/i)
          if (timeMatch) {
            data.time = timeMatch[0]
            data.debug.timeElement = true
            data.debug.timeSelector = 'text-match'
          }
        }
        
        // Also check for any child elements that might contain time
        if (!data.time) {
          // Check all divs first (since we know time is in a div)
          const allDivs = calData.querySelectorAll('div')
          for (const div of allDivs) {
            const text = div.textContent.trim()
            if (text.match(/^\d{1,2}:\d{2}\s*(AM|PM)(\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT))?$/i)) {
              data.time = text
              data.debug.timeElement = true
              data.debug.timeSelector = 'div-search'
              data.debug.divId = div.id || 'no-id'
              break
            }
          }
          
          // If still not found, check spans
          if (!data.time) {
            const allSpans = calData.querySelectorAll('span')
            for (const span of allSpans) {
              const text = span.textContent.trim()
              if (text.match(/^\d{1,2}:\d{2}\s*(AM|PM)(\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT))?$/i)) {
                data.time = text
                data.debug.timeElement = true
                data.debug.timeSelector = 'span-search'
                data.debug.spanIndex = Array.from(allSpans).indexOf(span)
                break
              }
            }
          }
          
          // Special handling for col-12 divs within rows (based on the provided HTML structure)
          if (!data.time) {
            const rows = calData.querySelectorAll('.row')
            for (const row of rows) {
              const cols = row.querySelectorAll('.col-12')
              for (const col of cols) {
                const text = col.textContent.trim()
                // Check if this col contains ONLY a time (not mixed with other text)
                if (/^\d{1,2}:\d{2}\s*(AM|PM)(\s*(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT))?$/i.test(text)) {
                  data.time = text
                  data.debug.timeElement = true
                  data.debug.timeSelector = 'col-12-exact-match'
                  data.debug.rowIndex = Array.from(rows).indexOf(row)
                  break
                }
              }
              if (data.time) break
            }
          }
        }
        
        // Check if confirmed
        const confirmedElement = document.querySelector('#isconfirmed svg.isconfirmed')
        data.confirmed = !!confirmedElement
        
        // Also try to get the full date from onclick attribute
        const onclickAttr = calData.getAttribute('onclick')
        if (onclickAttr) {
          const match = onclickAttr.match(/gotocal\((\d{8}),/)
          if (match) {
            const dateStr = match[1]
            const year = dateStr.substring(0, 4)
            const month = dateStr.substring(4, 6)
            const day = dateStr.substring(6, 8)
            data.fullDate = `${year}-${month}-${day}`
            data.debug.foundOnclick = true
          }
        }
        
        // Enhanced debugging - log the actual HTML and structure
        data.debug.calDataHTML = calData.outerHTML
        data.debug.calDataText = calData.textContent
        data.debug.childCount = calData.children.length
        data.debug.allSpanTexts = Array.from(calData.querySelectorAll('span')).map(s => s.textContent.trim())
        
        return data
      })
      
      if (earningsData && (earningsData.date || earningsData.time)) {
        break
      }
      
      // Wait before retry
      if (attempt < 2) {
        console.log(`  Attempt ${attempt + 1} failed, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    if (earningsData) {
      console.log(`  Debug info:`)
      console.log(`    - Date element found: ${earningsData.debug.dateElement}`)
      console.log(`    - Time element found: ${earningsData.debug.timeElement}`)
      console.log(`    - Time selector used: ${earningsData.debug.timeSelector || 'none'}`)
      console.log(`    - Child count in caldata: ${earningsData.debug.childCount}`)
      console.log(`    - All span texts: ${JSON.stringify(earningsData.debug.allSpanTexts)}`)
      console.log(`    - CalData text content: "${earningsData.debug.calDataText}"`)
      
      // DO NOT use date from EarningsWhispers - only use for timing
      // The date should always come from Yahoo Finance
      // if (earningsData.fullDate) {
      //   result.earningsDate = earningsData.fullDate
      // } else if (earningsData.date) {
      //   // Parse date like "Jul 31" and add current year
      //   const currentYear = new Date().getFullYear()
      //   const parsedDate = new Date(`${earningsData.date} ${currentYear}`)
      //   if (!isNaN(parsedDate.getTime())) {
      //     result.earningsDate = parsedDate.toISOString().split('T')[0]
      //   }
      // }
      
      if (earningsData.time) {
        result.earningsTime = earningsData.time
        const { market_timing, earnings_time } = parseEarningsTime(earningsData.time)
        result.marketTiming = market_timing
        result.earningsTime = earnings_time
      }
      
      // Also check for market timing in the calData text
      if (!result.marketTiming && earningsData.debug.calDataText) {
        const calText = earningsData.debug.calDataText.toLowerCase()
        if (calText.includes('before open') || calText.includes('before market')) {
          result.marketTiming = 'before'
          console.log('  Found "before open/market" in calendar data')
        } else if (calText.includes('after close') || calText.includes('after market')) {
          result.marketTiming = 'after'
          console.log('  Found "after close/market" in calendar data')
        }
      }
      
      result.confirmed = earningsData.confirmed
      
      if (result.earningsTime || result.marketTiming) {
        console.log(`  ✓ Found earnings timing data:`)
        console.log(`    Time: ${result.earningsTime}`)
        console.log(`    Market timing: ${result.marketTiming}`)
        console.log(`    Confirmed: ${result.confirmed}`)
      } else {
        console.log(`  ⚠️ Calendar element found but no data extracted`)
        console.log(`    Full HTML:`)
        console.log(earningsData.debug.calDataHTML)
      }
    } else {
      console.log(`  No earnings data found on EarningsWhispers`)
    }
    
    // Additional fallback: Get the raw HTML and search for time patterns
    if (!result.earningsTime && !result.marketTiming) {
      console.log('  Attempting raw HTML extraction...')
      
      const rawHTML = await page.content()
      
      // Look for time patterns in the HTML
      const timeRegex = /(\d{1,2}:\d{2}\s*(AM|PM))/gi
      const timeMatches = rawHTML.match(timeRegex)
      
      if (timeMatches && timeMatches.length > 0) {
        // Filter out common false positives (like "12:00 AM" which might be default times)
        const validTimes = timeMatches.filter(time => !time.includes('12:00 AM'))
        
        if (validTimes.length > 0) {
          console.log(`  Found time patterns in HTML: ${validTimes.join(', ')}`)
          result.earningsTime = validTimes[0]
          const { market_timing } = parseEarningsTime(validTimes[0])
          result.marketTiming = market_timing
        }
      }
      
      // Also check for market timing keywords near the ticker
      const tickerRegex = new RegExp(`${ticker}[^<]*?(before market|after market|pre-market|post-market|before the bell|after the bell)`, 'gi')
      const timingMatch = rawHTML.match(tickerRegex)
      
      if (timingMatch) {
        const matchText = timingMatch[0].toLowerCase()
        if (matchText.includes('before') || matchText.includes('pre-')) {
          result.marketTiming = 'before'
          console.log('  Found "before market" near ticker in HTML')
        } else if (matchText.includes('after') || matchText.includes('post-')) {
          result.marketTiming = 'after'
          console.log('  Found "after market" near ticker in HTML')
        }
      }
    }
    
    // Final fallback: Check for common patterns in the page text
    if (!result.marketTiming) {
      const pageText = await page.evaluate(() => document.body.innerText)
      
      if (pageText.toLowerCase().includes('before market') || 
          pageText.toLowerCase().includes('pre-market') ||
          pageText.toLowerCase().includes('before the bell')) {
        result.marketTiming = 'before'
        console.log('  Found "before market" mention in page text')
      } else if (pageText.toLowerCase().includes('after market') || 
                 pageText.toLowerCase().includes('post-market') ||
                 pageText.toLowerCase().includes('after the bell') ||
                 pageText.toLowerCase().includes('after close')) {
        result.marketTiming = 'after'
        console.log('  Found "after market" mention in page text')
      }
    }
    
  } catch (error) {
    console.error(`  Error scraping EarningsWhispers for ${ticker}:`, error.message)
    result.error = error.message
  } finally {
    if (page) {
      await page.close()
    }
  }
  
  return result
}

module.exports = { scrapeEarningsWhispers, parseEarningsTime }