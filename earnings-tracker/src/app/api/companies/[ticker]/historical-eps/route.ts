import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'
import { getHistoricalEPS, getCompanyTickers } from '@/app/lib/sec-edgar'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase()
    const supabase = createClient()
    
    // First check if company exists in our database
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('ticker', ticker)
      .single()
    
    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found. Please search for it first.' },
        { status: 404 }
      )
    }
    
    // Check if we already have historical data
    const { data: existingEps } = await supabase
      .from('historical_eps')
      .select('*')
      .eq('company_id', company.id)
      .order('filing_date', { ascending: false })
    
    // If we have recent data (filed within last 7 days), return it
    if (existingEps && existingEps.length > 0) {
      const latestFiling = new Date(existingEps[0].filing_date)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      if (latestFiling > sevenDaysAgo) {
        return NextResponse.json({ data: existingEps })
      }
    }
    
    // Otherwise, fetch fresh data from SEC
    const tickerMap = await getCompanyTickers()
    const cik = tickerMap.get(ticker)
    
    if (!cik) {
      return NextResponse.json(
        { error: 'Unable to find CIK for ticker' },
        { status: 404 }
      )
    }
    
    const epsData = await getHistoricalEPS(cik, ticker)
    
    if (epsData.length === 0) {
      return NextResponse.json({ data: [] })
    }
    
    // Save new EPS data to database
    const epsRecords = epsData.map(eps => ({
      company_id: company.id,
      fiscal_period: eps.fiscal_period,
      eps_actual: eps.eps_actual,
      filing_date: eps.filing_date
    }))
    
    // Upsert to handle duplicates
    for (const record of epsRecords) {
      await supabase
        .from('historical_eps')
        .upsert(record, {
          onConflict: 'company_id,fiscal_period'
        })
    }
    
    // Fetch and return the updated data
    const { data: updatedEps, error: fetchError } = await supabase
      .from('historical_eps')
      .select('*')
      .eq('company_id', company.id)
      .order('filing_date', { ascending: false })
    
    if (fetchError) {
      console.error('Error fetching updated EPS:', fetchError)
      return NextResponse.json({ data: epsData })
    }
    
    return NextResponse.json({ data: updatedEps })
    
  } catch (error) {
    console.error('Historical EPS error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase()
    const supabase = createClient()
    
    // Force refresh of historical data
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('ticker', ticker)
      .single()
    
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }
    
    const tickerMap = await getCompanyTickers()
    const cik = tickerMap.get(ticker)
    
    if (!cik) {
      return NextResponse.json(
        { error: 'Unable to find CIK for ticker' },
        { status: 404 }
      )
    }
    
    const epsData = await getHistoricalEPS(cik, ticker)
    
    // Delete old data and insert fresh
    await supabase
      .from('historical_eps')
      .delete()
      .eq('company_id', company.id)
    
    if (epsData.length > 0) {
      const epsRecords = epsData.map(eps => ({
        company_id: company.id,
        fiscal_period: eps.fiscal_period,
        eps_actual: eps.eps_actual,
        filing_date: eps.filing_date
      }))
      
      await supabase
        .from('historical_eps')
        .insert(epsRecords)
    }
    
    return NextResponse.json({ 
      message: 'Historical EPS data refreshed',
      count: epsData.length 
    })
    
  } catch (error) {
    console.error('Refresh EPS error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}