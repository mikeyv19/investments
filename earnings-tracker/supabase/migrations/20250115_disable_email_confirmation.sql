-- Temporarily disable email confirmation for development
-- WARNING: Only use this in development environments
-- To re-enable, set enable_confirmations = true

UPDATE auth.config 
SET enable_confirmations = false
WHERE enable_confirmations = true;

-- Note: You can also do this from the Supabase Dashboard under
-- Authentication > Providers > Email > Enable email confirmations