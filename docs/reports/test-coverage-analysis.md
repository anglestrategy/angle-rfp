# Test Coverage Analysis

**Date:** 2026-02-27
**Scope:** Backend (TypeScript/Vitest) + iOS (Swift/XCTest)

---

## Executive Summary

The codebase has **40 test files** (17 backend, 23 iOS) covering infrastructure and core workflows, but significant gaps exist in the extraction pipeline, scoring internals, document parsing, API route handlers, and iOS data models. This report identifies the highest-value areas where new tests would reduce risk.

---

## Current Coverage Overview

### Backend (17 test files)

| Area | Source Modules | Test Files | Gap |
|------|---------------|------------|-----|
| AI utilities | 2 | 2 | Covered |
| Extraction (orchestrator) | 1 | 1 | Covered |
| Extraction (pipeline passes) | 5 | 0 | **5 modules untested** |
| Extraction (claude-extractor) | 1 | 0 | **Untested** |
| Extraction (adjudicator) | 1 | 1 | Covered |
| Scope analysis | 5 | 1 | **4 modules untested** |
| Scoring | 3 | 1 | **2 modules untested** |
| Research | 6 | 2 | **4 modules untested** |
| Parsing | 7 | 1 | **6 modules untested** |
| Export | 3 | 1 | **2 modules untested** |
| Jobs | 3 | 0 | **3 modules untested** |
| Ops | 5 | 1 | Covered |
| API/Platform | 3 | 3 | Covered |
| Quality gates | 1 | 0 | **Untested** |
| API route handlers | 13 routes | 0 | **No route-level tests** |
| E2E | — | 2 | Covered (pipeline + degraded) |

**Backend total: ~26 source modules lack dedicated tests.**

### iOS/Swift (23 test files)

| Area | Source Files | Test Files | Gap |
|------|-------------|------------|-----|
| Core Services (Analytics, Cache, Logging, Network, Security) | 7 | 14 | Well covered (incl. boundary tests) |
| AI Service | 2 | 1 | **PromptTemplates untested** |
| Web Research | 2 | 3 | Covered |
| Document Parsing (PDF, TXT, OCR) | 4 | 0 | **All untested** |
| Backend Analysis Client | 1 | 0 | **Untested** |
| Data Models | 8 | 0 | **All untested** |
| Utilities/Helpers | 3 | 0 | **All untested** |
| Views | 40+ | 2 (contract-level) | Mostly UI — lower priority |

**iOS total: ~18 source files with testable logic lack tests.**

---

## Recommended Improvements — Prioritized

### Priority 1: Scoring Internals (factors.ts, penalties.ts)

**Risk if untested:** Incorrect financial scores directly mislead client recommendations.

**What to test:**
- `factors.ts` — 11-factor point allocation (18 pts for projectScopeMagnitude, 15 pts for agencyServicesPercentage, etc.), clamping to 0–100, evidence collection, and the `identified` flag that controls whether a factor enters the weighted average
- `penalties.ts` — Red-flag penalty caps (HIGH: 8 pts each capped at 24, MEDIUM: 3 pts capped at 12, LOW: 1 pt capped at 5), completeness penalty formula `(1 - score) * 10`

**Suggested tests in `tests/calculate-score/factors.test.ts`:**
```
- buildFactors() returns exactly 11 items summing to ≤100
- Each factor is clamped to [0, maxPoints]
- Factors with missing data have identified=false
- computeRedFlagPenalty caps per severity tier
- computeRedFlagPenalty with zero red flags returns 0
- computeCompletenessPenalty(1.0) = 0, penalty(0.0) = 10
- computeCompletenessPenalty clamps input to [0, 1]
```

### Priority 2: Extraction Pipeline Passes (pass1–pass5)

**Risk if untested:** These are the core data-extraction steps. Regressions silently corrupt every downstream stage.

**What to test:**
- `pass1-extract.ts` — Field extraction logic, interface shape validation (`Pass1Output`), deliverable item parsing, evaluation criteria grouping. Note: this file already exports `__pass1ExtractTestUtils`, signaling test infrastructure was planned but never written.
- `pass2-verify.ts` — Consistency checks on extracted data
- `pass3-redflags.ts` — Red-flag classification (severity assignment)
- `pass4-completeness.ts` — Completeness assessment scoring
- `pass5-conflicts.ts` — Date/requirement conflict detection

