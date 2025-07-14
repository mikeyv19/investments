/**
 * Manual inspection script for EarningsWhispers
 * Opens browser and waits for manual inspection
 */

const puppeteer = require('puppeteer')

async function inspectEarningsWhispers(ticker) {
  console.log(`\nOpening EarningsWhispers for ${ticker}...`)
  console.log('The browser will stay open for manual inspection.\n')
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  })
  
  const page = await browser.newPage()
  
  // Log console messages
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`)
  })
  
  // Navigate to the page
  const url = `https://www.earningswhispers.com/stocks/${ticker.toLowerCase()}`
  console.log(`Navigating to: ${url}`)
  
  await page.goto(url, {
    waitUntil: 'networkidle0',
    timeout: 30000
  })
  
  // Wait a bit for any dynamic content
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Try to find and log information about the calendar data
  const pageInfo = await page.evaluate(() => {
    const info = {
      calDataExists: false,
      calDataHTML: null,
      calDataStructure: null,
      possibleTimeElements: [],
      pageTitle: document.title,
      url: window.location.href
    }
    
    // Check for caldata
    const calData = document.querySelector('#caldata')
    if (calData) {
      info.calDataExists = true
      info.calDataHTML = calData.outerHTML
      
      // Analyze structure
      info.calDataStructure = {
        tagName: calData.tagName,
        id: calData.id,
        className: calData.className,
        childCount: calData.children.length,
        children: Array.from(calData.children).map(child => ({
          tagName: child.tagName,
          id: child.id || '',
          className: child.className || '',
          text: child.textContent.trim()
        })),
        allText: calData.textContent,
        onclick: calData.getAttribute('onclick')
      }
    }
    
    // Look for any elements that might contain time
    const timePatterns = [
      /\d{1,2}:\d{2}\s*(AM|PM)/i,
      /before\s*market/i,
      /after\s*market/i,
      /pre-market/i,
      /post-market/i
    ]
    
    const allElements = document.querySelectorAll('*')
    allElements.forEach(el => {
      const text = el.textContent.trim()
      for (const pattern of timePatterns) {
        if (pattern.test(text) && !pattern.test(el.innerHTML)) {
          // This element directly contains the text
          info.possibleTimeElements.push({
            selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase(),
            tagName: el.tagName,
            id: el.id || '',
            className: el.className || '',
            text: text.substring(0, 100),
            parentId: el.parentElement?.id || '',
            parentClass: el.parentElement?.className || ''
          })
          break
        }
      }
    })
    
    return info
  })
  
  console.log('\n=== Page Analysis ===')
  console.log(`URL: ${pageInfo.url}`)
  console.log(`Title: ${pageInfo.pageTitle}`)
  console.log(`\nCalendar Data Found: ${pageInfo.calDataExists}`)
  
  if (pageInfo.calDataStructure) {
    console.log('\nCalendar Data Structure:')
    console.log(`  Tag: ${pageInfo.calDataStructure.tagName}`)
    console.log(`  ID: ${pageInfo.calDataStructure.id}`)
    console.log(`  Class: ${pageInfo.calDataStructure.className}`)
    console.log(`  Children: ${pageInfo.calDataStructure.childCount}`)
    console.log(`  OnClick: ${pageInfo.calDataStructure.onclick}`)
    console.log(`  Full Text: "${pageInfo.calDataStructure.allText}"`)
    
    console.log('\n  Child Elements:')
    pageInfo.calDataStructure.children.forEach((child, index) => {
      console.log(`    [${index}] ${child.tagName}${child.id ? '#' + child.id : ''}${child.className ? '.' + child.className : ''}: "${child.text}"`)
    })
  }
  
  if (pageInfo.possibleTimeElements.length > 0) {
    console.log('\nPossible Time Elements Found:')
    pageInfo.possibleTimeElements.forEach((el, index) => {
      console.log(`\n  [${index}] ${el.selector}`)
      console.log(`    Tag: ${el.tagName}`)
      console.log(`    Text: "${el.text}"`)
      console.log(`    Parent: ${el.parentId || el.parentClass || 'unknown'}`)
    })
  }
  
  console.log('\n=== Instructions for Manual Inspection ===')
  console.log('1. Check the Elements tab in DevTools')
  console.log('2. Search for "#caldata" in the Elements panel')
  console.log('3. Look for any elements containing time (e.g., "8:30 AM")')
  console.log('4. Check the Network tab for any XHR/Fetch requests that might load earnings data')
  console.log('5. Try clicking on the calendar or date elements to see if it triggers any changes')
  console.log('\nPress Ctrl+C when done inspecting...')
  
  // Keep browser open
  await new Promise(() => {})
}

// Run the script
const ticker = process.argv[2] || 'AAPL'
inspectEarningsWhispers(ticker).catch(console.error)