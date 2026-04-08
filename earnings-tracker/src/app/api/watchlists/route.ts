import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// GET /api/watchlists - Get all user watchlists
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch owned watchlists
    const { data: ownedWatchlists, error: ownedError } = await supabase
      .from('user_watchlists')
      .select(`
        *,
        stock_count:watchlist_stocks(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (ownedError) {
      console.error('Database error:', ownedError)
      return NextResponse.json(
        { error: 'Failed to fetch watchlists' },
        { status: 500 }
      )
    }

    // Fetch shared watchlists
    const { data: sharedRecords, error: sharedError } = await supabase
      .from('watchlist_shares')
      .select(`
        watchlist_id,
        watchlist:user_watchlists(*, stock_count:watchlist_stocks(count))
      `)
      .eq('shared_with_user_id', user.id)

    if (sharedError) {
      console.error('Shared watchlists error:', sharedError)
      // Non-fatal: return owned watchlists only
    }

    const owned = (ownedWatchlists || []).map(w => ({ ...w, is_owner: true }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharedWatchlists = (sharedRecords || []).map((r: any) => r.watchlist).filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shared = sharedWatchlists.map((w: any) => ({ ...w, is_owner: false }))

    return NextResponse.json({ data: [...owned, ...shared] })
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