/**
 * Chrome/Chromium detection helper for Puppeteer
 * Finds the appropriate Chrome executable based on the environment
 */

const fs = require('fs')
const { execSync } = require('child_process')

/**
 * Get the Chrome/Chromium executable path
 * @returns {string|undefined} Path to Chrome executable or undefined if not found
 */
function getChromePath() {
  // If explicitly set via environment variable, use that
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log(`Using Chrome from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`)
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // Common Chrome/Chromium paths
  const possiblePaths = [
    // Linux (GitHub Actions)
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
    
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  ]

  // Try to find Chrome using 'which' command (Linux/Mac)
  if (process.platform !== 'win32') {
    try {
      const chromePath = execSync('which chromium-browser || which chromium || which google-chrome || which google-chrome-stable', { encoding: 'utf8' }).trim()
      if (chromePath) {
        console.log(`Found Chrome using 'which': ${chromePath}`)
        return chromePath
      }
    } catch (e) {
      // Ignore errors, continue checking
    }
  }

  // Check each possible path
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log(`Found Chrome at: ${path}`)
      return path
    }
  }

  console.log('No Chrome/Chromium executable found in common locations')
  return undefined
}

/**
 * Get Puppeteer launch options optimized for CI/CD environments
 * @param {Object} customOptions - Additional options to merge
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerLaunchOptions(customOptions = {}) {
  const chromePath = getChromePath()
  
  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // For GitHub Actions
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--deterministic-fetch',
    ],
    ...customOptions
  }

  // Only set executablePath if we found Chrome
  if (chromePath) {
    options.executablePath = chromePath
  }

  return options
}

module.exports = {
  getChromePath,
  getPuppeteerLaunchOptions
}