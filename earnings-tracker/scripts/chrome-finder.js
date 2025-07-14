/**
 * Chrome Finder Utility
 * Detects the Chrome/Chromium executable path based on the environment
 */

const fs = require('fs');
const path = require('path');

/**
 * List of possible Chrome/Chromium executable paths
 */
const CHROME_PATHS = {
  linux: [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
    process.env.PUPPETEER_EXECUTABLE_PATH
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.PUPPETEER_EXECUTABLE_PATH
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LocalAppData + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PUPPETEER_EXECUTABLE_PATH
  ]
};

/**
 * Find the Chrome executable path
 * @returns {string|null} The path to Chrome executable or null if not found
 */
function findChrome() {
  const platform = process.platform;
  const possiblePaths = CHROME_PATHS[platform] || [];
  
  // Filter out undefined/null paths
  const validPaths = possiblePaths.filter(p => p);
  
  // Check each path
  for (const chromePath of validPaths) {
    try {
      if (fs.existsSync(chromePath)) {
        console.log(`Found Chrome at: ${chromePath}`);
        return chromePath;
      }
    } catch (e) {
      // Path doesn't exist, continue checking
    }
  }
  
  // If running in CI/GitHub Actions, log available paths
  if (process.env.CI) {
    console.log('Running in CI environment');
    console.log('Checked paths:', validPaths);
  }
  
  return null;
}

/**
 * Get Puppeteer launch options based on environment
 * @returns {Object} Puppeteer launch options
 */
function getPuppeteerOptions() {
  const options = {
    headless: process.env.DEBUG_SCRAPER ? false : 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-features=TranslateUI',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  };
  
  // In CI environment, add more stability flags
  if (process.env.CI) {
    options.args.push(
      '--single-process',
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials'
    );
  }
  
  // Check for executable path
  const executablePath = findChrome();
  if (executablePath) {
    options.executablePath = executablePath;
    console.log(`Using Chrome executable: ${executablePath}`);
  } else if (process.env.PUPPETEER_SKIP_DOWNLOAD === 'true') {
    console.error('Chrome executable not found and PUPPETEER_SKIP_DOWNLOAD is set!');
    console.error('Please ensure Chrome/Chromium is installed.');
    
    // Provide helpful message for different environments
    if (process.platform === 'linux') {
      console.error('On Ubuntu/Debian: sudo apt-get install chromium-browser');
      console.error('On RHEL/CentOS: sudo yum install chromium');
    } else if (process.platform === 'darwin') {
      console.error('On macOS: brew install --cask chromium');
    } else if (process.platform === 'win32') {
      console.error('On Windows: Download Chrome from https://www.google.com/chrome/');
    }
  }
  
  return options;
}

module.exports = {
  findChrome,
  getPuppeteerOptions
};