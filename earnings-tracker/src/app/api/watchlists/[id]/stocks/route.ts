import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// POST /api/watchlists/[id]/stocks - Add stock to watchlist
export async function POST(
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
    const { ticker } = body

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      )
    }

    // Verify watchlist belongs to user
    const { data: watchlist, error: watchlistError } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      )
    }

    // Get or create company
    let company
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (existingCompany) {
      company = existingCompany
    } else {
      // Company doesn't exist, create it
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          ticker: ticker.toUpperCase(),
          company_name: ticker.toUpperCase() // Will be updated later by SEC API
        })
        .select()
        .single()

      if (companyError) {
        console.error('Company creation error:', companyError)
        return NextResponse.json(
          { error: 'Failed to add company' },
          { status: 500 }
        )
      }
      company = newCompany
    }

    // Add to watchlist
    const { data, error } = await supabase
      .from('watchlist_stocks')
      .insert({
        watchlist_id: id,
        company_id: company.id
      })
      .select(`
        *,
        company:companies(*)
      `)
      .single()

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'Stock already in watchlist' },
          { status: 409 }
        )
      }
      console.error('Database error:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json(
        { error: error.message || 'Failed to add stock to watchlist' },
        { status: 500 }
      )
    }

    // Fetch earnings data for the newly added stock
    try {
      const fetchResponse = await fetch(
        `${request.nextUrl.origin}/api/companies/${ticker.toUpperCase()}/fetch-earnings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass along the authorization header
            'Authorization': request.headers.get('Authorization') || '',
            // Pass cookies for auth
            'Cookie': request.headers.get('Cookie') || ''
          }
        }
      )

      if (!fetchResponse.ok) {
        console.warn(`Failed to fetch earnings data for ${ticker}:`, await fetchResponse.text())
      } else {
        console.log(`Successfully fetched earnings data for ${ticker}`)
      }
    } catch (fetchError) {
      console.error(`Error fetching earnings data for ${ticker}:`, fetchError)
      // Don't fail the watchlist add if earnings fetch fails
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Add stock error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/watchlists/[id]/stocks/[ticker] - Remove stock from watchlist
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

    const { searchParams } = new URL(request.url)
    const ticker = searchParams.get('ticker')

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      )
    }

    // Verify watchlist belongs to user
    const { data: watchlist, error: watchlistError } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (watchlistError || !watchlist) {
      return NextResponse.json(
        { error: 'Watchlist not found' },
        { status: 404 }
      )
    }

    // Get company ID
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Remove from watchlist
    const { error } = await supabase
      .from('watchlist_stocks')
      .delete()
      .eq('watchlist_id', id)
      .eq('company_id', company.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to remove stock from watchlist' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove stock error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}