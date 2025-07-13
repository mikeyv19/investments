-- Clean up duplicate earnings estimates
-- Run these queries in Supabase SQL Editor

-- 1. First, let's see all MSFT earnings estimates
SELECT c.ticker, ee.earnings_date, ee.eps_estimate, ee.last_updated, ee.id
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
WHERE c.ticker = 'MSFT'
ORDER BY ee.last_updated DESC;

-- 2. See all companies with multiple earnings estimates
SELECT c.ticker, COUNT(*) as estimate_count
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
GROUP BY c.ticker
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 3. View all duplicate earnings with details
SELECT c.ticker, ee.earnings_date, ee.eps_estimate, ee.last_updated, ee.id
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
WHERE c.id IN (
    SELECT company_id 
    FROM earnings_estimates 
    GROUP BY company_id 
    HAVING COUNT(*) > 1
)
ORDER BY c.ticker, ee.last_updated DESC;

-- 4. DELETE duplicates, keeping only the most recently updated estimate per company
-- WARNING: This will delete data! Review the results above first!
DELETE FROM earnings_estimates
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY last_updated DESC) as rn
        FROM earnings_estimates
    ) t
    WHERE t.rn > 1
);

-- 5. Verify cleanup - should show only one estimate per company
SELECT c.ticker, ee.earnings_date, ee.eps_estimate, ee.last_updated
FROM earnings_estimates ee
JOIN companies c ON ee.company_id = c.id
ORDER BY ee.earnings_date;