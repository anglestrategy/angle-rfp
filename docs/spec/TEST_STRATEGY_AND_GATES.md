# Test Strategy, Benchmark Corpus, and Go-Live Gates

## 1. Objective
Define the full testing strategy required to ship high-assurance backend quality and prevent regressions in extraction, scope analysis, research, scoring, and export.

## 2. Current Baseline Test Commands
From repo root:
1. `npm --prefix backend test`
2. `npm --prefix backend run typecheck`
3. `npm --prefix backend run contracts:validate`
4. `npm --prefix backend run secrets:scan`

Current test directories:
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/analyze-rfp`
2. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/analyze-scope`
3. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/research-client`
4. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/calculate-score`
5. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/e2e`
6. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/platform`
7. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/ai`

## 3. Test Pyramid (Target)
1. Unit tests:
   1. parsers
   2. matchers
   3. model resolver
   4. json validators
   5. score factor functions
2. Integration tests:
   1. route-level behavior
   2. provider routing and fallback
   3. contract compliance
3. End-to-end tests:
   1. parse -> extract -> scope -> research -> score -> export
4. Chaos tests:
   1. provider outages
   2. 429 bursts
   3. model unavailability
5. Quality benchmark tests:
   1. corpus accuracy
   2. contamination and confidence gates

## 4. Benchmark Corpus Design
Corpus location:
1. `/Users/Faisal/Documents/New project/angle-rfp/contracts/fixtures/benchmark-corpus`

Required distribution:
1. 40% Arabic-dominant
2. 40% English-dominant
3. 20% mixed bilingual

Complexity mix:
1. text PDFs
2. scanned PDFs
3. table-heavy docs
4. DOCX and TXT edge cases
5. documents with conflicting dates or duplicate sections

Labeling requirements per sample:
1. ground-truth client/project names
2. ground-truth scope item list
3. deliverables (verbatim vs inferred)
4. important dates and deadline types
5. expected scope classifications for agency profile

## 5. Quality Gates (Hard)
1. Scope contamination rate < 5%.
2. Verbatim deliverable precision >= 0.90.
3. Deadline precision >= 0.95.
4. Deterministic rerun variance <= 2 score points.
5. Provider chaos completion >= 99%.
6. No critical field marked high-confidence without evidence threshold.

## 6. Regression Scenarios (Mandatory)
1. `Executive Summary` text leaked into `Scope Analysis`.
2. Submission/evaluation/timeline contamination in scope list.
3. Market-research classification under multiple capability profiles.
4. Provider 429 storm with fallback chain validation.
5. Model JSON fenced output parsing failures.
6. Duplicate deliverable inflation and inferred overreach.
7. `N/A` factor handling versus `0` scoring behavior.

## 7. Proposed New Test Files
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/quality/benchmark-corpus.test.ts`
2. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/quality/scope-boundary.test.ts`
3. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/quality/provider-chaos.test.ts`
4. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/quality/semantic-adjudication.test.ts`
5. `/Users/Faisal/Documents/New project/angle-rfp/backend/tests/quality/scoring-na-status.test.ts`

## 8. CI Gate Order
1. typecheck
2. contract validation
3. unit/integration tests
4. quality benchmark subset
5. secrets scan
6. optional full corpus nightly job

Merge policy:
1. Any hard gate failure blocks merge.
2. Any quality metric drop beyond tolerance requires explicit approval and mitigation plan.

## 9. Pre-Release Acceptance Protocol
1. Run full benchmark corpus on release candidate.
2. Compare against previous stable baseline.
3. Review failure clusters by category.
4. Validate render deployment smoke tests.
5. Confirm `/api/version` build SHA and prompt set are expected.
6. Sign-off only when all hard gates pass.

## 10. Production Monitoring Gates
Track live indicators:
1. confidence distribution by critical field
2. warning density per stage
3. provider degradation frequency
4. scope contamination sentinel (rule-based detector on output)

Escalate if:
1. contamination exceeds 5% over rolling daily sample.
2. unresolved critical uncertainty > 8% of analyses.
3. provider-degraded warnings > 30% with measurable quality impact.

## 11. Test Data Security
1. sanitize all real client-sensitive documents before benchmark inclusion.
2. never commit secret keys in fixtures.
3. maintain anonymized but semantically realistic corpus.

## 12. Review Cadence
1. Weekly: quick quality trend review.
2. Biweekly: benchmark drift and failure category deep-dive.
3. Monthly: threshold re-calibration and provider strategy review.
