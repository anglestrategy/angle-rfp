# Research Source Outage Runbook

## Trigger
- `research-client` endpoint returns >10% upstream failures over 5 minutes.
- Circuit breaker state is `open` for any provider (`brave`, `tavily`, `firecrawl`).

## Immediate Actions
1. Identify failing provider(s) from warnings and logs.
2. Confirm provider keys and quotas are valid.
3. Check current rate-limits and disable non-essential query fanout if needed.

## Mitigation
1. Continue with available sources and return `partialResult=true`.
2. Add warning with failed provider names in response envelope.
3. Keep trust hierarchy deterministic for remaining evidence.

## Recovery Validation
1. Re-run degraded-mode test suite (`backend/tests/e2e/degraded-mode.test.ts`).
2. Confirm response still includes evidence and confidence capping rules.
3. Confirm circuit breakers close after healthy probes.

## Escalation
- Primary: Backend owner on-call.
- Secondary: Product owner if partial mode exceeds 2 hours.

