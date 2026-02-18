# angle/RFP Backend Deployment

This folder contains the Next.js backend for angle/RFP.

## Required environment variables

- `BACKEND_APP_TOKENS`: comma-separated bearer tokens accepted by backend auth.
- One Gemini key: `GOOGLE_API_KEY` (preferred) or `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`.

## Optional environment variables

- `BRAVE_SEARCH_API_KEY`
- `TAVILY_API_KEY`
- `EXA_API_KEY`
- `FIRECRAWL_API_KEY`
- `SHARE_LINK_BASE_URL`
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`
- `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION`
- `OCR_AZURE_SUBMIT_TIMEOUT_MS`
- `OCR_AZURE_POLL_TIMEOUT_MS`
- `OCR_AZURE_POLL_INTERVAL_MS`
- `OCR_AZURE_MAX_POLL_ATTEMPTS`
- `GOOGLE_VISION_API_KEY` (enables Google Vision OCR fallback when Azure OCR is not configured)
- `GOOGLE_APPLICATION_CREDENTIALS` (service-account credentials for Google Vision OCR)
- `GOOGLE_VISION_AUTH_MODE` (`auto` default, `api_key`, or `adc`)
- `UNSTRUCTURED_API_KEY`
- `UNSTRUCTURED_API_URL`
- `AGENCY_SUPPORTS_MARKET_RESEARCH`
- `ENABLE_MODEL_BEAUTIFY` (`0` recommended; `1` enables extra model beautification pass)
- `RFP_ALLOW_REGEX_FALLBACK` (`0` recommended in production high-assurance mode)
- `RFP_AI_WRAPPER_REFINEMENT` (`1` recommended; applies a final AI canonicalization pass to dashboard fields)
- `RFP_AI_END_TO_END` (`1` recommended; disables silent heuristic fallbacks and requires AI pipeline availability)
- `RFP_AI_SCORE_REFINEMENT` (`1` recommended; lets AI calibrate factor scores/recommendation band using full context)
- `EXTRACTION_AI_WRAPPER_TIMEOUT_MS`
- `EXTRACTION_AI_WRAPPER_HEAD_CHARS`
- `EXTRACTION_AI_WRAPPER_TAIL_CHARS`

### Optional model overrides

- `GEMINI_MODEL_FLASH` (recommended primary override)
- Also recognized: `GOOGLE_MODEL_FLASH`, `GOOGLE_GENERATIVE_AI_MODEL`
- Legacy aliases are still accepted for compatibility: `CLAUDE_MODEL_SONNET`, `CLAUDE_MODEL_HAIKU`, `CLAUDE_MODEL`

Default runtime candidates are:

- `gemini-2.5-flash` -> `gemini-2.0-flash` -> `gemini-1.5-flash` -> `gemini-2.5-flash-lite` -> `gemini-2.5-pro`

Do not use deprecated legacy aliases:

- `claude-sonnet-4-5-latest`
- `claude-haiku-4-5-latest`

If one of those values is provided, the backend logs a warning and falls back to Gemini defaults.

### Provider routing behavior

- Retrieval order is health-scored across `Tavily -> Exa -> Brave` (dynamic ordering by recent reliability/latency).
- Firecrawl is used for official-domain enrichment after search retrieval.
- Provider stats are returned in `researchMetadata.providerStats`.
- Rate-limit / outage conditions degrade with warnings rather than hard-failing when alternate providers succeed.

### Parsing behavior

- Local parser remains the fast path.
- If `UNSTRUCTURED_API_KEY` is set, parser can automatically use Unstructured for low-text / complex layouts.
- If `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` + `AZURE_DOCUMENT_INTELLIGENCE_KEY` are set, OCR fallback is executed through Azure Document Intelligence.
- If Azure OCR is not configured, Google Vision OCR can run with `GOOGLE_VISION_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`.
- If both Google auth modes are present, default preference is API key mode (`GOOGLE_VISION_AUTH_MODE=auto`).
- If Unstructured is unavailable, backend falls back to local parser and emits warnings.

### Extraction behavior

- Extraction is AI-first and windowed across the document.
- A final AI wrapper refinement pass can canonicalize the dashboard mapping (summary/scope/evaluation/deliverables/dates/submission) after pass1.
- With `RFP_AI_END_TO_END=1`, backend fails fast when AI stages are unavailable instead of silently degrading to heuristics.
- With `RFP_AI_SCORE_REFINEMENT=1`, scoring factors/recommendation are AI-calibrated from full extraction + scope + research context.

### Beautification behavior

- Default mode is deterministic formatting (stable and lower-latency).
- Set `ENABLE_MODEL_BEAUTIFY=1` only if you want an additional model pass for stylistic formatting.

## Render deployment

Service settings:

- Repo: `anglestrategy/angle-rfp`
- Branch: `main`
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`

After deploy, verify:

- `GET /api/health`
- `GET /api/version`

`/api/version` reports build from `VERCEL_GIT_COMMIT_SHA`, then `RENDER_GIT_COMMIT`, then `local`.

## Vercel deployment

Project settings:

- Root directory: `backend`
- Framework: Next.js

Set the same environment variables listed above, then verify:

- `GET /api/health`
- `GET /api/version`
