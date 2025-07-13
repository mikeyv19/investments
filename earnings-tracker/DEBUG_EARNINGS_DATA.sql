-- Debug earnings data issue
-- Run these queries in Supabase SQL Editor

-- 1. Check if GOOGL exists in companies table
SELECT * FROM companies WHERE ticker IN ('GOOGL', 'AAPL', 'MSFT');

-- 2. Check if GOOGL has earnings estimates
SELECT c.ticker, ee.* 
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
WHERE c.ticker IN ('GOOGL', 'AAPL', 'MSFT')
ORDER BY c.ticker, ee.earnings_date;

-- 3. Check if GOOGL has historical EPS data
SELECT c.ticker, he.* 
FROM historical_eps he
JOIN companies c ON he.company_id = c.id
WHERE c.ticker IN ('GOOGL', 'AAPL', 'MSFT')
ORDER BY c.ticker, he.filing_date DESC
LIMIT 10;

-- 4. Check what the function returns for your watchlist
-- First get your watchlist ID
SELECT * FROM user_watchlists;

-- Then check watchlist stocks
SELECT c.ticker, c.company_name, ws.watchlist_id
FROM watchlist_stocks ws
JOIN companies c ON ws.company_id = c.id
ORDER BY c.ticker;

-- 5. Manually test the function with your data
-- Replace the watchlist_id with your actual one from above query
SELECT * FROM get_earnings_grid_data(
    NULL,  -- user_id (NULL for all)
    NULL,  -- watchlist_id (NULL for all, or use your actual ID)
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
) 
ORDER BY earnings_date, ticker;