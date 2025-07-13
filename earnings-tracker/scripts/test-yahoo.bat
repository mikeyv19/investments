@echo off
echo Testing Yahoo Finance scraper...
echo.

if "%1"=="" (
    echo Testing with MSFT...
    node test-yahoo-scraper.js MSFT
) else (
    echo Testing with %1...
    node test-yahoo-scraper.js %1
)

pause