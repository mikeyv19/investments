@echo off
echo Fetching earnings data for %1...
echo.

REM Check if ticker is provided
if "%1"=="" (
    echo Error: Please provide a ticker symbol
    echo Usage: fetch-stock.bat TICKER
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Run the single stock scraper with environment loading
node run-single-stock.js %1

pause