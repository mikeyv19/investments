/**
 * Local runner for single stock scraper with environment variable loading
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// Get ticker from command line
const ticker = process.argv[2]

if (!ticker) {
  console.error('Usage: node run-single-stock.js TICKER')
  process.exit(1)
}

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

// Parse .env.local file
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

console.log(`Fetching earnings data for ${ticker}...`)
console.log('Loading environment from:', envPath)
console.log('')

// Run the scraper
const scraper = spawn('node', ['scrape-single-stock.js', ticker], {
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit'
})

scraper.on('error', (error) => {
  console.error('Failed to start scraper:', error)
})

scraper.on('exit', (code) => {
  console.log(`\nScraper finished with code ${code}`)
})