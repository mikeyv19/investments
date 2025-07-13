@echo off
echo Running Yahoo Finance Scraper only...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Run only the Yahoo Finance scraper
node run-yahoo-only.js

pause