**Approach:** These passes call AI models internally. Tests should mock the AI call and validate the pass logic around it — type coercion, fallback defaults, field mapping, and output schema compliance.

### Priority 3: Document Parsing Modules

**Risk if untested:** Broken parsers produce garbage text that silently flows through the entire pipeline.

**What to test (backend):**
- `normalization.ts` — `detectPrimaryLanguage()` thresholds (Arabic-dominant, English-dominant, mixed at ≥20% ratio), `normalizeForMatching()` Unicode NFKC + Arabic diacritics, `detectSections()` regex heading detection, `extractTables()` pipe/tab delimited table extraction, `buildEvidenceMap()` section-to-evidence conversion
- `pdf-parser.ts` — Corruption detection heuristics (readable character ratio, control character density, binary markers like `%PDF`)
- `txt-parser.ts` — UTF-8 to Latin-1 encoding fallback
- `docx-parser.ts` — Mammoth error handling and warning collection
- `ocr-provider.ts` — Google Vision / Azure DI fail-fast cache (15-min TTL), provider fallback selection
- `parsed-document-store.ts` — TTL expiration (6 hrs), overflow pruning (250-record cap)

**What to test (iOS):**
- `PDFParsingService.swift` — Scanned-vs-text detection (500-char threshold), OCR fallback trigger, PDF artifact cleanup regex
- `TXTParsingService.swift` — Encoding fallback, short-file warning (<200 chars)
- `OCRService.swift` — Vision framework confidence thresholds, spatial text sorting
- `ParseResult.swift` — `hasWarnings` and `criticalWarnings` computed properties

### Priority 4: Job Management (job-store.ts, job-processor.ts, analyze-job-store.ts)

**Risk if untested:** Jobs can get stuck, leak memory, or report wrong progress to the client.

**What to test:**
- `job-store.ts` — Job creation, `generateJobId()` format (`job_` prefix + 16 hex chars), stage advancement, TTL cleanup after 1 hour, cleanup timer `unref()` behavior
- `job-processor.ts` — Stage progression (parse → extract → scope → research → score), error handling at each stage, `StageError` wrapping, warning accumulation
- `analyze-job-store.ts` — Stale job detection (90s heartbeat timeout), synthetic progress calculation (creeps toward 92%), memory overflow pruning, 4-hour TTL

### Priority 5: Scope Matching (matcher.ts, quantity-parser.ts, taxonomy-loader.ts)

**Risk if untested:** Scope misclassification causes wrong service percentages and scoring distortion.

**What to test:**
- `matcher.ts` — Token-based matching, regex hint sets (PARTIAL_HINTS, AGENCY_DOMAIN_HINTS, OUT_OF_SCOPE_HINTS), Arabic/English pattern matching, market research classification
- `quantity-parser.ts` — Regex quantity extraction (`× 5 videos`, `3 motion graphics`), clamping to 0–300 range, `classifyOutputTypes()` keyword detection
- `taxonomy-loader.ts` — CSV parsing (quoted fields, commas inside quotes), caching, `normalizeForMatching()` Unicode handling
- `capability-profile.ts` — Environment variable overrides, profile fallback chain

### Priority 6: Quality Gates

**Risk if untested:** Invalid analyses pass quality checks and reach the client.

**What to test:**
- `quality-gates.ts` — Hard-critical field validation (clientName, projectName, scopeOfWork must be present), evidence density scoring, section score aggregation, blocking vs. review-required decision

### Priority 7: API Error Handling & Request Context

**Risk if untested:** Inconsistent error responses confuse the iOS client.

**What to test:**
- `errors.ts` — `ApiError` class construction, `makeError()` defaults (retryable=false), `normalizeUnknownError()` handling of ApiError, plain Error, and non-Error thrown values
- `request-context.ts` — Request ID prefix format, trace ID normalization from headers, fallback when headers are missing

### Priority 8: Research Providers (brave.ts, exa.ts, firecrawl.ts, tavily.ts)

**Risk if untested:** Silent provider failures cause incomplete client research.

