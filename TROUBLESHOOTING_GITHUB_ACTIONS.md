# Troubleshooting GitHub Actions Refresh

## Issue: "GitHub workflow not found" Error

### What's Been Fixed:
1. ✅ Moved workflow file from `earnings-tracker/.github/workflows/` to `.github/workflows/` (root)
2. ✅ Pushed to GitHub repository
3. ✅ Added better error handling in API route

### Next Steps to Fix Your Issue:

## 1. Verify Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and ensure these are set:

```
GITHUB_ACTIONS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=mikeyv19
GITHUB_REPO=VassosInvestments
```

**Important**: Based on your Git remote, it looks like:
- Your GitHub username is: `mikeyv19`
- Your repository name is: `VassosInvestments` (with capital V and I)

## 2. After Adding Variables, Redeploy

You MUST redeploy after adding environment variables:
1. Go to Vercel dashboard
2. Click the "..." menu → Redeploy
3. Wait for deployment to complete

## 3. Test GitHub Actions Manually First

Before testing from the app, verify the workflow exists:
1. Go to: https://github.com/mikeyv19/VassosInvestments/actions
2. You should see "Refresh Single Ticker Data" in the workflows list
3. Click on it and try "Run workflow" manually

## 4. Check Vercel Function Logs

If it still doesn't work:
1. Go to Vercel dashboard → Functions tab
2. Look for errors in the `refresh` function logs
3. The logs will show the exact error and GitHub configuration

## 5. Common Issues and Fixes

### "GitHub workflow not found" (404)
- **Cause**: Workflow file not in repository or wrong path
- **Fix**: Already fixed by moving to root `.github/workflows/`

### "GitHub authentication failed" (401)
- **Cause**: Invalid or missing GITHUB_ACTIONS_TOKEN
- **Fix**: Regenerate token with correct permissions (repo, workflow)

### "GitHub repository not configured"
- **Cause**: Missing GITHUB_OWNER or GITHUB_REPO
- **Fix**: Add to Vercel environment variables

### Case Sensitivity Issue
GitHub is case-sensitive. Make sure:
- `GITHUB_REPO=VassosInvestments` (not "vassosinvestments")

## Quick Debug Checklist

- [ ] Workflow file exists at `.github/workflows/refresh-ticker.yml` in GitHub
- [ ] GITHUB_ACTIONS_TOKEN is set in Vercel (starts with ghp_)
- [ ] GITHUB_OWNER is set to `mikeyv19`
- [ ] GITHUB_REPO is set to `VassosInvestments` (check capitalization!)
- [ ] Redeployed on Vercel after adding variables
- [ ] Token has `repo` and `workflow` permissions

## Test URL Format

The API will try to call:
```
https://api.github.com/repos/mikeyv19/VassosInvestments/actions/workflows/refresh-ticker.yml/dispatches
```

You can test this URL exists by visiting (when logged into GitHub):
```
https://github.com/mikeyv19/VassosInvestments/actions/workflows/refresh-ticker.yml
```