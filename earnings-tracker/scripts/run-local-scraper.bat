@echo off
echo Running Earnings Scraper locally...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Run the scraper with environment loading
node run-local-scraper.js

pause