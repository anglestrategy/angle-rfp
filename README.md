# angle/RFP

Production baseline for the public `angle/RFP` launch.

## What ships in v1

- Public landing page
- Account sign up / sign in / sign out
- Authenticated upload and analysis history
- Protected analysis detail, status polling, delete, and PDF export
- Live analysis pipeline only

The live path is the only public path in v1. Shadow scoring, worker mode, OCR, and web research stay disabled in production until they pass staging.

## Local development

1. Copy `.env.example` to `.env` and fill in the required secrets.
2. Start the API:

```bash
npm run dev:api
```

3. Start the frontend:

```bash
npm run dev:web
```

Endpoints:

- Web: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:3002`

## Production environment

Required:

- `DATABASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- `SESSION_SECRET`
- `NODE_ENV=production`

Recommended production defaults:

- `FEATURE_ANALYSIS_WORKER=false`
- `FEATURE_SHADOW_V2=false`
- `FEATURE_EVIDENCE_UI=false`
- `FEATURE_WEB_RESEARCH=false`
- `FEATURE_OCR_FALLBACK=false`
- `FEATURE_LIVE_V2_CUTOVER=false`

## Health checks

- `GET /api/health`
- `GET /api/ready`

`/api/health` is liveness only. `/api/ready` verifies database connectivity and AI key presence.

## Render deployment

This repo includes a starter [render.yaml](./render.yaml) blueprint. The intended rollout is:

1. Push this repo to `release/public-v1`
2. Point Render staging at that branch
3. Verify sign in, upload, analysis, PDF export, and delete
4. Promote only after staging passes

## Database changes

Schema is managed from the local codebase. The current deploy command uses:

```bash
npm run db:push
```

before the production build. Existing SQL migrations are kept in [`migrations`](./migrations).
