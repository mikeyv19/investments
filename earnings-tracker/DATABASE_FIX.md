# Database Fix Instructions

## Issue
The companies table is missing an INSERT policy for authenticated users, which prevents adding new companies when creating watchlist entries.

## Solution
Run the following SQL in your Supabase SQL Editor:

```sql
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
```

## Steps to Apply:
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Paste the above SQL
4. Click "Run"

This will allow authenticated users to create new companies when adding stocks to their watchlists.