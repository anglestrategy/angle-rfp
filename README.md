# angle-rfp

macOS app + small backend for analyzing bilingual (Arabic/English) RFPs and producing a structured recommendation (go / no-go).

## What You Ship

- **macOS app** (`angle-rfp.xcodeproj`) that users can download and run.
- **Backend** (`backend/`, Next.js API routes) deployed to Vercel.

The app:
- Parses documents locally (PDF/TXT) to avoid large uploads and reduce cost.
- Calls the backend for extraction, scope analysis, research, and scoring.

## Quick Start (Developer)

### 1) Backend (local)

```bash
cd backend
npm ci

# Dev token is allowed only for local development.
BACKEND_APP_TOKENS=dev-angle-rfp-token \
BRAVE_SEARCH_API_KEY='...' \
npm run dev
```

Health check:
```bash
curl -s http://localhost:3000/api/health | jq .
```

### 2) macOS App (local)

Open the Xcode project and run:
```bash
open angle-rfp.xcodeproj
```

In the app, open **Settings -> Backend Configuration** and set:
- Backend Base URL: `http://localhost:3000`
- Backend App Token: `dev-angle-rfp-token`

## Production (People Can Download And Use It)

### 1) Deploy backend to Vercel

See: `docs/deployment/vercel.md`

### 2) Build a distributable macOS app

See: `docs/release/macos.md`

One-command local build (unsigned zip + dmg):
```bash
./scripts/release-macos.sh
```

Output:
- `dist/angle-rfp-macos.zip`
- `dist/angle-rfp-macos.dmg`

### 3) Give users 2 things

1. Your backend URL (Vercel production URL)
2. A backend token (one of the values in `BACKEND_APP_TOKENS`)

Users paste those into the app **Settings** screen.

## Security Notes (Non-Negotiable)

- Never commit API keys (Claude/Anthropic, Brave, etc).
- Rotate any key that was ever exposed.
- Backend **requires** `BACKEND_APP_TOKENS` in production. The dev token is blocked on Vercel.

