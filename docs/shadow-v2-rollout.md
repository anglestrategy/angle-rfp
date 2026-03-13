# Shadow-v2 Rollout and Rollback

## Default Safety Posture

All new robustness features are disabled by default.

```bash
FEATURE_ANALYSIS_WORKER=false
FEATURE_SHADOW_V2=false
FEATURE_EVIDENCE_UI=false
FEATURE_WEB_RESEARCH=false
FEATURE_OCR_FALLBACK=false
FEATURE_LIVE_V2_CUTOVER=false
```

With all flags off:

- uploads still use the protected `live-v1` path
- analysis still completes inline in the web process
- live scoring and live recommendation stay unchanged
- new shadow-v2 work does not affect the visible live result

## Safe Enable Order

1. `FEATURE_SHADOW_V2=true`
   - Enables shadow-v2 comparison after the live run completes.
   - Live result remains authoritative.

2. `FEATURE_EVIDENCE_UI=true`
   - Exposes the hidden review data for internal comparison.
   - Keep access internal via `?shadow=1`.

3. `FEATURE_OCR_FALLBACK=true`
   - Enables OCR for low-text PDFs.
   - Only affects parse quality and manual-review gating.

4. `FEATURE_ANALYSIS_WORKER=true`
   - Moves new uploads to the Postgres-backed worker queue.
   - Live algorithm stays `live-v1`.

5. `FEATURE_WEB_RESEARCH=true`
   - Enables Exa-backed external source retrieval for the client-intelligence stage.
   - Requires `EXA_API_KEY` in the environment.
   - If Exa returns no usable results or fails, the run stays in document-only inference mode and logs a research note instead of failing the analysis.

6. `FEATURE_LIVE_V2_CUTOVER=true`
   - Do not enable until shadow parity is acceptable.
   - This flag is intentionally present now for future cutover control.

## Rollback Order

If anything looks wrong, disable flags in this order:

1. `FEATURE_LIVE_V2_CUTOVER=false`
2. `FEATURE_EVIDENCE_UI=false`
3. `FEATURE_WEB_RESEARCH=false`
4. `FEATURE_SHADOW_V2=false`
5. `FEATURE_OCR_FALLBACK=false`
6. `FEATURE_ANALYSIS_WORKER=false`

Then restart the app.

This returns new uploads to inline `live-v1` processing and leaves existing live analysis records intact.

## Current Validation Commands

If you want external research enabled locally:

```bash
EXA_API_KEY=your_key_here
FEATURE_WEB_RESEARCH=true
```

```bash
npm run check
npm test -- tests/analysis-shadow.test.ts
npm run baseline:snapshot
npm run shadow:backfill
npm run baseline:compare
```

## Promotion Guardrails

- Do not promote if `npm run baseline:compare` reports `promotionReady: false`
- Review any analysis with `manualReviewRequired: true`
- Review any shadow score delta above 10 points
- Keep the live recommendation as the source of truth until shadow parity is acceptable
