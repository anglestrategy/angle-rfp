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

Required for public email verification:

- `APP_BASE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Required for hosted PDF export on Render:

- `PUPPETEER_CACHE_DIR=/opt/render/project/.cache/puppeteer`
- `PUPPETEER_BROWSER=chrome`

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
3. Use the working build command:

```bash
npm ci && npx puppeteer browsers install chrome && npm run db:push && npm run build
```

4. Verify sign in, upload, analysis, PDF export, and delete
5. Configure real email verification before public signup:
   - `APP_BASE_URL`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
6. Promote only after staging passes

## Email verification

Local development falls back to a verification preview URL so you can complete sign-up without an email provider.

Production should use real email delivery. Configure:

- `APP_BASE_URL` to the public app origin
- `RESEND_API_KEY`
- `EMAIL_FROM`

With those set, verification links are delivered by email and the app uses a sent-state verification screen instead of the local preview shortcut.

## Database changes

Schema is managed from the local codebase. The current deploy command uses:

```bash
npm run db:push
```

before the production build. Existing SQL migrations are kept in [`migrations`](./migrations).
