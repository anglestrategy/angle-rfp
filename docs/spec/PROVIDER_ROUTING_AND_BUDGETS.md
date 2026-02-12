# Provider Routing, Failover, and Budget Governance

## 1. Purpose
Define deterministic provider orchestration for search/research/parsing so quality remains high under outages, throttling, and cost pressure.

## 2. Provider Inventory and Roles

### 2.1 Retrieval/Research
1. Tavily: primary web research provider.
2. Exa: secondary semantic retrieval provider (paid reliability lane).
3. Brave: tertiary fallback provider.
4. Firecrawl: domain-grounded extraction from official domains discovered by search providers.

### 2.2 Parsing/OCR
1. Local parser: fast default for standard docs.
2. Unstructured: premium parser for difficult layouts, mixed language, tables.
3. Azure Document Intelligence (optional): secondary OCR/layout fallback.
4. Google Vision (optional existing OCR key path).

## 3. Current Implementation Anchors
1. Research orchestrator: `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/research/research-client.ts`
2. Current providers:
   1. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/research/providers/brave.ts`
   2. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/research/providers/tavily.ts`
   3. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/research/providers/firecrawl.ts`
3. Circuit breaker utility: `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/ops/circuit-breaker.ts`
4. Rate limiting utility: `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/ops/rate-limit.ts`
5. Budget tracking utility: `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/ops/cost-budget.ts`

## 4. Routing Algorithm (Target)

### 4.1 Health Score
Compute per-provider rolling score:
1. `successRateWeight = 0.45`
2. `latencyWeight = 0.20`
3. `429PenaltyWeight = 0.20`
4. `5xxPenaltyWeight = 0.15`

Provider health score range: `0..100`.

### 4.2 Selection Rules
1. Provider order determined per request by health score and budget availability.
2. Provider with open circuit is skipped unless all circuits open.
3. If all circuits open, attempt half-open probe on best historical provider.

### 4.3 Retry Policy
1. `429`: exponential backoff with jitter; cap retries by provider-specific budget.
2. `5xx`: short retry sequence; fail over quickly after threshold.
3. `4xx` non-rate-limit: no retry unless explicit transient classification.

### 4.4 Failover Sequence
Search phase:
1. Tavily -> Exa -> Brave
2. If search evidence inadequate, run Firecrawl using discovered candidate domains.

Parse phase:
1. Local parse -> Unstructured -> OCR fallback.

LLM stage:
1. Primary model candidates from model resolver.
2. On model-not-found or provider outage, fallback candidate model.

## 5. Budget and Quota Governance

### 5.1 Existing Budgets (Env-Driven)
1. `BUDGET_TOKENS_PER_ANALYSIS` default `220000`
2. `BUDGET_OCR_PAGES_PER_ANALYSIS` default `120`
3. `BUDGET_QUERIES_PER_ANALYSIS` default `24`
4. `BUDGET_DAILY_ANALYSES_PER_USER` default `20`

### 5.2 Provider Budget Extensions (Add)
1. `BUDGET_TAVILY_QUERIES_PER_ANALYSIS`
2. `BUDGET_EXA_QUERIES_PER_ANALYSIS`
3. `BUDGET_BRAVE_QUERIES_PER_ANALYSIS`
4. `BUDGET_FIRECRAWL_FETCHES_PER_ANALYSIS`
5. `BUDGET_UNSTRUCTURED_PAGES_PER_ANALYSIS`

### 5.3 Budget Enforcement Behavior
1. Hard stop when per-analysis budget exhausted for a provider.
2. Continue with alternate providers where available.
3. Emit `warnings[]` with provider budget depletion reason.
4. Set `partialResult=true` if quality-impacting providers are skipped.

## 6. Environment Variable Matrix

### 6.1 Required
1. `ANTHROPIC_API_KEY`
2. `BACKEND_APP_TOKENS`

### 6.2 Recommended Paid Reliability
1. `TAVILY_API_KEY`
2. `EXA_API_KEY`
3. `FIRECRAWL_API_KEY`
4. `UNSTRUCTURED_API_KEY`

### 6.3 Optional
1. `BRAVE_SEARCH_API_KEY`
2. `GOOGLE_VISION_API_KEY`
3. `AZURE_DOCINT_ENDPOINT`
4. `AZURE_DOCINT_KEY`

### 6.4 Model Overrides (Advanced)
1. `CLAUDE_MODEL_SONNET`
2. `CLAUDE_MODEL_HAIKU`

Policy:
1. Deprecated model aliases are rejected by resolver and fallback candidates are used.

## 7. Reliability SLOs
1. Research-stage completion SLO: `>=99%` including degraded mode.
2. p95 research-stage latency target: `<18s` under normal provider health.
3. Parse-stage completion SLO: `>=99.5%` with fallback parser chain.
4. Provider-throttle survival: full pipeline still completes when one provider hard-throttles.

## 8. Warning Taxonomy for Provider Conditions
Standardized warning classes:
1. `provider_degraded`
2. `provider_rate_limited`
3. `provider_unavailable`
4. `provider_budget_exhausted`
5. `parser_fallback_used`

Each warning should include:
1. provider name
2. stage
3. retry count
4. impact level (`low|medium|high`)

## 9. Operational Dashboards (Minimum)
1. Provider request volume by stage.
2. Provider success/429/5xx rates.
3. p50/p95 latency by provider.
4. Circuit state transitions.
5. Budget consumption and projected monthly burn.

## 10. Runbook Triggers
Trigger incident playbook when:
1. Any provider 429 rate > 25% for 15 minutes.
2. End-to-end success < 98% over 30 minutes.
3. Circuit stays open for primary provider > 20 minutes.
4. Budget exhaustion impacts > 10% of analyses in rolling hour.

## 11. Release Checklist for Routing Changes
1. Add unit tests for provider score ordering.
2. Add integration tests with synthetic 429/5xx scenarios.
3. Validate no breaking changes in envelope contract.
4. Validate degraded-mode warnings map correctly in app stage view.
5. Run at least 20 benchmark analyses before promoting to production.
