const { join } = require('path');

/**
 * Puppeteer configuration file
 * This sets the cache directory to a local folder
 */
module.exports = {
  // Set cache directory to local .cache folder
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Skip download if environment variable is set
  skipDownload: process.env.PUPPETEER_SKIP_DOWNLOAD === 'true',
  
  // Use system Chrome if available in CI
  ...(process.env.CI && {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  })
};