import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// Import the scraper functions
const USER_AGENT = 'Personal Earnings Tracker (mattmass123@gmail.com)'
const SEC_API_BASE = 'https://data.sec.gov'
const RATE_LIMIT_MS = 100

let lastRequestTime = 0

async function rateLimitedFetch(url: string, options: RequestInit = {}) {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => 
      setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest)
    )
  }

  lastRequestTime = Date.now()

  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      ...options.headers
    }
  })

  return response
}

async function getCIKFromTicker(ticker: string) {
  try {
    const response = await rateLimitedFetch(
      'https://www.sec.gov/files/company_tickers.json'
    )

    if (!response.ok) {
      console.error(`Failed to fetch company tickers: ${response.status}`)
      return null
    }

    const data = await response.json()
    const company = Object.values(data).find(
      (c: any) => c.ticker === ticker.toUpperCase()
    )

    return company ? String(company.cik_str).padStart(10, '0') : null
  } catch (error: any) {
    console.error(`Error getting CIK for ${ticker}:`, error.message)
    return null
  }
}

async function getHistoricalEPS(cik: string, ticker: string) {
  try {
    const response = await rateLimitedFetch(
      `${SEC_API_BASE}/api/xbrl/companyfacts/CIK${cik}.json`
    )

    if (!response.ok) {
      console.error(`Failed to fetch company facts for ${ticker}: ${response.status}`)
      return []
    }

    const data = await response.json()
    const epsData: any[] = []

    // Look for EPS data
    const epsConcepts = ['EarningsPerShareDiluted', 'EarningsPerShareBasic', 'EarningsPerShare']

    for (const concept of epsConcepts) {
      const conceptData = data.facts?.['us-gaap']?.[concept]

      if (conceptData?.units?.['USD/shares']) {
        const epsValues = conceptData.units['USD/shares']

        for (const entry of epsValues) {
          if (entry.form === '10-Q' && entry.fp && entry.fy) {
            epsData.push({
              fiscal_period: `${entry.fp} ${entry.fy}`,
              eps_actual: entry.val,
              filing_date: entry.filed,
              end_date: entry.end
            })
          }
        }
        break
      }
    }

    // Sort by filing date (newest first)
    return epsData.sort((a, b) => 
      new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime()
    )
  } catch (error: any) {
    console.error(`Error fetching EPS for ${ticker}:`, error.message)
    return []
  }
}

async function scrapeYahooFinance(ticker: string) {
  try {
    // Use a more reliable endpoint that doesn't require authentication
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?region=US&lang=en-US&includePrePost=false&interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    )

    if (!quoteResponse.ok) {
      throw new Error(`Yahoo Finance API error: ${quoteResponse.status}`)
    }

    const quoteData = await quoteResponse.json()
    const meta = quoteData.chart?.result?.[0]?.meta

    if (!meta) {
      throw new Error('No quote data found')
    }

    const result = {
      earningsDate: null as string | null,
      epsEstimate: null as number | null,
      companyName: meta.longName || meta.shortName || ticker
    }

    // Try alternative endpoint for earnings data
    try {
      const earningsResponse = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents,earningsTrend,earnings`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }
      )

      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json()
        const summary = earningsData.quoteSummary?.result?.[0]
        
        // Get earnings date
        const calendarEvents = summary?.calendarEvents
        if (calendarEvents?.earnings?.earningsDate?.[0]?.raw) {
          result.earningsDate = new Date(calendarEvents.earnings.earningsDate[0].raw * 1000).toISOString().split('T')[0]
        }
        
        // Get EPS estimate
        const currentQuarter = summary?.earningsTrend?.trend?.[0]
        if (currentQuarter?.earningsEstimate?.avg?.raw) {
          result.epsEstimate = currentQuarter.earningsEstimate.avg.raw
        }
      }
    } catch (earningsError) {
      console.log(`Could not fetch detailed earnings for ${ticker}, continuing with basic data`)
    }

    return result
  } catch (error: any) {
    console.error(`Error scraping Yahoo Finance for ${ticker}:`, error.message)
    return null
  }
}

// POST /api/companies/[ticker]/fetch-earnings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get company from database
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    console.log(`Fetching earnings data for ${ticker}...`)

    // Fetch SEC data
    const cik = await getCIKFromTicker(ticker)
    if (cik) {
      const epsData = await getHistoricalEPS(cik, ticker)
      
      if (epsData.length > 0) {
        // Insert historical EPS data
        const uniqueEps = Array.from(
          new Map(epsData.slice(0, 8).map(item => [item.fiscal_period, item])).values()
        )
        
        const epsToInsert = uniqueEps.map(entry => ({
          company_id: company.id,
          fiscal_period: entry.fiscal_period,
          eps_actual: parseFloat(entry.eps_actual),
          filing_date: entry.filing_date
        }))

        await supabase
          .from('historical_eps')
          .upsert(epsToInsert, {
            onConflict: 'company_id,fiscal_period',
            ignoreDuplicates: false
          })
      }
    }

    // Fetch Yahoo Finance data
    const yahooData = await scrapeYahooFinance(ticker)
    
    if (yahooData) {
      // Update company name if needed
      if (yahooData.companyName && yahooData.companyName !== ticker) {
        await supabase
          .from('companies')
          .update({ company_name: yahooData.companyName })
          .eq('id', company.id)
      }

      // Update earnings estimates
      if (yahooData.earningsDate) {
        await supabase
          .from('earnings_estimates')
          .upsert({
            company_id: company.id,
            earnings_date: yahooData.earningsDate,
            market_timing: 'after', // Default
            eps_estimate: yahooData.epsEstimate,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'company_id,earnings_date',
            ignoreDuplicates: false
          })
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully fetched earnings data for ${ticker}`
    })
  } catch (error) {
    console.error('Fetch earnings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch earnings data' },
      { status: 500 }
    )
  }
}