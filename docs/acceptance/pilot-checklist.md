# Pilot Go-Live Checklist

## Contract and API
- [ ] All endpoints implemented: parse, analyze-rfp, analyze-scope, research-client, calculate-score, export, health, version.
- [ ] Response envelope fields present for all endpoints.
- [ ] `schemaVersion` is `1.0.0` across payloads.
- [ ] Contract fixtures pass validation.

## Quality Gates
- [ ] Required extraction fields meet target accuracy on bilingual corpus.
- [ ] Verbatim checks pass for `scopeOfWork` and `evaluationCriteria`.
- [ ] Score reruns remain stable within tolerance (`<=2` points).
- [ ] Partial-result behavior validated for provider outages.

## Reliability and Cost
- [ ] Rate limiter, circuit breaker, and budget guardrails enabled.
- [ ] Token/OCR/query quotas enforced at runtime.
- [ ] Burn-rate forecast available from budget tracking output.
- [ ] Runbooks reviewed with on-call owner.

## App Integration
- [ ] macOS app orchestrates backend stages in order.
- [ ] Default path does not require user Claude/Brave keys.
- [ ] Warnings from backend are visible in progress/results flow.

## Deployment
- [ ] CI green for backend + macOS app tests.
- [ ] Canary cohort enabled and monitored.
- [ ] Rollback trigger documented and verified.

