-- Fix market_timing constraint and add default value

-- Update any existing 'unknown' values to 'after'
UPDATE earnings_estimates 
SET market_timing = 'after' 
WHERE market_timing = 'unknown' OR market_timing IS NULL;

-- Alter the column to have a default value
ALTER TABLE earnings_estimates 
ALTER COLUMN market_timing SET DEFAULT 'after';