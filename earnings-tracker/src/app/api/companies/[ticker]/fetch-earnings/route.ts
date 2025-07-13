import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/app/lib/supabase-server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

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

    console.log(`Running full scraper for ${ticker}...`)

    // Run the single stock scraper script
    try {
      const scriptsDir = path.join(process.cwd(), 'scripts')
      const command = process.platform === 'win32' 
        ? `cd /d "${scriptsDir}" && node run-single-stock.js ${ticker}`
        : `cd "${scriptsDir}" && node run-single-stock.js ${ticker}`
      
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      })

      if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
        console.error('Scraper stderr:', stderr)
      }

      console.log('Scraper output:', stdout)

      // Check if the scraper was successful
      const success = stdout.includes('Successfully fetched earnings data') || 
                     stdout.includes('Completed fetching data for')

      if (success) {
        return NextResponse.json({ 
          success: true,
          message: `Successfully fetched earnings data for ${ticker}`,
          output: stdout
        })
      } else {
        return NextResponse.json(
          { 
            error: 'Scraper failed to fetch data',
            details: stdout
          },
          { status: 500 }
        )
      }
    } catch (error: any) {
      console.error('Script execution error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to run scraper',
          details: error.message
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Fetch earnings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}