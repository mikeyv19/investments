# GitHub Actions Setup Guide

This guide explains how to set up the automated daily stock refresh using GitHub Actions.

## Overview

The GitHub Action runs daily at 2 AM UTC to refresh all stocks in user watchlists automatically. This ensures your earnings data is always up-to-date without requiring manual intervention.

## Setup Requirements

### 1. GitHub Secrets

You need to add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to `Settings` → `Secrets and variables` → `Actions`
3. Click `New repository secret` and add:

   - **`SUPABASE_URL`**
     - Your Supabase project URL
     - Example: `https://xxxxxxxxxxxxx.supabase.co`
     - Found in your Supabase project settings

   - **`SUPABASE_SERVICE_ROLE_KEY`**
     - Your Supabase service role key (not the anon key!)
     - Found in Supabase project settings under API
     - ⚠️ **Important**: This is a sensitive key with full database access

### 2. Enable GitHub Actions

1. Go to the `Actions` tab in your GitHub repository
2. If prompted, enable GitHub Actions for the repository
3. The workflow should appear under `.github/workflows/refresh-all-stocks.yml`

## How It Works

### Automatic Daily Runs
- Runs every day at 2 AM UTC (9 PM EST / 10 PM EDT)
- Fetches all unique stocks from watchlists
- Refreshes each stock with 1-second delays between requests
- Creates detailed logs of the process

### Manual Runs
1. Go to the `Actions` tab in your repository
2. Select `Refresh All Watchlist Stocks` workflow
3. Click `Run workflow` → `Run workflow`
4. Monitor progress in real-time

### Logs and Debugging
- Each run creates detailed logs with timestamps
- Logs are saved as artifacts for 7 days
- Download logs from the workflow run page under "Artifacts"

## Monitoring

### Check Run Status
1. Go to the `Actions` tab
2. View recent workflow runs
3. Green checkmark = success
4. Red X = failure (check logs)

### Email Notifications
GitHub can email you if the workflow fails:
1. Go to your GitHub profile settings
2. Navigate to `Notifications`
3. Enable email notifications for workflow failures

## Rate Limiting

- The script waits 1 second between each stock refresh
- This respects API rate limits while processing quickly
- A watchlist with 100 stocks takes approximately 2 minutes

## Troubleshooting

### Common Issues

1. **Missing Secrets Error**
   - Ensure both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
   - Check for typos in secret names

2. **Authentication Errors**
   - Verify the service role key is correct
   - Ensure it's the service role key, not the anon key

3. **No Stocks Found**
   - Check that watchlists contain stocks
   - Verify database connectivity

4. **Individual Stock Failures**
   - Some stocks may fail due to data availability
   - Check logs for specific error messages
   - The workflow continues even if some stocks fail

### Viewing Detailed Logs

1. Go to the failed workflow run
2. Click on the job name
3. Expand each step to see detailed output
4. Download artifacts for complete logs

## Costs

- **Public Repositories**: Unlimited free minutes
- **Private Repositories**: 2,000 free minutes/month
- Daily runs use approximately 60-90 minutes/month

## Customization

### Change Schedule

Edit `.github/workflows/refresh-all-stocks.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'  # Change this cron expression
```

Cron examples:
- `0 6 * * *` - 6 AM UTC daily
- `0 */12 * * *` - Every 12 hours
- `0 2 * * 1` - Every Monday at 2 AM UTC

### Modify Rate Limit

Edit `scripts/refresh-all-stocks.js`:

```javascript
const RATE_LIMIT_DELAY = 1000  // Change to desired milliseconds
```

## Security Notes

- The service role key has full database access
- It's only accessible during workflow execution
- Never commit secrets to your repository
- Rotate keys periodically for security

## Support

If you encounter issues:
1. Check the workflow logs first
2. Verify all secrets are correctly set
3. Ensure your Supabase project is active
4. Check GitHub Actions status page for outages