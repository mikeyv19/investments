# Fix Year-Ago EPS Display

## Issue
The earnings grid is showing the latest reported EPS instead of the year-ago comparison EPS. For example, if Q2 2025 is the upcoming earnings, it should show Q2 2024's EPS, not Q1 2025's EPS.

## Solution
Run this SQL in your Supabase SQL Editor to fix the function:

```sql
-- Drop the existing function
DROP FUNCTION IF EXISTS get_earnings_grid_data(UUID, UUID, DATE, DATE);

-- Create improved function that shows year-ago EPS
CREATE OR REPLACE FUNCTION get_earnings_grid_data(
    p_user_id UUID DEFAULT NULL,
    p_watchlist_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    ticker TEXT,
    company_name TEXT,
    earnings_date DATE,
    market_timing TEXT,
    eps_estimate DECIMAL,
    eps_actual DECIMAL,
    fiscal_period TEXT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_quarters AS (
        -- Get the latest reported quarter for each company
        SELECT DISTINCT ON (company_id)
            company_id,
            fiscal_period,
            filing_date
        FROM historical_eps
        ORDER BY company_id, filing_date DESC
    ),
    year_ago_quarters AS (
        -- Calculate what the year-ago quarter should be
        SELECT 
            c.id as company_id,
            c.ticker,
            c.company_name,
            ee.earnings_date,
            ee.market_timing,
            ee.eps_estimate,
            ee.last_updated,
            lq.fiscal_period as latest_quarter,
            -- Calculate year-ago quarter for comparison
            CASE 
                WHEN lq.fiscal_period ~ 'Q[1-4] [0-9]{4}' THEN
                    -- Extract quarter number and subtract 1 year
                    SUBSTRING(lq.fiscal_period FROM 'Q[1-4]') || ' ' || 
                    (SUBSTRING(lq.fiscal_period FROM '[0-9]{4}')::INTEGER - 1)::TEXT
                ELSE NULL
            END as year_ago_quarter
        FROM companies c
        LEFT JOIN earnings_estimates ee ON c.id = ee.company_id
        LEFT JOIN latest_quarters lq ON c.id = lq.company_id
    )
    SELECT DISTINCT
        yaq.ticker,
        yaq.company_name,
        yaq.earnings_date,
        yaq.market_timing,
        yaq.eps_estimate,
        he.eps_actual,
        yaq.year_ago_quarter as fiscal_period,  -- Show which quarter we're comparing to
        yaq.last_updated
    FROM year_ago_quarters yaq
    LEFT JOIN historical_eps he ON yaq.company_id = he.company_id
        AND he.fiscal_period = yaq.year_ago_quarter
    WHERE 
        -- Filter by watchlist if provided
        (p_watchlist_id IS NULL OR EXISTS (
            SELECT 1 FROM watchlist_stocks ws
            WHERE ws.company_id = yaq.company_id
            AND ws.watchlist_id = p_watchlist_id
        ))
        -- Filter by date range if provided
        AND (p_start_date IS NULL OR yaq.earnings_date >= p_start_date)
        AND (p_end_date IS NULL OR yaq.earnings_date <= p_end_date)
        -- Only show companies with upcoming earnings
        AND yaq.earnings_date IS NOT NULL
    ORDER BY yaq.earnings_date, yaq.ticker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## What This Changes
1. Instead of showing the latest filed EPS (Q1 2025), it will show the year-ago quarter EPS
2. The logic automatically determines which quarter to compare based on the latest filing
3. For MSFT: If Q1 2025 was last filed, it knows Q2 2025 is next, so it shows Q2 2024 EPS

## Test After Running
1. Apply the SQL above in Supabase
2. Refresh your dashboard
3. You should now see the correct year-ago EPS values