-- Quick fix for market_timing constraint issue
-- Run this in Supabase SQL Editor

-- 1. Update any existing 'unknown' values to 'after'
UPDATE earnings_estimates 
SET market_timing = 'after' 
WHERE market_timing = 'unknown' OR market_timing IS NULL;

-- 2. Alter the column to have a default value
ALTER TABLE earnings_estimates 
ALTER COLUMN market_timing SET DEFAULT 'after';

-- 3. Verify the fix
SELECT company_id, earnings_date, market_timing, eps_estimate 
FROM earnings_estimates 
ORDER BY earnings_date;