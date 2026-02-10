# angle-rfp (Plain English): What We Built + What To Do Next

## What we built (in normal words)

You now have two parts:

1. **The Mac app (SwiftUI)**: it’s the UI you use.
2. **A backend (Next.js)**: it does the heavy “analysis work” in small steps.

The Mac app now sends the RFP to the backend and asks it to do the steps in order:

1. Parse the document (PDF/DOCX/TXT, OCR fallback)
2. Extract key RFP fields
3. Compare the scope vs your services list
4. Research the client (with trust rules + freshness)
5. Score the opportunity (deterministic scoring)
6. Export a report (pdf/email/link contract)

This makes the system easier to operate, debug, and improve without turning the Mac app into a giant monolith.

## Where to look in the repo

- Backend code: `backend/`
- API contracts (schemas + OpenAPI): `contracts/`
- Runbooks (what to do when something breaks): `docs/runbooks/`
- Pilot checklist + baseline: `docs/acceptance/` and `docs/reports/`
- Mac app backend client: `angle-rfp/Services/Backend/BackendAnalysisClient.swift`

## What changed for you day-to-day

Before: the Mac app needed direct Claude/Brave keys and did the work locally.

Now: the Mac app mainly needs:
- a backend URL (example: `http://localhost:3000`)
- a backend app token (dev default works out of the box)

## Quick local test (backend + app)

1. Start backend
   - `cd backend`
   - `npm install`
   - `npm run dev`

2. Backend auth defaults
   - Backend accepts tokens from `BACKEND_APP_TOKENS`
   - If unset, it defaults to: `dev-angle-rfp-token`

3. Configure the Mac app to match
   - Set `BACKEND_BASE_URL` to your backend URL
   - Set `BACKEND_APP_TOKEN` to the same token the backend accepts
   - (Dev default token is: `dev-angle-rfp-token`)

## What to do next (best next steps)

1. **Pilot run**
   - Use a small set of real bilingual RFPs.
   - Fill in/adjust `docs/reports/pilot-baseline.md` with measured results (accuracy, latency, reproducibility).

2. **Deploy backend**
   - Deploy `backend/` to Vercel.
   - Set environment variables in Vercel (at minimum):
     - `BACKEND_APP_TOKENS`
   - Then point the Mac app to the production backend URL.

3. **Security hygiene**
   - Never store real API keys in repo files (docs/scripts).
   - Use environment variables and secret managers (Vercel env vars, macOS Keychain).

