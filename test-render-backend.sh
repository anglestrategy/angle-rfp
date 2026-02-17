#!/bin/bash

# Test script to diagnose Render backend issues

RENDER_URL="https://angle-rfp.onrender.com"
BACKEND_TOKEN="${BACKEND_APP_TOKEN}"

if [ -z "$BACKEND_TOKEN" ]; then
    echo "❌ BACKEND_APP_TOKEN environment variable not set"
    echo "   Set it with: export BACKEND_APP_TOKEN='your-token'"
    exit 1
fi

echo "==================================="
echo "Render Backend Diagnostics"
echo "==================================="
echo ""
echo "Testing: $RENDER_URL"
echo ""

# Test 1: Check if backend is reachable
echo "Test 1: Backend Health Check"
echo "-----------------------------------"
curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "Authorization: Bearer $BACKEND_TOKEN" \
    "$RENDER_URL/api/health" 2>&1 | head -20
echo ""

# Test 2: Check parse endpoint (lightweight test)
echo "Test 2: Parse Endpoint Test"
echo "-----------------------------------"
echo "Sending minimal parse request..."
curl -s -w "\nHTTP Status: %{http_code}\n" \
    -X POST \
    -H "Authorization: Bearer $BACKEND_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Trace-Id: test-$(date +%s)" \
    -d '{
      "analysisId": "test-diagnostic",
      "fileBytes": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PD4+Pj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyMDcKJSVFT0YK",
      "mimeType": "application/pdf"
    }' \
    "$RENDER_URL/api/parse-document" 2>&1 | head -30
echo ""

echo "==================================="
echo "Diagnosis Complete"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Check Render dashboard logs at:"
echo "   https://dashboard.render.com/web/[your-service]/logs"
echo ""
echo "2. Verify environment variables are set:"
echo "   - ANTHROPIC_API_KEY"
echo "   - BACKEND_APP_TOKEN"
echo ""
echo "3. To enable fallback mode, add:"
echo "   ANALYSIS_PROFILE=balanced"
echo ""
