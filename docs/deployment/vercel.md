# Deploy Backend To Vercel (Cost-Neutral)

This repo ships a Next.js backend under `backend/`.

## 1) Create Project

1. In Vercel, **New Project** -> import `anglestrategy/angle-rfp`
2. Set **Root Directory** to `backend`
3. Framework preset: Next.js (auto-detected)

## 2) Required Environment Variables

In Vercel Project Settings -> Environment Variables:

- `BACKEND_APP_TOKENS`
  - Required in production.
  - Comma-separated list of allowed tokens, e.g. `token1,token2`
  - Do **not** use `dev-angle-rfp-token` in production (blocked).

Recommended:
- `BRAVE_SEARCH_API_KEY` (enables Brave research provider)

Optional:
- `TAVILY_API_KEY`
- `FIRECRAWL_API_KEY`
- `SHARE_LINK_BASE_URL`

## 3) Deploy

Push to `main`. Vercel will build + deploy.

## 4) Verify

1. Open: `https://<your-vercel-domain>/api/health`
2. Open: `https://<your-vercel-domain>/api/version`

POST endpoints require:
- `Authorization: Bearer <one-of-BACKEND_APP_TOKENS>`
- `Idempotency-Key: <uuid>`
- `X-Trace-Id: <uuid>` (recommended)

## 5) Connect The macOS App

Give users:
- Backend base URL: `https://<your-vercel-domain>`
- Backend token: one of the `BACKEND_APP_TOKENS`

Users paste those into the app: **Settings -> Backend Configuration**.

