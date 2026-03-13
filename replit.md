# RFP Analysis Platform

## Overview
AI-powered RFP (Request for Proposal) analysis platform for creative and marketing agencies. Automates document extraction, scope matching, client intelligence, and financial scoring to deliver instant go/no-go recommendations.

## Architecture
- **Frontend**: React + TypeScript, Tailwind CSS, Framer Motion, Recharts, wouter routing
- **Backend**: Express.js + TypeScript, Multer for file uploads
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: Anthropic Claude (claude-sonnet-4-5) via Replit AI Integrations
- **Design**: Cinematic dark-mode-first, Urbanist + IBM Plex Mono fonts, coral/amber accent palette

## Project Structure
```
client/src/
  App.tsx              - Main app with routing (/, /analysis/:id)
  pages/
    home.tsx           - Upload dropzone + analysis history
    analysis.tsx       - Processing stepper + full results dashboard
  components/
    score-badge.tsx    - Reusable score display with color coding
    status-badge.tsx   - Analysis status badge component
    ui/                - Shadcn UI components

server/
  index.ts             - Express server setup
  routes.ts            - API routes + async processing pipeline
  storage.ts           - DatabaseStorage with Drizzle ORM
  db.ts                - PostgreSQL connection pool
  services/
    serviceTaxonomy.ts - 150+ service taxonomy + scope matching
    clientResearch.ts  - Claude-powered client intelligence
    financialScoring.ts - 11-factor financial scoring algorithm

shared/
  schema.ts            - Drizzle schema (rfp_analyses table) + types
```

## Key API Routes
- POST /api/analyses/upload - Upload RFP document (PDF/DOCX)
- GET /api/analyses - List all analyses
- GET /api/analyses/:id - Get full analysis details
- GET /api/analyses/:id/status - Poll processing status
- DELETE /api/analyses/:id - Delete analysis

## Processing Pipeline
1. Document parsing (PDF via pdf-parse, DOCX via mammoth)
2. 5-pass AI extraction (core, verification, red flags, completeness, conflicts)
3. Scope-to-service matching (150 services, 6 categories)
4. Client research (Claude-inferred intelligence)
5. Financial scoring (11 factors, 0-100 score)

## Design System
- Dark theme: #0A0A0B background, #E8734A coral primary, #F4A574 amber secondary
- Fonts: Urbanist (headings/body), IBM Plex Mono (numbers/scores)
- Animations: Framer Motion spring animations
