#!/bin/bash

# Test script to monitor iOS app during RFP analysis
# This helps verify the timeout fix is working

echo "==================================="
echo "Timeout Fix Test Monitor"
echo "==================================="
echo ""
echo "What to watch for:"
echo "  ✅ No 'Socket is not connected' errors"
echo "  ✅ Progress reaches 42% (extraction complete)"
echo "  ✅ Backend response within 11 minutes"
echo "  ❌ If errors still occur, check Render logs"
echo ""
echo "==================================="
echo "Monitoring console output..."
echo "==================================="
echo ""

# Monitor system log for angle-rfp app
log stream --predicate 'processImagePath contains "angle-rfp"' --level debug --style compact 2>&1 | while read line; do
    # Highlight important events
    if echo "$line" | grep -q "Socket is not connected"; then
        echo "❌ ERROR: $line"
    elif echo "$line" | grep -q "timeout\|timed out"; then
        echo "⚠️  TIMEOUT: $line"
    elif echo "$line" | grep -q "extract\|Extraction"; then
        echo "📊 EXTRACT: $line"
    elif echo "$line" | grep -q "progress.*0\.[234]"; then
        echo "⏱️  PROGRESS: $line"
    elif echo "$line" | grep -q "succeeded\|completed"; then
        echo "✅ SUCCESS: $line"
    elif echo "$line" | grep -q "error\|failed\|Error"; then
        echo "❌ ERROR: $line"
    else
        # Show other lines but dimmed
        echo "$line"
    fi
done
