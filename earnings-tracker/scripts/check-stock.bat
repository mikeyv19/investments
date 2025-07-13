@echo off
echo Checking stock data...
echo.

if "%1"=="" (
    echo Error: Please provide a ticker symbol
    echo Usage: check-stock.bat TICKER
    exit /b 1
)

node check-stock-data.js %1

pause