# angle/RFP Backend Deployment

This folder contains the Next.js backend for angle/RFP.

## Required environment variables

- `BACKEND_APP_TOKENS`: comma-separated bearer tokens accepted by backend auth.
- `ANTHROPIC_API_KEY`: Anthropic API key used for extraction/scope/research LLM calls.

## Optional environment variables

- `BRAVE_SEARCH_API_KEY`
- `TAVILY_API_KEY`
- `FIRECRAWL_API_KEY`
- `SHARE_LINK_BASE_URL`
- `GOOGLE_VISION_API_KEY`

### Optional model overrides

- `CLAUDE_MODEL_SONNET`
- `CLAUDE_MODEL_HAIKU`
- Legacy `CLAUDE_MODEL` is supported only for sonnet paths.

Do not use deprecated aliases:

- `claude-sonnet-4-5-latest`
- `claude-haiku-4-5-latest`

If one of those values is provided, the backend logs a warning and falls back to safe defaults.

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
