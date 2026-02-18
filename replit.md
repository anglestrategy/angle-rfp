# angle-rfp

## Overview
A macOS app + Next.js backend for analyzing bilingual (Arabic/English) RFPs and producing structured go/no-go recommendations. The Replit environment hosts the **backend** (Next.js API routes).

## Project Architecture
- **macOS App** (`angle-rfp/`, `angle-rfp.xcodeproj/`): Swift/SwiftUI native app (not runnable on Replit)
- **Backend** (`backend/`): Next.js 15 API routes (TypeScript)
  - API routes in `backend/src/app/api/`
  - Middleware for auth, rate limiting, idempotency in `backend/src/middleware.ts`
  - Libraries in `backend/src/lib/` (AI, extraction, export, research, security, ops)
- **Contracts** (`contracts/`): OpenAPI specs, JSON schemas, fixtures
- **Docs** (`docs/`): Specs, runbooks, deployment guides

## Key API Endpoints
- `GET /api/health` - Health check
- `GET /api/version` - Version info
- `POST /api/parse-document` - Parse uploaded documents
- `POST /api/analyze-rfp` - Full RFP analysis
- `POST /api/analyze-scope` - Scope analysis
- `POST /api/calculate-score` - Financial scoring
- `POST /api/research-client` - Client research
- `POST /api/export` - Export reports

## Environment Variables
- `BACKEND_APP_TOKENS` - Comma-separated auth tokens
- `BRAVE_SEARCH_API_KEY` - Brave Search API key (for research)
- AI provider keys as needed (Google AI SDK configured)

## Running
- Dev: `cd backend && npm run dev` (port 5000, host 0.0.0.0)
- Build: `cd backend && npm run build`
- Production: `cd backend && npm start`

## Recent Changes
- Configured for Replit environment: port 5000, host 0.0.0.0, allowed all dev origins
- Rewrote extraction prompt (EXTRACTION_PROMPT) with detailed Gemini-optimized field-by-field instructions, bilingual handling, and quality standards
- Increased AI context windows: WINDOW_MAX_CHUNKS 2→5, CHUNK_SIZE_CHARS 12k→24k, WINDOW_CONTEXT_CHARS 180k→400k, overlap doubled
- Replaced 4-regex red flag detection with comprehensive AI-powered analysis (16 deterministic patterns + Gemini-based reasoning with deduplication)
- Rewrote AI adjudicator prompt with detailed field-by-field validation rubric, scoring guidance, and evidence-citation requirements; increased source context limits
- Improved scope matching prompt with semantic matching guidelines, strategy research recognition, and increased maxOutputTokens (2200→4096)
