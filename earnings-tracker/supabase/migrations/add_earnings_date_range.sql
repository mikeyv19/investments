-- Add earnings_date_range column to store original date range string
ALTER TABLE earnings_estimates 
ADD COLUMN earnings_date_range TEXT;

-- Add earnings_time column if it doesn't exist (for storing time from EarningsWhispers)
ALTER TABLE earnings_estimates 
ADD COLUMN IF NOT EXISTS earnings_time TEXT;

-- Add year_ago_eps column for storing historical comparison
ALTER TABLE earnings_estimates 
ADD COLUMN IF NOT EXISTS year_ago_eps DECIMAL(10, 4);

-- Update the unique constraint to allow multiple entries per company
-- (in case we need to handle multiple potential earnings dates)
-- First drop the existing constraint
ALTER TABLE earnings_estimates 
DROP CONSTRAINT IF EXISTS earnings_estimates_company_id_earnings_date_key;

-- Add a new unique constraint that includes the date range
ALTER TABLE earnings_estimates 
ADD CONSTRAINT earnings_estimates_unique_entry 
UNIQUE(company_id, earnings_date, earnings_date_range);