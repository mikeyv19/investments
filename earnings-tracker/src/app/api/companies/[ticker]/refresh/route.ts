import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'

// POST /api/companies/[ticker]/refresh
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

    // Check if we have a GitHub token
    const githubToken = process.env.GITHUB_ACTIONS_TOKEN
    if (!githubToken) {
      console.error('GITHUB_ACTIONS_TOKEN not configured')
      return NextResponse.json(
        { error: 'GitHub Actions not configured. Please set GITHUB_ACTIONS_TOKEN environment variable.' },
        { status: 500 }
      )
    }

    console.log(`Triggering GitHub Actions workflow for ${ticker}...`)
    console.log(`GitHub config - Owner: ${owner}, Repo: ${repo}`)

    // Trigger GitHub Actions workflow
    const owner = process.env.GITHUB_OWNER
    const repo = process.env.GITHUB_REPO
    
    if (!owner || !repo) {
      console.error('Missing GitHub configuration:', { owner, repo })
      return NextResponse.json(
        { error: 'GitHub repository not configured. Please set GITHUB_OWNER and GITHUB_REPO environment variables.' },
        { status: 500 }
      )
    }
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/refresh-ticker.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${githubToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ref: 'main', // or whatever your default branch is
            inputs: {
              ticker: ticker.toUpperCase(),
              triggered_by: user.email || 'unknown'
            }
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GitHub API error:', response.status, errorText)
        
        if (response.status === 404) {
          return NextResponse.json(
            { error: 'GitHub workflow not found. Please ensure the workflow file exists and GITHUB_OWNER/GITHUB_REPO are correct.' },
            { status: 500 }
          )
        } else if (response.status === 401) {
          return NextResponse.json(
            { error: 'GitHub authentication failed. Please check your GITHUB_ACTIONS_TOKEN.' },
            { status: 500 }
          )
        }
        
        return NextResponse.json(
          { error: `Failed to trigger workflow: ${errorText}` },
          { status: 500 }
        )
      }

      // GitHub Actions returns 204 No Content on success
      if (response.status === 204) {
        // Optionally, you could store a pending status in the database here
        // to track the refresh progress
        
        return NextResponse.json({ 
          success: true,
          message: `Refresh initiated for ${ticker}. Data will be updated within 1-2 minutes.`,
          status: 'pending'
        })
      } else {
        return NextResponse.json(
          { error: 'Unexpected response from GitHub Actions' },
          { status: 500 }
        )
      }
    } catch (error: unknown) {
      console.error('GitHub Actions error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to trigger refresh workflow',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}