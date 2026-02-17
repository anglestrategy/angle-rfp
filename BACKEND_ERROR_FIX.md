# Fixing Backend 500 Error

## The Real Problem

The error is **NOT a timeout issue** - it's a backend failure. The timeout fix was correct but revealed the underlying problem:

```
Backend request failed (500): Claude extraction failed in high-assurance mode;
regex fallback is disabled.
```

## Root Cause

The backend's Claude API call is failing, and the system is configured to refuse fallback extraction. This is by design for quality control, but it means ANY Claude failure causes complete analysis failure.

## Why Claude Might Be Failing

Most common causes (in order of likelihood):

### 1. ❌ ANTHROPIC_API_KEY Not Set in Render
**Check**: Go to Render Dashboard → Your Service → Environment Variables
**Look for**: `ANTHROPIC_API_KEY`
**Fix**: Add it if missing

### 2. ❌ API Key Invalid or Expired
**Check**: Log into https://console.anthropic.com
**Verify**: Key is active and has quota remaining
**Fix**: Generate new key if needed

### 3. ❌ Rate Limits / Quota Exceeded
**Check**: Anthropic Console → Usage
**Symptom**: Error message mentions "rate limit" or "quota"
**Fix**: Wait or upgrade plan

### 4. ❌ Model Access Issues
**Check**: Your Anthropic account tier
**Issue**: claude-sonnet-4-5-20250929 requires certain account levels
**Fix**: Use claude-3-5-sonnet-20241022 instead (add env var)

### 5. ❌ Network/Timeout Issues
**Check**: Render logs for timeout errors
**Symptom**: Requests taking >120 seconds
**Fix**: Increase timeout or optimize payload

## Immediate Fix Options

### Option A: Enable Fallback Mode (Quick Fix)

Add this environment variable in Render:

```bash
ANALYSIS_PROFILE=balanced
```

**What this does:**
- Allows regex-based extraction when Claude fails
- Lower quality but prevents complete failure
- Gets you unblocked immediately

**How to add:**
1. Go to https://dashboard.render.com
2. Select your service
3. Environment → Add Environment Variable
4. Name: `ANALYSIS_PROFILE`
5. Value: `balanced`
6. Save Changes (this will redeploy)

### Option B: Fix the Root Cause

**Step 1**: Check Render Logs
```bash
# View last 100 lines of logs
Go to: Render Dashboard → Your Service → Logs

# Look for lines with:
# - "[Extraction] Failed after"
# - "ANTHROPIC_API_KEY"
# - "rate limit"
# - "unauthorized"
```

**Step 2**: Fix Based on Error

**If you see "ANTHROPIC_API_KEY environment variable is not set":**
```bash
# In Render Environment Variables:
ANTHROPIC_API_KEY=sk-ant-api03-...your-key...
```

**If you see "rate limit" or "quota exceeded":**
- Check Anthropic Console usage
- Wait for quota reset
- Or upgrade plan

**If you see "model not found" or "404":**
```bash
# In Render Environment Variables, add:
CLAUDE_MODEL_SONNET=claude-3-5-sonnet-20241022
```

**If you see "timeout" after 120 seconds:**
- This is the actual timeout issue
- RFP might be too large
- Backend needs optimization

## Testing the Fix

### After Adding Environment Variable:

1. **Render will auto-deploy** (takes ~2 minutes)
2. **Wait for "Live" status** in Render dashboard
3. **Try uploading RFP again** in the iOS app
4. **Should now work** with either:
   - ✅ Successful Claude extraction (if root cause fixed)
   - ✅ Fallback regex extraction (if using balanced mode)

### Verify It's Working:

```bash
# Watch Render logs in real-time
# Go to Render Dashboard → Logs → Enable "Follow logs"

# Upload RFP in iOS app
# Watch for these log messages:
✅ "[Extraction] Using full RFP content"
✅ "[Extraction] Completed successfully in"
❌ "[Extraction] Failed after" ← if this, check the error
```

## Long-term Solution

Once unblocked, investigate the root cause:

1. **Check Anthropic Console**: Verify API key status
2. **Review Render Logs**: Find exact Claude error message
3. **Test API Directly**: Use the test script below
4. **Fix Root Issue**: Then remove fallback mode

## Test Script

Run this to diagnose backend issues:

```bash
cd /Users/Faisal/Documents/New\ project/angle-rfp

# Set your token (get from Xcode environment or Settings)
export BACKEND_APP_TOKEN="your-token-here"

# Run diagnostic
./test-render-backend.sh
```

## Quick Reference

| Environment Variable | Purpose | Example Value |
|---------------------|---------|---------------|
| `ANTHROPIC_API_KEY` | Claude API access | `sk-ant-api03-...` |
| `ANALYSIS_PROFILE` | Enable fallback | `balanced` |
| `CLAUDE_MODEL_SONNET` | Override model | `claude-3-5-sonnet-20241022` |

## Summary

✅ **iOS timeout fix** - Completed (allows 12 minutes)
❌ **Backend Claude failure** - Needs Render configuration
🔧 **Quick fix** - Add `ANALYSIS_PROFILE=balanced`
🔍 **Root cause** - Check Render logs + Anthropic Console
