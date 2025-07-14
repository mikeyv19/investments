import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Helper function to handle Supabase errors
export function handleSupabaseError(error: unknown) {
  console.error('Supabase error:', error)
  const message = error instanceof Error ? error.message : 'An error occurred with the database'
  throw new Error(message)
}