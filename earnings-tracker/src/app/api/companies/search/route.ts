import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'
import { searchCompanyByTicker } from '@/app/lib/sec-edgar'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // First, search in our database
    const { data: existingCompanies, error: dbError } = await supabase
      .from('companies')
      .select('*')
      .or(`ticker.ilike.%${query}%,company_name.ilike.%${query}%`)
      .limit(10)
    
    if (dbError) {
      console.error('Database search error:', dbError)
    }
    
    // If we have results, return them
    if (existingCompanies && existingCompanies.length > 0) {
      return NextResponse.json({ data: existingCompanies })
    }
    
    // Otherwise, search SEC for the ticker
    const upperQuery = query.toUpperCase()
    const secCompany = await searchCompanyByTicker(upperQuery)
    
    if (secCompany) {
      // Save to our database for future searches
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert({
          ticker: secCompany.ticker,
          company_name: secCompany.name
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('Error saving company:', insertError)
        // Return SEC data even if save fails
        return NextResponse.json({
          data: [{
            ticker: secCompany.ticker,
            company_name: secCompany.name
          }]
        })
      }
      
      return NextResponse.json({ data: [newCompany] })
    }
    
    // No results found
    return NextResponse.json({ data: [] })
    
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}