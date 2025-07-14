# Puppeteer Chrome Download Timeout Fix

This document explains the changes made to fix the Puppeteer Chrome download timeout issue in GitHub Actions.

## Problem
- Puppeteer was timing out while downloading Chromium during `npm install` in GitHub Actions
- This caused the scraper workflow to fail before it could even start

## Solution
We implemented a multi-layered approach:

### 1. Skip Puppeteer Chrome Download
- Set `PUPPETEER_SKIP_DOWNLOAD=true` environment variable
- This prevents Puppeteer from downloading Chromium during npm install

### 2. Use System Chrome/Chromium
- GitHub Actions Ubuntu runners have Chromium pre-installed
- We install additional dependencies to ensure it works properly
- Set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`

### 3. Chrome Finder Utility
- Created `chrome-finder.js` to detect Chrome/Chromium across different environments
- Automatically finds the correct executable path
- Provides appropriate launch options for CI environments

### 4. Enhanced GitHub Actions Workflow
- Added Chrome dependency installation step
- Added Chrome launch test to verify setup
- Proper environment variables for all scraper steps

## Files Modified

1. **`.github/workflows/scrape-earnings.yml`**
   - Added Chrome dependencies installation
   - Added environment variables for Puppeteer
   - Added Chrome launch test step

2. **`scripts/chrome-finder.js`** (new)
   - Utility to find Chrome executable
   - Provides optimized launch options

3. **`scripts/scrape-yahoo-finance.js`**
   - Updated to use chrome-finder utility
   - Better error handling

4. **`scripts/scrape-earnings-whispers.js`**
   - Updated to use chrome-finder utility

5. **`scripts/.puppeteerrc.cjs`**
   - Added CI-specific configuration
   - Skip download when environment variable is set

6. **`scripts/test-chrome-launch.js`** (new)
   - Test script to verify Chrome setup

## Testing

The workflow now includes a Chrome launch test that will:
1. Detect the Chrome/Chromium executable
2. Launch a browser instance
3. Navigate to a test page
4. Verify everything works before running scrapers

## Fallback Behavior

If system Chrome is not found:
- In CI: The workflow will fail with clear error messages
- Locally: Puppeteer will download Chrome normally (if PUPPETEER_SKIP_DOWNLOAD is not set)

## Benefits

1. **Faster CI runs** - No need to download ~100MB Chrome binary
2. **More reliable** - No download timeouts
3. **Better debugging** - Clear error messages and test step
4. **Environment aware** - Works in both CI and local development

## Local Development

For local development, you can:
1. Let Puppeteer download Chrome normally (default behavior)
2. Or set `PUPPETEER_SKIP_DOWNLOAD=true` and use your system Chrome
3. Run `node test-chrome-launch.js` to verify your setup

## Troubleshooting

If the scraper fails:
1. Check the "Test Chrome launch" step in GitHub Actions
2. Verify all Chrome dependencies are installed
3. Check that `/usr/bin/chromium-browser` exists
4. Review the error messages from chrome-finder.js