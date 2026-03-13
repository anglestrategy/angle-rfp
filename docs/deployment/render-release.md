# Render Release Checklist

## Branching

1. Create or update `release/public-v1` from the local repo.
2. Push that branch to `origin`.
3. Keep `main` untouched until staging is approved.

## Render staging config

- Build command: `npm ci && npm run db:push && npm run build`
- Start command: `npm run start`
- Health check path: `/api/health`

Required env:

- `DATABASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- `SESSION_SECRET`
- `NODE_ENV=production`

Explicitly set all feature flags:

- `FEATURE_ANALYSIS_WORKER=false`
- `FEATURE_SHADOW_V2=false`
- `FEATURE_EVIDENCE_UI=false`
- `FEATURE_WEB_RESEARCH=false`
- `FEATURE_OCR_FALLBACK=false`
- `FEATURE_LIVE_V2_CUTOVER=false`

## Staging smoke test

1. Open landing page.
2. Create a new account.
3. Sign out, then sign back in.
4. Upload one known-good RFP.
5. Wait for analysis completion.
6. Open the analysis detail page.
7. Export the PDF.
8. Delete the analysis.
9. Confirm `/api/health` and `/api/ready` return `200`.

## Rollback

1. Re-deploy the prior Render release or prior commit on `release/public-v1`.
2. Keep all advanced feature flags off.
3. If a rollout issue is tied to new public code, move Render back to the previously known-good branch/commit before changing anything else.