**What to test:** Each provider function should be tested with mocked HTTP responses for:
- Successful query → normalized `ProviderDocument[]` output
- Missing API key → early rejection
- Timeout / network error → proper error propagation
- Response parsing edge cases (missing fields, unexpected formats)

Also test the standalone helpers already partially covered by integration:
- `freshness.ts` — Age-in-days calculation, confidence cap curves per category
- `trust-resolver.ts` — Consensus voting, tie-breaking by tier rank → agreement count → recency

### Priority 9: Export Modules (pdf-renderer.ts, share-link.ts)

**What to test:**
- `pdf-renderer.ts` — `escapePdfText()` for parentheses/backslash escaping, PDF structure validity (object/xref/trailer)
- `share-link.ts` — Payload size limit (64KB), SHA256 token generation, expiry calculation, base-URL env fallback

### Priority 10: iOS Data Models & Helpers

**What to test:**
- `ExtractedRFPData.swift` — Codable round-trip, default values, nested structure initialization
- `RFPDocument.swift` — `fileSizeFormatted` computed property, `DocumentType.init(from:)` extension detection
- `ClientInformation.swift` — `CompanySize.score` (0.2–1.0 range), `.impact` descriptions, enum Codable compliance
- `UploadQueueItem.swift` — File kind classification from extension, validation rules (DOCX rejection), path fingerprint deduplication
- `KeychainHelper.swift` — API key format validation (`sk-ant-` prefix, length checks)
- `APIKeySetup.swift` — URL normalization (bare host → `https://`), `/api` suffix stripping

### Priority 11: API Route Integration Tests

Currently, no API route handler has a dedicated integration test — only the two E2E suites exercise the routes indirectly. Adding route-level tests for at least the critical POST endpoints would catch middleware, validation, and error-handling regressions independently of the full pipeline:

- `POST /api/parse-document` — File upload validation, format rejection, size limits
- `POST /api/analyze-rfp` — Input validation, error envelope on failure
- `POST /api/calculate-score` — Missing field handling, envelope structure
- `POST /api/jobs` + `GET /api/jobs/:jobId` — Job creation and polling lifecycle
- `GET /api/health` — Returns 200 with expected shape

---

## Structural Recommendations

1. **Add `pass1-extract.test.ts`–`pass5-conflicts.test.ts` files** in `tests/extraction/passes/`. The existing `__pass1ExtractTestUtils` export suggests this was planned — follow through.

2. **Add a `tests/parsing/` directory** with `normalization.test.ts`, `pdf-parser.test.ts`, `txt-parser.test.ts`, `docx-parser.test.ts`. The current `parse-document.test.ts` only tests the orchestrator, not the individual parsers.

3. **Add a `tests/scoring/` directory** with `factors.test.ts` and `penalties.test.ts`. These are pure functions with deterministic output — the easiest high-value tests to write.

4. **Add a `tests/jobs/` directory** with `job-store.test.ts`. The in-memory store has TTL and cleanup logic that is easy to test with fake timers.

5. **Consider snapshot tests for prompt templates** (both backend `extraction-prompts.ts` and iOS `PromptTemplates.swift`). Prompt regressions silently degrade extraction quality.

6. **iOS: Add `DocumentParsingTests/` directory** mirroring the service structure. These are the most business-critical untested Swift files.

---

## Summary

| Priority | Area | Modules to Test | Effort | Impact |
|----------|------|-----------------|--------|--------|
| P1 | Scoring internals | 2 | Low | High |
| P2 | Extraction passes | 5 | Medium | Critical |
| P3 | Document parsing | 6 backend + 4 iOS | Medium | High |
| P4 | Job management | 3 | Medium | High |
| P5 | Scope matching | 4 | Medium | High |
| P6 | Quality gates | 1 | Low | High |
| P7 | API errors/context | 2 | Low | Medium |
| P8 | Research providers | 6 | Medium | Medium |
| P9 | Export modules | 2 | Low | Low |
| P10 | iOS models/helpers | 6 | Medium | Medium |
| P11 | API route handlers | 5+ routes | Medium | Medium |

The highest-leverage work is **P1–P3**: scoring internals, extraction passes, and document parsing. These are pure or near-pure functions with deterministic behavior, making them straightforward to test, and they sit on the critical path of every analysis.
