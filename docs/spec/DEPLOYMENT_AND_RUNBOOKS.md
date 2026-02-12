# Deployment, Operations, and Runbook Guide

## 1. Deployment Targets
Primary backend target:
1. Render web service from repo `anglestrategy/angle-rfp`
2. Branch `main`
3. Root directory `backend`

Optional secondary target:
1. Vercel deployment for compatibility parity

## 2. Render Baseline Settings
1. Build command: `npm install && npm run build`
2. Start command: `npm start`
3. Node: use Render default or pin to LTS compatible with Next 15
4. Health verification endpoints:
   1. `/api/health`
   2. `/api/version`

Deployment metadata requirement:
1. `/api/version` must expose build SHA from `RENDER_GIT_COMMIT` when available.

## 3. Environment Variables

### 3.1 Required
1. `BACKEND_APP_TOKENS`
2. `ANTHROPIC_API_KEY`

### 3.2 Recommended
1. `TAVILY_API_KEY`
2. `EXA_API_KEY`
3. `FIRECRAWL_API_KEY`
4. `UNSTRUCTURED_API_KEY`

### 3.3 Optional
1. `BRAVE_SEARCH_API_KEY`
2. `GOOGLE_VISION_API_KEY`
3. `AZURE_DOCINT_ENDPOINT`
4. `AZURE_DOCINT_KEY`
5. `CLAUDE_MODEL_SONNET`
6. `CLAUDE_MODEL_HAIKU`
7. `ANALYSIS_PROFILE` (`high_assurance|balanced|fast`, default `high_assurance`)
8. `AGENCY_CAPABILITY_PROFILE` (`angle-agency|default|full-service`)
9. `AGENCY_SUPPORTS_MARKET_RESEARCH` (`true|false`, explicit override)

### 3.4 Guardrail Policy
1. Do not set deprecated model aliases.
2. Remove legacy `CLAUDE_MODEL` overrides unless intentionally mapped.
3. Keep tokens rotated and scoped to environment.
4. Keep `ANALYSIS_PROFILE=high_assurance` in production unless explicitly testing throughput tradeoffs.

## 4. Pre-Deploy Verification
Run from repo root:
1. `npm --prefix backend ci`
2. `npm --prefix backend run typecheck`
3. `npm --prefix backend test`
4. `npm --prefix backend run contracts:validate`
5. `npm --prefix backend run secrets:scan`

Post-deploy smoke tests:
1. `curl https://<host>/api/health`
2. `curl https://<host>/api/version`
3. Auth-required POST smoke with valid token + idempotency key.

## 5. Observability Requirements

### 5.1 Structured Logs
Must include:
1. `requestId`
2. `traceId`
3. stage name
4. provider name (if applicable)
5. warning/error code
6. retry count

### 5.2 Dashboard Metrics
1. API success/error rates by endpoint.
2. Stage-level completion and p95 latency.
3. Provider success, 429, 5xx, and circuit-open counts.
4. Quality gate trends (contamination, confidence failures).
5. Budget burn (tokens, queries, OCR pages).

## 6. Incident Severity Levels
1. `SEV-1`: production outage or hard failure for majority analyses.
2. `SEV-2`: degraded quality/reliability with active fallback but material impact.
3. `SEV-3`: non-critical warnings, localized provider instability.

## 7. Runbooks

### 7.1 Anthropic Model Not Found
Symptoms:
1. `404 not_found_error model: ...`

Actions:
1. Inspect model resolver logs and candidate list.
2. Remove invalid model env overrides.
3. Redeploy and verify `/api/version` build SHA.
4. Re-run end-to-end smoke analysis.

### 7.2 Provider 429 Storm (Brave/Tavily/Exa)
Symptoms:
1. repeated `upstream_rate_limited` or provider retry warnings.

Actions:
1. Confirm provider quota/plan status.
2. Check router health scores and circuit states.
3. Temporarily lower traffic or shift weights to healthy providers.
4. Confirm degraded-mode warning behavior remains user-safe.

### 7.3 Parser Quality Drop
Symptoms:
1. scope contamination increases
2. missing tables/incorrect deliverables

Actions:
1. Switch parser priority to premium path (Unstructured).
2. Validate OCR path for scanned docs.
3. Run benchmark subset and compare quality deltas.
4. Keep rollback option to last known-good parse strategy.

### 7.4 Quality Regression Spike
Symptoms:
1. gate failures in CI or production monitoring.

Actions:
1. Halt release promotions.
2. Roll back to previous stable build.
3. run targeted regression suite on failing categories.
4. require postmortem and correction PR before re-release.

## 8. Rollback Policy
Rollback triggers:
1. API availability < 98% for 15 min.
2. critical quality gate breach persists after hotfix attempt.
3. provider routing bug causing wide partial failure.

Rollback method:
1. Promote last stable Render deploy.
2. verify health/version.
3. run smoke analysis sample.
4. communicate incident summary and next corrective release window.

## 9. Release Promotion Rules
1. No promotion if contracts/tests/quality gates fail.
2. No promotion if unresolved SEV-2+ incident remains open.
3. Promotion must include build SHA, migration notes, and rollback reference.

## 10. macOS App Integration Operational Notes
1. Keep backend URL/token handling secure and production-targeted.
2. Keep app design unchanged while handling richer warning taxonomy.
3. Verify app can decode additive API fields without crashing.

Relevant app integration files:
1. `/Users/Faisal/Documents/New project/angle-rfp/angle-rfp/Services/Backend/BackendAnalysisClient.swift`
2. `/Users/Faisal/Documents/New project/angle-rfp/angle-rfp/Models/API/BackendContractsV1.swift`

## 11. Documentation Maintenance Cadence
1. Update this runbook after every incident with root cause + permanent fix.
2. Re-validate env var matrix monthly.
3. Re-check provider pricing/rate-limit policies quarterly.
