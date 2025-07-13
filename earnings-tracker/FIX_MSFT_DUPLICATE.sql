-- Fix MSFT duplicate earnings issue
-- Run these queries in Supabase SQL Editor

-- 1. First, check which MSFT earnings date is more recent
SELECT 
    c.ticker, 
    ee.earnings_date, 
    ee.eps_estimate, 
    ee.last_updated,
    ee.id,
    CASE 
        WHEN ee.earnings_date = '2025-07-30' THEN 'July date (likely correct)'
        WHEN ee.earnings_date = '2025-10-23' THEN 'October date (likely old/wrong)'
    END as note
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
WHERE c.ticker = 'MSFT'
ORDER BY ee.last_updated DESC;

-- 2. Delete the October date entry (which seems incorrect based on scraper output)
-- The scraper shows July 30 as the correct date
DELETE FROM earnings_estimates
WHERE id IN (
    SELECT ee.id
    FROM earnings_estimates ee
    JOIN companies c ON ee.company_id = c.id
    WHERE c.ticker = 'MSFT' 
    AND ee.earnings_date = '2025-10-23'
);

-- 3. Alternative: Delete the older entry regardless of date
-- Uncomment and run if you prefer this approach
/*
DELETE FROM earnings_estimates
WHERE id IN (
    SELECT id FROM (
        SELECT 
            ee.id,
            ROW_NUMBER() OVER (PARTITION BY ee.company_id ORDER BY ee.last_updated DESC) as rn
        FROM earnings_estimates ee
        JOIN companies c ON ee.company_id = c.id
        WHERE c.ticker = 'MSFT'
    ) t
    WHERE t.rn > 1
);
*/

-- 4. Verify the fix
SELECT c.ticker, ee.earnings_date, ee.eps_estimate, ee.last_updated
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
WHERE c.ticker = 'MSFT';