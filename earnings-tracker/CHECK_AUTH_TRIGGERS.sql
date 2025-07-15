-- Check for any triggers on auth.users table
SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_schema,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
    AND event_object_table = 'users';

-- Check for any functions that might handle user creation
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname ILIKE '%user%' 
    OR p.proname ILIKE '%signup%' 
    OR p.proname ILIKE '%profile%'
    AND n.nspname IN ('public', 'auth');

-- Check if there's a public.users or profiles table
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND (table_name ILIKE '%user%' OR table_name ILIKE '%profile%')
ORDER BY table_name, ordinal_position;

-- Check RLS policies on auth.users (if any custom ones exist)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'auth' AND tablename = 'users';

-- Check if email confirmations are required in auth.config
SELECT * FROM auth.config;