# Claude Latency Spike Runbook

## Trigger
- `analyze-rfp` p95 latency > 12s for 10 minutes.
- Timeout or upstream unavailable errors exceed 5%.

## Immediate Actions
1. Verify Anthropic status page and regional incidents.
2. Check request payload size distribution and token budget counters.
3. Reduce extraction pass complexity for oversized documents.

## Mitigation
1. Apply stricter token budget capping per analysis.
2. Preserve exact-text fields (`scopeOfWork`, `evaluationCriteria`) first.
3. Return partial results only when schema-safe; otherwise fail fast with retryable error.

## Recovery Validation
1. Re-run analyze-rfp tests and full-pipeline e2e.
2. Confirm end-to-end p95 returns below target.
3. Confirm deterministic score stability remains within tolerance.

## Escalation
- Primary: Backend owner on-call.
- Secondary: Leadership if SLA breach exceeds 60 minutes.

