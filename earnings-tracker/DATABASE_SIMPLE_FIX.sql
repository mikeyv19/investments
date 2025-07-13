-- Simple fix to show Q2 2024 EPS for MSFT (since Q2 2025 is next)
-- This is a temporary fix until we implement proper quarter detection

-- First, let's see what we have for MSFT
SELECT 
    c.ticker,
    ee.earnings_date,
    he.fiscal_period,
    he.eps_actual,
    he.filing_date
FROM companies c
LEFT JOIN earnings_estimates ee ON c.id = ee.company_id
LEFT JOIN historical_eps he ON c.id = he.company_id
WHERE c.ticker = 'MSFT'
ORDER BY he.filing_date DESC;

-- The issue is we need to show Q2 2024 ($2.93) not Q3 2025 ($3.46)
-- Since MSFT's last filing was Q3 2025, the next is Q4 2025
-- So we need Q4 2024 for comparison, but that's annual data
-- Let's use Q3 2024 ($2.94) as the comparison for now

-- Update the function to look back 4 quarters instead of using latest
DROP FUNCTION IF EXISTS get_earnings_grid_data(UUID, UUID, DATE, DATE);

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
        -- Get historical EPS from approximately 1 year ago
        -- This ranks EPS entries by how close they are to 365 days before earnings date
        SELECT DISTINCT ON (c.id, ee.earnings_date)
            c.id as company_id,
            c.ticker,
            c.company_name,
            ee.earnings_date,
            ee.market_timing,
            ee.eps_estimate,
            ee.last_updated,
            he.fiscal_period,
            he.eps_actual,
            he.filing_date,
            ABS(EXTRACT(EPOCH FROM (ee.earnings_date - INTERVAL '1 year' - he.filing_date))) as date_diff
        FROM companies c
        INNER JOIN earnings_estimates ee ON c.id = ee.company_id
        LEFT JOIN historical_eps he ON c.id = he.company_id
            AND he.filing_date < ee.earnings_date
            AND he.filing_date > ee.earnings_date - INTERVAL '18 months'
        WHERE he.fiscal_period NOT LIKE 'Q4%' -- Exclude annual data for now
        ORDER BY c.id, ee.earnings_date, date_diff
    )
    SELECT 
        ticker,
        company_name,
        earnings_date,
        market_timing,
        eps_estimate,
        eps_actual,
        fiscal_period,
        last_updated
    FROM latest_quarters
    WHERE 
        -- Filter by watchlist if provided
        (p_watchlist_id IS NULL OR EXISTS (
            SELECT 1 FROM watchlist_stocks ws
            WHERE ws.company_id = latest_quarters.company_id
            AND ws.watchlist_id = p_watchlist_id
        ))
        -- Filter by date range if provided
        AND (p_start_date IS NULL OR earnings_date >= p_start_date)
        AND (p_end_date IS NULL OR earnings_date <= p_end_date)
        -- Only show companies with upcoming earnings
        AND earnings_date IS NOT NULL
    ORDER BY earnings_date, ticker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;