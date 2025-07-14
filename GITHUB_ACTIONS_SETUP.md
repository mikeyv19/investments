# GitHub Actions Setup Instructions

This guide will walk you through setting up GitHub Actions for the refresh functionality on your deployed Vercel app.

## Prerequisites
- GitHub repository for your project
- Vercel deployment
- Supabase project

## Step 1: Push Your Code to GitHub

First, ensure all the new files are committed and pushed:
```bash
cd earnings-tracker
npm install        # Install main dependencies
cd scripts
npm install        # Install script dependencies including puppeteer
cd ../..
git add .
git commit -m "Add GitHub Actions refresh functionality"
git push
```

## Step 2: Create a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Direct link: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "Earnings Tracker Actions"
4. Set expiration (recommend 90 days or longer)
5. Select these scopes:
   - [x] `repo` (Full control of private repositories)
   - [x] `workflow` (Update GitHub Action workflows)
6. Click "Generate token"
7. **IMPORTANT: Copy the token immediately** (you won't see it again!)

## Step 3: Add GitHub Secrets

1. Go to your GitHub repository
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret" and add these secrets:

### Required Secrets:
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_SERVICE_ROLE_KEY**: Your Supabase service role key

To find these:
1. Go to your Supabase project dashboard
2. Click Settings → API
3. Copy "Project URL" for SUPABASE_URL
4. Copy "service_role" key (under "Project API keys") for SUPABASE_SERVICE_ROLE_KEY

## Step 4: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Click Settings → Environment Variables
3. Add these variables for all environments (Production, Preview, Development):

### Required Variables:
- **GITHUB_ACTIONS_TOKEN**: The personal access token from Step 2
- **GITHUB_OWNER**: Your GitHub username
- **GITHUB_REPO**: Your repository name (e.g., "investments")

### Example values:
```
GITHUB_ACTIONS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=yourusername
GITHUB_REPO=investments
```

## Step 5: Redeploy on Vercel

After adding environment variables, you need to redeploy:
1. Go to your Vercel project
2. Click the "..." menu → Redeploy
3. Use the existing build

## Step 6: Test the Setup

### Test 1: Manual GitHub Actions Test
1. Go to your GitHub repository
2. Click Actions tab
3. Find "Refresh Single Ticker Data" workflow
4. Click "Run workflow"
5. Enter a ticker symbol (e.g., "AAPL")
6. Click "Run workflow" button
7. Watch the workflow run (should take 1-2 minutes)

### Test 2: Test from Your App
1. Go to your deployed Vercel app
2. Login and go to the earnings dashboard
3. Click the refresh button next to any ticker
4. You should see "Refresh initiated" message
5. Check GitHub Actions tab to see the workflow running
6. After 1-2 minutes, refresh the page to see updated data

## Troubleshooting

### "GitHub Actions not configured" error
- Ensure GITHUB_ACTIONS_TOKEN is set in Vercel environment variables
- Redeploy after adding the variable

### "GitHub workflow not found" error
- Check that GITHUB_OWNER and GITHUB_REPO match your repository
- Ensure the workflow file exists: `.github/workflows/refresh-ticker.yml`

### "GitHub authentication failed" error
- Verify your personal access token has the correct permissions
- Check that the token hasn't expired
- Ensure the token is correctly copied (no extra spaces)

### Workflow runs but data doesn't update
- Check the workflow logs in GitHub Actions for errors
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets are correct
- Ensure the scraper can access the websites (no blocking)

## Security Notes

1. **Keep your tokens secret**: Never commit tokens to your repository
2. **Use environment variables**: All sensitive data should be in environment variables
3. **Rotate tokens regularly**: Set a reminder to update your GitHub token before expiry
4. **Monitor usage**: Check GitHub Actions usage to ensure it's not being abused

## GitHub Actions Limits (Free Tier)

- 2,000 minutes per month for private repositories
- 3,000 concurrent API requests
- Each refresh takes approximately 1-2 minutes
- You can run about 1,000-2,000 refreshes per month

## Next Steps

Once everything is working:
1. Consider setting up a scheduled workflow for daily updates
2. Add error notifications (e.g., email when a refresh fails)
3. Implement rate limiting to prevent abuse
4. Add logging to track refresh history

## Support

If you encounter issues:
1. Check the GitHub Actions logs for detailed error messages
2. Verify all environment variables and secrets are correctly set
3. Ensure the repository has Actions enabled (Settings → Actions → General)