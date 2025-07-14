/**
 * Check if stock data exists in the database
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
let envPath = path.join(__dirname, '.env')
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env.local')
}

if (!fs.existsSync(envPath)) {
  console.error('No .env file found')
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=')
    if (key) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      envVars[key.trim()] = value
    }
  }
})

const SUPABASE_URL = envVars.SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkStockData(ticker) {
  console.log(`\nChecking data for ${ticker}...`)
  
  // Get company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .single()
    
  if (companyError || !company) {
    console.log('❌ Company not found')
    return
  }
  
  console.log('✅ Company found:', {
    id: company.id,
    ticker: company.ticker,
    name: company.company_name
  })
  
  // Check historical EPS
  const { data: historicalEps, error: epsError } = await supabase
    .from('historical_eps')
    .select('*')
    .eq('company_id', company.id)
    .order('filing_date', { ascending: false })
    .limit(5)
    
  if (epsError) {
    console.log('❌ Error fetching historical EPS:', epsError)
  } else {
    console.log(`\n📊 Historical EPS (${historicalEps.length} records):`)
    historicalEps.forEach(eps => {
      console.log(`  ${eps.fiscal_period}: $${eps.eps_actual} (filed: ${eps.filing_date})`)
    })
  }
  
  // Check earnings estimates
  const { data: estimates, error: estimateError } = await supabase
    .from('earnings_estimates')
    .select('*')
    .eq('company_id', company.id)
    .order('earnings_date', { ascending: true })
    
  if (estimateError) {
    console.log('❌ Error fetching earnings estimates:', estimateError)
  } else {
    console.log(`\n📅 Earnings Estimates (${estimates.length} records):`)
    estimates.forEach(est => {
      console.log(`  ${est.earnings_date}: $${est.eps_estimate || 'N/A'} (${est.market_timing}${est.earnings_time ? ' at ' + est.earnings_time : ''})`)
      if (est.year_ago_eps) {
        console.log(`    Year-ago EPS: $${est.year_ago_eps}`)
      }
    })
  }
  
  // Check if in any watchlists
  const { data: watchlists, error: watchlistError } = await supabase
    .from('watchlist_stocks')
    .select(`
      watchlist:user_watchlists(name)
    `)
    .eq('company_id', company.id)
    
  if (!watchlistError && watchlists.length > 0) {
    console.log(`\n📌 In ${watchlists.length} watchlist(s):`)
    watchlists.forEach(w => {
      console.log(`  - ${w.watchlist.name}`)
    })
  }
}

// Get ticker from command line
const ticker = process.argv[2]

if (!ticker) {
  console.error('Usage: node check-stock-data.js TICKER')
  process.exit(1)
}

checkStockData(ticker).then(() => {
  console.log('\nDone!')
  process.exit(0)
}).catch(error => {
  console.error('Error:', error)
  process.exit(1)
})