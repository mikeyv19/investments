import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// GET /api/user/preferences - Get user preferences
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

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key) {
      // Get specific preference
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', user.id)
        .eq('preference_key', key)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Preference fetch error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch preference' },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        data: data?.preference_value || null 
      })
    } else {
      // Get all preferences
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_key, preference_value')
        .eq('user_id', user.id)

      if (error) {
        console.error('Preferences fetch error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch preferences' },
          { status: 500 }
        )
      }

      // Convert to key-value object
      const preferences = data.reduce((acc, pref) => {
        acc[pref.preference_key] = pref.preference_value
        return acc
      }, {} as Record<string, unknown>)

      return NextResponse.json({ data: preferences })
    }
  } catch (error) {
    console.error('Get preferences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/user/preferences - Set user preference
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
    const { key, value } = body

    if (!key) {
      return NextResponse.json(
        { error: 'Preference key is required' },
        { status: 400 }
      )
    }

    // Upsert preference
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        preference_key: key,
        preference_value: value
      }, {
        onConflict: 'user_id,preference_key'
      })
      .select()
      .single()

    if (error) {
      console.error('Preference save error:', error)
      return NextResponse.json(
        { error: 'Failed to save preference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Set preference error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/user/preferences - Delete user preference
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { error: 'Preference key is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', user.id)
      .eq('preference_key', key)

    if (error) {
      console.error('Preference delete error:', error)
      return NextResponse.json(
        { error: 'Failed to delete preference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete preference error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}