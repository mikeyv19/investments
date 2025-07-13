-- Check watchlist earnings data
-- Run this in Supabase SQL Editor to debug the issue

-- 1. Check which stocks are in watchlists
SELECT DISTINCT c.ticker, c.company_name, uw.name as watchlist_name
FROM watchlist_stocks ws
JOIN companies c ON ws.company_id = c.id
JOIN user_watchlists uw ON ws.watchlist_id = uw.id
ORDER BY c.ticker;

-- 2. Check earnings estimates for watchlist stocks
SELECT c.ticker, c.company_name, ee.earnings_date, ee.market_timing, ee.eps_estimate
FROM companies c
JOIN earnings_estimates ee ON c.id = ee.company_id
WHERE c.ticker IN ('AAPL', 'MSFT')
ORDER BY c.ticker, ee.earnings_date;

-- 3. Check the latest earnings estimates
SELECT c.ticker, ee.earnings_date, ee.market_timing, ee.eps_estimate, ee.last_updated
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
ORDER BY ee.last_updated DESC
LIMIT 10;

-- 4. Test the get_earnings_grid_data function
-- Using positional parameters (user_id, watchlist_id, start_date, end_date)
SELECT * FROM get_earnings_grid_data(
    NULL,  -- p_user_id: NULL to see all
    NULL,  -- p_watchlist_id: NULL to see all
    CURRENT_DATE::DATE,  -- p_start_date
    (CURRENT_DATE + INTERVAL '30 days')::DATE  -- p_end_date
);