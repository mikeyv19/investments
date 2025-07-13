const { join } = require('path');

/**
 * Puppeteer configuration file
 * This sets the cache directory to a local folder
 */
module.exports = {
  // Set cache directory to local .cache folder
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};