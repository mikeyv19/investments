import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// GET /api/watchlists - Get all user watchlists
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('user_watchlists')
      .select(`
        *,
        stock_count:watchlist_stocks(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch watchlists' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Watchlists GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/watchlists - Create a new watchlist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Watchlist name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('user_watchlists')
      .insert({
        user_id: user.id,
        name: name.trim()
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'A watchlist with this name already exists' },
          { status: 409 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create watchlist' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Watchlist POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}