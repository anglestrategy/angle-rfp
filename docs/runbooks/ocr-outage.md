# OCR Outage Runbook

## Trigger
- `parse-document` warnings spike with OCR fallback failures.
- OCR provider latency > 30s p95 or failure rate > 20% for 5 minutes.

## Immediate Actions
1. Confirm provider key/config values are present in production environment.
2. Verify provider-specific health endpoint or dashboard.
3. Toggle OCR fallback mode to text-only if provider is unavailable.
4. Post incident banner in internal ops channel with impact summary.

## Mitigation
1. Keep pipeline running with `partialResult=true`.
2. Tag affected analyses with warning: `OCR unavailable; extraction confidence reduced`.
3. Cap parse confidence for OCR-eligible documents at `<=0.65`.

## Recovery Validation
1. Run parse test corpus with scanned Arabic PDF.
2. Confirm OCR pages are counted and budget guardrail still enforced.
3. Verify warnings return to baseline.

## Escalation
- Primary: Backend owner on-call.
- Secondary: Product owner for SLA communication.

