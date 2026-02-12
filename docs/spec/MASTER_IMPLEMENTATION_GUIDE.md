# angle/RFP Master Implementation Guide (High-Assurance Production)

## 1. Purpose
This document is the canonical build guide for transforming angle/RFP into a high-assurance, production-grade analysis system for bilingual (Arabic/English) RFP decisions.

Primary goals:
1. Maximize extraction/scoring correctness for go/no-go decisions.
2. Enforce reliability under provider failures and rate limits.
3. Preserve current app design while improving backend intelligence quality.
4. Make all critical outputs auditable with evidence and confidence controls.

## 2. Scope Boundaries
In scope:
1. Backend extraction, scope analysis, research, scoring, and export quality.
2. API contract governance (OpenAPI + JSON schema + versioning).
3. Provider routing/failover/cost controls.
4. Semantic assurance, uncertainty handling, and escalation policy.
5. Deployment/operations/testing gates.

Out of scope:
1. UI redesign/theme/layout changes.
2. CRM/proposal authoring automation.
3. Non-essential product expansion outside RFP analysis.

## 3. Source-of-Truth Files (Current Repo)
Core backend and contracts:
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/app/api/*`
2. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/*`
3. `/Users/Faisal/Documents/New project/angle-rfp/contracts/openapi/angle-rfp-v1.yaml`
4. `/Users/Faisal/Documents/New project/angle-rfp/contracts/schemas/v1/*`
5. `/Users/Faisal/Documents/New project/angle-rfp/agencyservicesheet.csv`

App-side API integration:
1. `/Users/Faisal/Documents/New project/angle-rfp/angle-rfp/Services/Backend/BackendAnalysisClient.swift`
2. `/Users/Faisal/Documents/New project/angle-rfp/angle-rfp/Models/API/BackendContractsV1.swift`

Validation scripts:
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/package.json`
2. `npm --prefix backend run contracts:validate`
3. `npm --prefix backend test`
4. `npm --prefix backend run typecheck`

## 4. Non-Negotiable Product Principles
1. Critical claims require evidence or explicit `insufficient_evidence`.
2. Confidence must never be implied when unresolved conflicts exist.
3. Degraded provider conditions must produce controlled warnings, not silent quality loss.
4. Scope analysis must be capability-profile driven, not one-off hardcoding.
5. Contract compatibility must remain backward-safe for current macOS client.

## 5. Target Architecture (Final)

### 5.1 Pipeline Overview
1. Parse: local parser fast path + premium parse fallback (Unstructured) + OCR fallback.
2. Extract: multi-pass structured extraction with verification/conflict/completeness layers.
3. Scope: segmentation + noise filtering + semantic matching + capability profile policy.
4. Research: routed multi-provider collection + conflict resolution + freshness capping.
5. Score: deterministic weighted model with `scored|na|insufficient_evidence` statuses.
6. Export: report assembly with secure artifact handling.

### 5.2 System State Machine
States:
1. `uploaded`
2. `parsed`
3. `extracted`
4. `scope_analyzed`
5. `researched`
6. `scored`
7. `rendered`
8. `exported`
9. `failed`

Stage exit rules:
1. Each stage emits explicit payload + warnings + confidence impact.
2. Hard failure if contract-invalid output and no valid fallback exists.
3. Partial success allowed with `warnings[]` and `partialResult=true`.

### 5.3 Data Reliability Architecture
1. Evidence map carried from parse to extract/scope/score outputs.
2. Critical-field evidence density gates enforced before recommendation quality tier is assigned.
3. Cross-model adjudication for contested critical fields.
4. Uncertain classifications isolated (not silently treated as out-of-scope).

## 6. Workstreams and Sequencing

### Workstream A: Contracts and Governance (first)
1. Freeze API schemas and OpenAPI envelopes.
2. Add non-breaking v1.1 fields: `qualityFlags`, `providerStats`, `factorStatus`, `unclassifiedItems`.
3. Add full degraded-mode response examples in OpenAPI.

### Workstream B: Provider Routing and Reliability
1. Implement provider-health scoring and weighted routing.
2. Add Exa provider integration.
3. Add explicit fallback ordering and circuit-aware selection.
4. Introduce provider budget controls and per-provider error telemetry.

### Workstream C: Parsing and Extraction Quality
1. Add Unstructured parser adapter and route conditions.
2. Add deterministic section classifier and scope canonicalizer.
3. Enforce strict schema transformation for beautified output.
4. Add contamination validator for scope boundaries.

### Workstream D: Semantic Assurance and Scoring Integrity
1. Define critical fields and evidence thresholds.
2. Add adjudication flow for low-confidence or conflict-heavy fields.
3. Upgrade scoring factors to support `N/A` and `insufficient_evidence`.
4. Block high-confidence recommendations when critical uncertainty remains.

### Workstream E: Operations and Go-Live
1. Add dashboards/alerts for quality + provider reliability.
2. Add incident runbooks and rollback triggers tied to quality regressions.
3. Run benchmark corpus and chaos tests before production sign-off.

## 7. Configuration Policy
Required in production:
1. `ANTHROPIC_API_KEY`
2. `BACKEND_APP_TOKENS`

Recommended (quality/reliability):
1. `TAVILY_API_KEY`
2. `EXA_API_KEY`
3. `FIRECRAWL_API_KEY`
4. `UNSTRUCTURED_API_KEY`

Optional advanced:
1. `CLAUDE_MODEL_SONNET`
2. `CLAUDE_MODEL_HAIKU`
3. `BRAVE_SEARCH_API_KEY`
4. `GOOGLE_VISION_API_KEY`

Guardrails:
1. Deprecated model aliases must be rejected/fallbacked by model resolver.
2. Missing optional providers must not crash the pipeline.

## 8. Quality Standards
Minimum release targets:
1. Scope contamination < 5% on benchmark corpus.
2. Verbatim deliverable precision >= 0.90.
3. Deadline extraction precision >= 0.95.
4. Rerun score variance <= 2 points for deterministic fixtures.
5. Chaos failover success >= 99% for staged provider outages.

## 9. Definition of Done
Done means all are true:
1. Contract validation passes.
2. Unit/integration/e2e/chaos tests pass.
3. Semantic gates pass benchmark thresholds.
4. Runbooks and on-call procedures are documented and tested.
5. Render deployment exposes healthy `/api/health` and traceable `/api/version` build SHA.
6. App receives unchanged visual design with improved payload quality.

## 10. Versioning and Change Control
1. Any schema addition must be additive and backward-compatible.
2. Any behavior change that alters downstream interpretation must include fixture updates.
3. Any provider strategy change must include routing regression tests.
4. Any scoring-factor logic change must include reproducibility fixture snapshots.

## 11. Reference Index
1. `/Users/Faisal/Documents/New project/angle-rfp/docs/spec/API_CONTRACTS_AND_BEHAVIOR.md`
2. `/Users/Faisal/Documents/New project/angle-rfp/docs/spec/PROVIDER_ROUTING_AND_BUDGETS.md`
3. `/Users/Faisal/Documents/New project/angle-rfp/docs/spec/SEMANTIC_ASSURANCE.md`
4. `/Users/Faisal/Documents/New project/angle-rfp/docs/spec/DEPLOYMENT_AND_RUNBOOKS.md`
5. `/Users/Faisal/Documents/New project/angle-rfp/docs/spec/TEST_STRATEGY_AND_GATES.md`
