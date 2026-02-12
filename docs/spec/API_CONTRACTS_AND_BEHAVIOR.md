# API Contracts and Runtime Behavior

## 1. Contract Philosophy
This API is contract-first and envelope-standardized. Every endpoint must return a common envelope so the macOS app can render predictable progress and warnings.

Canonical contract files:
1. `/Users/Faisal/Documents/New project/angle-rfp/contracts/openapi/angle-rfp-v1.yaml`
2. `/Users/Faisal/Documents/New project/angle-rfp/contracts/schemas/v1/*.schema.json`

Validator command:
1. `npm --prefix backend run contracts:validate`

## 2. Global Protocol

### 2.1 Required Headers
For all `POST /api/*`:
1. `Authorization: Bearer <token>`
2. `Idempotency-Key: <string>=8+ chars`

Recommended for traceability:
1. `X-Trace-Id: <uuid>`

Behavior:
1. Missing/invalid auth -> `401 auth_failed`
2. Missing idempotency key -> `400 validation_error`
3. Middleware rate-limit breach -> `429 rate_limited`

Source files:
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/middleware.ts`
2. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/security/auth.ts`
3. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/security/idempotency.ts`
4. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/ops/rate-limit.ts`

### 2.2 Response Envelope
Every endpoint returns:
1. `requestId`
2. `traceId`
3. `schemaVersion`
4. `durationMs`
5. `warnings[]`
6. `partialResult`
7. `data`
8. `error`

Source: `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/api/envelope.ts`

### 2.3 Error Codes
Current canonical errors:
1. `validation_error`
2. `auth_failed`
3. `rate_limited`
4. `timeout`
5. `upstream_rate_limited`
6. `upstream_unavailable`
7. `schema_validation_failed`
8. `unsupported_format`
9. `file_too_large`
10. `partial_result`
11. `server_misconfigured`
12. `internal_error`

Source: `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/api/errors.ts`

Planned additive quality codes:
1. `quality_degraded`
2. `insufficient_evidence`
3. `cross_model_disagreement`

## 3. Endpoint Behavior Matrix

### 3.1 GET `/api/health`
Purpose:
1. Liveness/readiness quick check.

Expected `data` fields:
1. `status`
2. `service`
3. `timestamp`
4. `uptimeSeconds`

Failure modes:
1. Should rarely fail unless process not reachable.

### 3.2 GET `/api/version`
Purpose:
1. Identify deployed API/schema/prompt set and build SHA.

Expected `data` fields:
1. `apiVersion`
2. `schemaVersion`
3. `promptVersionSet`
4. `build`

Build SHA behavior:
1. Prefer provider env (`VERCEL_GIT_COMMIT_SHA` or `RENDER_GIT_COMMIT`) before local fallback.

### 3.3 POST `/api/parse-document`
Purpose:
1. Normalize uploaded files into parse contract.

Input:
1. `analysisId` (uuid)
2. `file` (multipart binary)

Output contract:
1. `ParsedDocumentV1`

Degraded behavior:
1. OCR fallback warnings in `warnings[]`.
2. `partialResult=true` when parser fallback used.

### 3.4 POST `/api/analyze-rfp`
Purpose:
1. Multi-pass extraction of required RFP fields.

Input:
1. `analysisId`
2. `parsedDocument`

Output:
1. `ExtractedRFPDataV1`

Runtime behavior:
1. pass1 extraction
2. pass2 verification
3. pass3 red-flags
4. pass4 completeness
5. pass5 conflicts
6. beautification stage (non-fatal enhancement)

Degraded behavior:
1. If LLM extraction fails, regex fallback can still return usable output with warnings.
2. If beautification fails, raw structured fallback is returned.

### 3.5 POST `/api/analyze-scope`
Purpose:
1. Classify scope items against agency taxonomy.

Input:
1. `analysisId`
2. `scopeOfWork`
3. `language`

Output:
1. `ScopeAnalysisV1`

Runtime behavior:
1. line segmentation
2. noise filtering
3. semantic match (LLM where available)
4. deterministic fallback matching
5. percentage and output quantity/type calculations

Planned additive fields:
1. `unclassifiedItems[]`
2. `matches[].class` may include `uncertain`

### 3.6 POST `/api/research-client`
Purpose:
1. Gather company/client signals from web providers.

Input:
1. `analysisId`
2. `clientName`
3. `clientNameArabic` optional
4. `country=SA`
5. `rfpContext` optional

Output:
1. `ClientResearchV1`

Runtime behavior:
1. query planning
2. provider calls
3. trust resolution
4. freshness confidence cap
5. warnings aggregation

Degraded behavior:
1. Provider outages become warnings if at least one provider returns useful evidence.
2. Hard fail only when all providers fail and no research evidence is available.

### 3.7 POST `/api/calculate-score`
Purpose:
1. Compute deterministic weighted financial fit score.

Input:
1. `analysisId`
2. `extractedRfp`
3. `scopeAnalysis`
4. `clientResearch`

Output:
1. `FinancialScoreV1`

Planned additive fields:
1. `factors[].status = scored|na|insufficient_evidence`

### 3.8 POST `/api/export`
Purpose:
1. Produce export payloads (PDF/email/link).

Input:
1. `analysisId`
2. `report`
3. `format`

Output:
1. `AnalysisReportV1`

Runtime behavior:
1. secure temporary handling
2. size and format constraints
3. export warnings on degraded payload pathways

## 4. Idempotency Rules
1. Every POST call requires `Idempotency-Key`.
2. Same request with same idempotency key should not generate duplicate side effects.
3. Export endpoints must protect against duplicate artifact generation.

## 5. Partial Result Contract
When `partialResult=true`:
1. `data` remains structurally valid.
2. `warnings[]` must explain degraded sources/stages.
3. `error` remains `null` unless request truly failed.

## 6. OpenAPI Governance (Swagger)
What Swagger/OpenAPI is used for:
1. API endpoint and schema documentation.
2. Contract validation and drift detection.
3. Integration behavior examples for app and external consumers.

What Swagger/OpenAPI is not used for:
1. Beautification quality control.
2. Semantic correctness validation.

Required governance process:
1. Update OpenAPI and JSON schema together for any contract change.
2. Add fixture examples for new response variants.
3. Run `contracts:validate` in CI and block merge on failure.

## 7. Backward Compatibility Policy
1. Additive changes only in `v1.x`.
2. No field removals/renames for existing app contracts without major version.
3. New optional fields must be nullable-safe on app side.

## 8. Integration Checklist for App Client
1. Send `Authorization` and `Idempotency-Key` on every POST.
2. Send `X-Trace-Id` for per-analysis observability.
3. Always parse envelope first before stage payload.
4. Render `warnings[]` as informational/degraded messages without crashing flow.
5. Handle future additive fields safely via optional decoding.
