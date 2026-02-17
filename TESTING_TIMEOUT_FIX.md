# Testing Timeout Fix

## What Was Fixed
- **Problem**: iOS app was disconnecting after 4 minutes while backend took up to 10 minutes
- **Error**: "Socket is not connected" errors in Xcode console
- **Solution**: Increased iOS timeouts to 12 minutes (720 seconds)

## Changes Made
1. `timeoutIntervalForRequest`: 90s → 120s
2. `timeoutIntervalForResource`: 240s → 720s (4 min → 12 min)
3. Stage timeout for extraction: 330s → 660s (5.5 min → 11 min)
4. Request timeout for `/api/analyze-rfp`: 330s → 660s

## How to Test

### 1. Start the Monitor (Optional)
In a terminal window:
```bash
cd /Users/Faisal/Documents/New\ project/angle-rfp
./test-timeout-fix.sh
```

This will show color-coded console output to help you see what's happening.

### 2. Upload a Test RFP
1. Launch the app (already running)
2. Click "Upload Document"
3. Select a real RFP PDF (ideally one that previously failed at 28%)
4. Watch the progress indicator

### 3. What to Observe

#### ✅ SUCCESS INDICATORS:
- Progress bar smoothly advances from 28% → 42%
- No "Socket is not connected" errors in console
- Extraction completes within 11 minutes
- App shows the dashboard with extracted data

#### ❌ FAILURE INDICATORS:
- Progress stops at 28% with "Socket is not connected" errors
- "Analysis failed: Socket is not connected" error message
- Timeout after 11 minutes (means backend is actually too slow)

### 4. Check Render Logs (If Still Failing)
If the app still times out, the issue is on the backend:

```bash
# Check what error the backend is returning
open https://dashboard.render.com/web/[your-service-id]/logs
```

Look for:
- "Claude extraction failed in high-assurance mode"
- "ANTHROPIC_API_KEY is not set"
- Rate limit errors from Anthropic
- Any 500 errors

## Expected Timeline

| Phase | Time | Progress |
|-------|------|----------|
| Parse | ~30s | 12% → 22% |
| Extract | **2-10 min** | 28% → 42% |
| Scope | ~30s | 48% → 58% |
| Research | ~1-2 min | 64% → 75% |
| Score | ~10s | 80% → 88% |

The **extraction phase** is the longest and most likely to cause timeouts.

## Troubleshooting

### If still timing out after 11 minutes:
Backend is genuinely too slow. Check:
1. Render service logs for errors
2. Anthropic API status
3. Backend environment variables

### If getting 500 errors:
Backend is failing. Most likely causes:
1. Missing `ANTHROPIC_API_KEY` in Render
2. Anthropic API rate limits/quota exceeded
3. Backend code error (check Render logs)

### If extraction seems stuck:
The new timeout gives the backend 11 minutes. If it's still working:
- Progress will show "Extracting 28%"
- No errors in console
- Just wait - large RFPs can take 5-10 minutes

## Success Criteria
✅ App completes analysis without timeout errors
✅ Progress reaches 100%
✅ Dashboard shows all extracted RFP data
✅ No "Socket is not connected" errors in console
