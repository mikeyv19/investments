-- Fix RLS policy for companies table to allow authenticated users to create companies

-- Add INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create companies"
    ON companies FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Add UPDATE policy for service role (for automated scripts)
CREATE POLICY "Service role can update companies"
    ON companies FOR UPDATE
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Add INSERT policy for service role (for automated scripts)
CREATE POLICY "Service role can insert companies"
    ON companies FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');