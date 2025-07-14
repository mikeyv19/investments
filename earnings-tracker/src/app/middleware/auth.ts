import { createClient } from '@/app/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function withAuth(handler: (request: Request, context?: unknown) => Promise<Response>) {
  return async (request: Request, context?: unknown) => {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Add user to context
    if (context && typeof context === 'object') {
      (context as Record<string, unknown>).user = session.user
    }
    
    return handler(request, context)
  }
}