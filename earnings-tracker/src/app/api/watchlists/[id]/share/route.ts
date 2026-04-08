import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/app/lib/supabase-server'

// GET /api/watchlists/[id]/share - List users this watchlist is shared with
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user owns this watchlist
    const { data: watchlist } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!watchlist) {
      return NextResponse.json({ error: 'Watchlist not found or not owned by you' }, { status: 404 })
    }

    // Get share records
    const { data: shares, error: sharesError } = await supabase
      .from('watchlist_shares')
      .select('*')
      .eq('watchlist_id', id)
      .order('created_at', { ascending: false })

    if (sharesError) {
      console.error('Database error:', sharesError)
      return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 })
    }

    // Resolve user IDs to emails using admin client
    if (shares && shares.length > 0) {
      const adminClient = createAdminClient()

      const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers()
      if (!usersError && users) {
        const emailMap = new Map(users.map(u => [u.id, u.email]))
        const sharesWithEmails = shares.map(s => ({
          ...s,
          shared_with_email: emailMap.get(s.shared_with_user_id) || 'Unknown'
        }))
        return NextResponse.json({ data: sharesWithEmails })
      }
    }

    return NextResponse.json({ data: shares || [] })
  } catch (error) {
    console.error('Share GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/watchlists/[id]/share - Share watchlist with a user by email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Prevent self-sharing
    if (normalizedEmail === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot share a watchlist with yourself' }, { status: 400 })
    }

    // Verify the user owns this watchlist
    const { data: watchlist } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!watchlist) {
      return NextResponse.json({ error: 'Watchlist not found or not owned by you' }, { status: 404 })
    }

    // Look up the target user by email using admin client
    const adminClient = createAdminClient()
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers()

    if (usersError) {
      console.error('Admin API error:', usersError)
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 })
    }

    const targetUser = users?.find(u => u.email?.toLowerCase() === normalizedEmail)
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found with that email address' }, { status: 404 })
    }

    // Create the share record
    const { data: share, error: shareError } = await supabase
      .from('watchlist_shares')
      .insert({
        watchlist_id: id,
        shared_with_user_id: targetUser.id,
        shared_by_user_id: user.id
      })
      .select()
      .single()

    if (shareError) {
      if (shareError.code === '23505') {
        return NextResponse.json({ error: 'Watchlist is already shared with this user' }, { status: 409 })
      }
      console.error('Database error:', shareError)
      return NextResponse.json({ error: 'Failed to share watchlist' }, { status: 500 })
    }

    return NextResponse.json({
      data: { ...share, shared_with_email: targetUser.email }
    })
  } catch (error) {
    console.error('Share POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/watchlists/[id]/share - Revoke a share
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id query parameter is required' }, { status: 400 })
    }

    // Verify the user owns this watchlist
    const { data: watchlist } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!watchlist) {
      return NextResponse.json({ error: 'Watchlist not found or not owned by you' }, { status: 404 })
    }

    // Delete the share record
    const { error } = await supabase
      .from('watchlist_shares')
      .delete()
      .eq('watchlist_id', id)
      .eq('shared_with_user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Share DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
