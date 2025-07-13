/**
 * Run only the Yahoo Finance scraper
 */

const fs = require('fs')
const path = require('path')

// Try to load environment variables from .env in scripts directory first
let envPath = path.join(__dirname, '.env')

// If not found, try parent .env.local
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env.local')
}

if (!fs.existsSync(envPath)) {
  console.error('Error: No .env file found in scripts directory or .env.local in parent directory')
  console.error('Please create one with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Parse .env file
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

// Set environment variables
Object.assign(process.env, envVars)

console.log('Running Yahoo Finance Scraper only...')
console.log('Loading environment from:', envPath)
console.log('Using Supabase URL:', process.env.SUPABASE_URL)
console.log('')

// Run the Yahoo Finance scraper
const { scrapeEarningsData } = require('./scrape-yahoo-finance')

scrapeEarningsData().then(() => {
  console.log('\nYahoo Finance scraper finished!')
}).catch(error => {
  console.error('Error running Yahoo Finance scraper:', error.message)
  process.exit(1)
})