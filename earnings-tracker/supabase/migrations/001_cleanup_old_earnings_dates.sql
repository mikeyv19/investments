-- Migration to clean up old earnings dates
-- This will remove all past earnings dates and keep only upcoming ones

-- First, delete all earnings estimates where the earnings_date is in the past
DELETE FROM earnings_estimates
WHERE earnings_date < CURRENT_DATE;

-- Create a function to ensure only the latest upcoming earnings date per company
CREATE OR REPLACE FUNCTION cleanup_old_earnings_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting a new earnings estimate, remove any other estimates for the same company
  DELETE FROM earnings_estimates 
  WHERE company_id = NEW.company_id 
  AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically cleanup old dates on insert
DROP TRIGGER IF EXISTS cleanup_earnings_on_insert ON earnings_estimates;
CREATE TRIGGER cleanup_earnings_on_insert
AFTER INSERT ON earnings_estimates
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_earnings_dates();

-- Also update the unique constraint to be on company_id only
-- First drop the existing constraint
ALTER TABLE earnings_estimates 
DROP CONSTRAINT IF EXISTS earnings_estimates_company_id_earnings_date_key;

-- Add a new unique constraint on company_id only
ALTER TABLE earnings_estimates
ADD CONSTRAINT earnings_estimates_company_id_key UNIQUE (company_id);

-- Create a scheduled function to clean up past earnings dates daily
CREATE OR REPLACE FUNCTION scheduled_cleanup_past_earnings()
RETURNS void AS $$
BEGIN
  DELETE FROM earnings_estimates
  WHERE earnings_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;