# Pilot Baseline Report (Initial)

Date: 2026-02-10
Environment: local dev baseline

## Scope
- Backend contract-first pipeline:
  - `parse-document`
  - `analyze-rfp`
  - `analyze-scope`
  - `research-client`
  - `calculate-score`
  - `export`

## Baseline Validation Results
- Backend typecheck: pass.
- Contract validation: pass.
- Unit/integration/e2e tests: pass.
- Degraded-mode behavior: pass with partial warnings and continued scoring.

## Determinism Checks
- Repeated scoring calls on identical fixtures produce identical outputs.
- Recommendation band mapping remains stable at threshold boundaries.

## Known Gaps Before Production Pilot
- Replace synthetic benchmark corpus with finalized bilingual pilot dataset.
- Run latency benchmarks under representative concurrency.
- Confirm macOS app backend orchestration path with real backend deployment.

## Go/No-Go Signal (Current)
- Engineering readiness for controlled pilot: **GO (backend)**
- Full production readiness: **PENDING** (requires app migration + pilot corpus metrics)

