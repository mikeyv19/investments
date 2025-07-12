import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// GET /api/watchlists/[id] - Get a specific watchlist with stocks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get watchlist details
    const { data: watchlist, error: watchlistError } = await supabase
      .from('user_watchlists')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      )
    }

    // Get stocks in watchlist
    const { data: stocks, error: stocksError } = await supabase
      .from('watchlist_stocks')
      .select(`
        *,
        company:companies(*)
      `)
      .eq('watchlist_id', id)
      .order('added_at', { ascending: false })

    if (stocksError) {
      console.error('Database error:', stocksError)
      return NextResponse.json(
        { error: 'Failed to fetch watchlist stocks' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      data: {
        ...watchlist,
        stocks: stocks || []
      }
    })
  } catch (error) {
    console.error('Watchlist GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/watchlists/[id] - Update watchlist name
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('user_id', user.id)
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
        { error: 'Failed to update watchlist' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Watchlist PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/watchlists/[id] - Delete a watchlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from('user_watchlists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete watchlist' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Watchlist DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}