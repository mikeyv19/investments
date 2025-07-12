# Deployment Guide for Earnings Tracker

This guide will walk you through deploying the Earnings Tracker application to Vercel and setting up GitHub Actions for automated scraping.

## Prerequisites

- GitHub account
- Vercel account (free tier)
- Supabase project (already set up with provided credentials)

## Step 1: Prepare the Repository

1. Ensure all changes are committed:
   ```bash
   git add .
   git commit -m "Restructure project for SEC EDGAR API and investor.com scraping"
   git push origin main
   ```

## Step 2: Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the schema from `earnings-tracker/supabase/schema.sql`
4. Verify tables are created with RLS policies enabled

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `earnings-tracker`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://borpmguppzkklueyzcew.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcnBtZ3VwcHpra2x1ZXl6Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyNDU5NDMsImV4cCI6MjA2NzgyMTk0M30.pftXa3eTYQWJIQG7i-ZrGGXBxZ-4kKj7HYzZZ1DPbes

   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
   eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcnBtZ3VwcHpra2x1ZXl6Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI0NTk0NCwiZXhwIjoyMDY3ODIxOTQ0fQ.W0uMd54-re9ySBK8QBe6zCagofXUAOEPU0FgQhH6LDE
   
   NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app
   ```

6. Click "Deploy"

### Option B: Deploy via CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy from the earnings-tracker directory:
   ```bash
   cd earnings-tracker
   vercel
   ```

3. Follow prompts and add environment variables when asked

## Step 4: Update Production URL

After deployment, update your environment variables:

1. In Vercel Dashboard → Settings → Environment Variables
2. Update `NEXT_PUBLIC_APP_URL` to your production URL
3. Redeploy to apply changes

## Step 5: Set Up GitHub Actions

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add the following secrets:
   ```
   SUPABASE_URL=https://borpmguppzkklueyzcew.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvcnBtZ3VwcHpra2x1ZXl6Y2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI0NTk0NCwiZXhwIjoyMDY3ODIxOTQ0fQ.W0uMd54-re9ySBK8QBe6zCagofXUAOEPU0FgQhH6LDE
   ```

4. Enable GitHub Actions:
   - Go to Actions tab
   - Enable workflows if prompted

5. The scraper will run automatically at 6 AM UTC daily
   - To test manually: Actions → "Scrape Earnings Data" → "Run workflow"

## Step 6: Test the Application

1. Visit your Vercel URL
2. Create a new account using the signup page
3. Test the following features:
   - Company search
   - Historical EPS data retrieval
   - Create watchlists
   - Add stocks to watchlists
   - View earnings data grid

## Step 7: Monitor and Maintain

### Check GitHub Actions Logs
- Go to Actions tab to see scraping job history
- Review logs for any errors

### Monitor Vercel Functions
- Vercel Dashboard → Functions tab
- Check for errors or timeouts

### Database Monitoring
- Supabase Dashboard → Database
- Monitor table sizes and performance

## Troubleshooting

### Common Issues

1. **SEC API Returns 403**
   - Verify User-Agent is set correctly in `sec-edgar.ts`
   - Ensure email format is correct

2. **Scraper Fails**
   - Check GitHub Actions logs
   - Verify Supabase credentials in GitHub Secrets
   - Test scraper locally first

3. **Authentication Issues**
   - Verify Supabase URL and keys are correct
   - Check RLS policies in Supabase

4. **Build Failures**
   - Check Vercel build logs
   - Ensure all dependencies are in package.json
   - Verify TypeScript types are correct

## Security Notes

- Never commit `.env.local` to version control
- Rotate Supabase keys periodically
- Monitor API usage to stay within limits
- Keep service role key only in GitHub Actions

## Next Steps

1. Implement actual investor.com scraping logic
2. Add more data visualization features
3. Set up error alerting
4. Implement data export features
5. Add more SEC data points

## Support

For issues:
1. Check Vercel logs
2. Review GitHub Actions output
3. Monitor Supabase logs
4. Check browser console for client-side errors