-- Fix the earnings grid function to show year-ago EPS instead of latest EPS

-- Drop the existing function
DROP FUNCTION IF EXISTS get_earnings_grid_data(UUID, UUID, DATE, DATE);

-- Create improved function that calculates year-ago quarter
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
            -- Extract quarter and year from latest quarter
            CASE 
                WHEN lq.fiscal_period ~ 'Q[1-4] [0-9]{4}' THEN
                    -- Get the quarter number
                    SUBSTRING(lq.fiscal_period FROM 'Q([1-4])')::INTEGER
                ELSE NULL
            END as latest_quarter_num,
            CASE 
                WHEN lq.fiscal_period ~ 'Q[1-4] [0-9]{4}' THEN
                    -- Get the year
                    SUBSTRING(lq.fiscal_period FROM '[0-9]{4}')::INTEGER
                ELSE NULL
            END as latest_year,
            -- Calculate next quarter
            CASE 
                WHEN lq.fiscal_period ~ 'Q[1-4] [0-9]{4}' THEN
                    CASE 
                        WHEN SUBSTRING(lq.fiscal_period FROM 'Q([1-4])')::INTEGER < 4 THEN
                            'Q' || (SUBSTRING(lq.fiscal_period FROM 'Q([1-4])')::INTEGER + 1)::TEXT || ' ' || SUBSTRING(lq.fiscal_period FROM '[0-9]{4}')
                        ELSE
                            'Q1 ' || (SUBSTRING(lq.fiscal_period FROM '[0-9]{4}')::INTEGER + 1)::TEXT
                    END
                ELSE NULL
            END as next_quarter,
            -- Calculate year-ago quarter (same quarter, previous year)
            CASE 
                WHEN lq.fiscal_period ~ 'Q[1-4] [0-9]{4}' THEN
                    -- For next quarter's year-ago comparison
                    CASE 
                        WHEN SUBSTRING(lq.fiscal_period FROM 'Q([1-4])')::INTEGER < 4 THEN
                            'Q' || (SUBSTRING(lq.fiscal_period FROM 'Q([1-4])')::INTEGER + 1)::TEXT || ' ' || (SUBSTRING(lq.fiscal_period FROM '[0-9]{4}')::INTEGER - 1)::TEXT
                        ELSE
                            'Q1 ' || SUBSTRING(lq.fiscal_period FROM '[0-9]{4}')
                    END
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
        he.fiscal_period,
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