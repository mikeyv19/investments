/**
 * Cleanup Past Earnings Dates
 * 
 * This script removes earnings dates that have already passed
 * and ensures only upcoming earnings dates are stored.
 */

const { createClient } = require('@supabase/supabase-js')

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function cleanupPastEarnings() {
  console.log('===== Cleaning Up Past Earnings Dates =====')
  console.log('Time:', new Date().toISOString())
  console.log('')

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0]
    
    // First, get a count of past earnings dates
    const { data: pastEarnings, count } = await supabase
      .from('earnings_estimates')
      .select('ticker:companies(ticker), earnings_date', { count: 'exact' })
      .lt('earnings_date', today)
    
    console.log(`Found ${count || 0} past earnings dates to remove`)
    
    if (pastEarnings && pastEarnings.length > 0) {
      console.log('\nRemoving past earnings dates for:')
      pastEarnings.forEach(e => {
        console.log(`  ${e.ticker?.ticker} - ${e.earnings_date}`)
      })
    }
    
    // Delete all past earnings dates
    const { error, data } = await supabase
      .from('earnings_estimates')
      .delete()
      .lt('earnings_date', today)
      .select()
    
    if (error) {
      console.error('Error deleting past earnings:', error)
    } else {
      console.log(`\nSuccessfully removed ${data?.length || 0} past earnings dates`)
    }
    
    // Also check for duplicate entries per company
    console.log('\nChecking for duplicate entries...')
    
    const { data: allEstimates } = await supabase
      .from('earnings_estimates')
      .select('company_id, earnings_date, id')
      .order('company_id')
      .order('earnings_date', { ascending: true })
    
    if (allEstimates) {
      const companyMap = new Map()
      const duplicatesToRemove = []
      
      // Group by company and find duplicates
      allEstimates.forEach(estimate => {
        if (companyMap.has(estimate.company_id)) {
          // This is a duplicate - mark the older one for removal
          duplicatesToRemove.push(companyMap.get(estimate.company_id).id)
        }
        // Always keep the latest entry
        companyMap.set(estimate.company_id, estimate)
      })
      
      if (duplicatesToRemove.length > 0) {
        console.log(`Found ${duplicatesToRemove.length} duplicate entries to remove`)
        
        // Delete duplicates
        const { error: dupError } = await supabase
          .from('earnings_estimates')
          .delete()
          .in('id', duplicatesToRemove)
        
        if (dupError) {
          console.error('Error removing duplicates:', dupError)
        } else {
          console.log('Successfully removed duplicate entries')
        }
      } else {
        console.log('No duplicate entries found')
      }
    }
    
    console.log('\nCleanup completed successfully!')
    
  } catch (error) {
    console.error('Fatal error during cleanup:', error)
    process.exit(1)
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupPastEarnings().then(() => {
    process.exit(0)
  }).catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { cleanupPastEarnings }