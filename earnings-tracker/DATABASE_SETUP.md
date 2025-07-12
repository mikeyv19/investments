# Database Setup Instructions

## Quick Fix for Current Errors

Your app is experiencing errors because the database schema hasn't been fully applied to your Supabase instance. Here's how to fix it:

### 1. Apply the Database Schema

You have two options:

#### Option A: Using Supabase Dashboard (Easier)
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the entire contents of `earnings-tracker/supabase/schema.sql`
4. Paste it into the SQL editor
5. Click "Run" to execute

#### Option B: Using Supabase CLI
```bash
cd earnings-tracker
supabase db push
```

### 2. Apply the Missing Function

If you've already applied the base schema but are missing the `get_earnings_grid_data` function:

1. Go to Supabase SQL Editor
2. Run this migration:
```sql
-- Copy contents from earnings-tracker/supabase/migrations/20240112_create_earnings_grid_function.sql
```

### 3. Verify Your Tables

Run this query in Supabase to check your tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- companies
- earnings_estimates
- historical_eps
- user_watchlists
- watchlist_stocks

### 4. Verify the Function

Check if the function exists:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

You should see `get_earnings_grid_data` in the results.

## Common Issues

### Error: "relation public.get_earnings_grid_data does not exist"
- The function hasn't been created in your database
- Run the migration file mentioned above

### Error: 500 when adding stocks to watchlist
- This could be due to missing RLS policies or foreign key constraints
- Check browser console and Supabase logs for more details

## Next Steps

After applying the schema:
1. Restart your Next.js development server
2. Try creating a watchlist
3. Add some stock tickers (e.g., AAPL, MSFT, GOOGL)
4. The earnings data grid should now load properly

## Need Help?

If you continue to see errors after applying the schema:
1. Check the browser console for specific error messages
2. Look at the Supabase logs (Dashboard > Logs > Database)
3. Verify your environment variables are set correctly