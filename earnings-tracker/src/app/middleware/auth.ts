import { createClient } from '@/app/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function withAuth(handler: Function) {
  return async (request: Request, context?: any) => {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Add user to context
    if (context) {
      context.user = session.user
    }
    
    return handler(request, context)
  }
}