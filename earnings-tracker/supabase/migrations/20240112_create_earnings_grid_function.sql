-- Migration to create the get_earnings_grid_data function
-- This function returns earnings data with company info for the data grid

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
    SELECT DISTINCT
        c.ticker,
        c.company_name,
        ee.earnings_date,
        ee.market_timing,
        ee.eps_estimate,
        he.eps_actual,
        he.fiscal_period,
        ee.last_updated
    FROM companies c
    LEFT JOIN earnings_estimates ee ON c.id = ee.company_id
    LEFT JOIN historical_eps he ON c.id = he.company_id
        AND he.filing_date = (
            SELECT MAX(filing_date)
            FROM historical_eps
            WHERE company_id = c.id
            AND filing_date <= COALESCE(ee.earnings_date, CURRENT_DATE)
        )
    WHERE 
        -- Filter by watchlist if provided
        (p_watchlist_id IS NULL OR EXISTS (
            SELECT 1 FROM watchlist_stocks ws
            WHERE ws.company_id = c.id
            AND ws.watchlist_id = p_watchlist_id
        ))
        -- Filter by date range if provided
        AND (p_start_date IS NULL OR ee.earnings_date >= p_start_date)
        AND (p_end_date IS NULL OR ee.earnings_date <= p_end_date)
        -- Only show companies with upcoming earnings
        AND ee.earnings_date IS NOT NULL
    ORDER BY ee.earnings_date, c.ticker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_earnings_grid_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_earnings_grid_data TO anon;