import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { makeError } from "@/lib/api/errors";
import { InMemoryCircuitBreaker } from "@/lib/ops/circuit-breaker";
import { confidenceCapForFreshness } from "@/lib/research/freshness";
import { queryBrave, type ProviderDocument } from "@/lib/research/providers/brave";
import { queryFirecrawl } from "@/lib/research/providers/firecrawl";
import { queryExa } from "@/lib/research/providers/exa";
import { queryTavily } from "@/lib/research/providers/tavily";
import {
  getProviderHealthScore,
  rankProviders,
  recordProviderOutcome,
  type RoutedProviderName
} from "@/lib/research/provider-router";
import { resolveClaims } from "@/lib/research/trust-resolver";
import {
  getGeminiModelResolutionDiagnostics,
  resolveGoogleApiKey,
  runWithGeminiFlashModel
} from "@/lib/ai/model-resolver";
import { withHardTimeout } from "@/lib/extraction/claude-extractor";

export interface ResearchClientInput {
  analysisId: string;
  clientName: string;
  clientNameArabic?: string;
  country: "SA";
  // RFP context for smarter query generation
  rfpContext?: {
    projectName?: string;
    projectDescription?: string;
    scopeOfWork?: string;
    industry?: string;
  };
}

interface ProviderSet {
  brave?: typeof queryBrave;
  tavily?: typeof queryTavily;
  exa?: typeof queryExa;
  firecrawl?: typeof queryFirecrawl;
}

type ProviderName = RoutedProviderName;
type AnalysisProfile = "high_assurance" | "balanced" | "fast";

const providerBreakers = {
  brave: new InMemoryCircuitBreaker(),
  tavily: new InMemoryCircuitBreaker(),
  exa: new InMemoryCircuitBreaker(),
  firecrawl: new InMemoryCircuitBreaker()
} as const;

function resolvedAnalysisProfile(): AnalysisProfile {
  const raw = process.env.ANALYSIS_PROFILE?.trim().toLowerCase();
  if (raw === "fast" || raw === "balanced" || raw === "high_assurance") {
    return raw;
  }
  return "high_assurance";
}

async function callWithCircuit(
  providerName: keyof typeof providerBreakers,
  run: () => Promise<ProviderDocument[]>
): Promise<{ docs: ProviderDocument[]; warning?: string }> {
  const breaker = providerBreakers[providerName];
  if (!breaker.canExecute()) {
    return {
      docs: [],
      warning: `Provider circuit open: ${providerName}`
    };
  }

  try {
    const docs = await run();
    breaker.onSuccess();
    return { docs };
  } catch (error: unknown) {
    breaker.onFailure();
    throw error;
  }
}

export interface ClientResearchV1 {
  schemaVersion: "1.0.0";
  analysisId: string;
  companyName: string;
  companyNameArabic: string | null;
  companyProfile: {
    entityType: string;
    industry: string;
    confidence: number;
    sources: string[];
  };
  financialIndicators: {
    marketingBudgetIndicator: string;
    confidence: number;
  };
  digitalPresence: {
    bilingual: boolean;
    confidence: number;
  };
  advertisingActivity: {
    confidence: number;
    estimatedMonthlySpend?: string;
  };
  positiveSignals: string[];
  redFlags: string[];
  researchMetadata: {
    sourcesUsed: number;
    englishSources: number;
    arabicSources: number;
    overallConfidence: number;
    researchDate: string;
    providerStats: Array<{
      provider: ProviderName;
      attempts: number;
      successes: number;
      failures: number;
      retries: number;
      rateLimitedCount: number;
      finalStatus: "ok" | "degraded" | "failed";
      avgLatencyMs: number;
      p95LatencyMs: number;
      healthScore: number;
      lastError: string | null;
    }>;
  };
  confidence: number;
  evidence: Array<{ claim: string; source: string; tier: 1 | 2 | 3 | 4 }>;
  warnings: string[];
}

// Schema for model-generated research queries
const ResearchQueriesSchema = z.object({
  english: z.array(z.string()).default([]),
  arabic: z.array(z.string()).default([])
});

const ENGLISH_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "into",
  "across",
  "project",
  "scope",
  "work",
  "rfp",
  "proposal",
  "company",
  "saudi",
  "arabia"
]);

function dedupeQueries(values: string[], max: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
    if (output.length >= max) {
      break;
    }
  }
  return output;
}

function extractContextKeywords(input: ResearchClientInput): string[] {
  const context = input.rfpContext;
  if (!context) {
    return [];
  }

  const text = [
    context.projectName ?? "",
    context.projectDescription ?? "",
    context.scopeOfWork ?? "",
    context.industry ?? ""
  ]
    .join(" ")
    .toLowerCase();

  const counts = new Map<string, number>();
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}\-]{2,}/gu) ?? [];
  for (const token of matches) {
    if (/^\d+$/.test(token) || ENGLISH_STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token]) => token);
}

function buildContextAwareQueries(input: ResearchClientInput): { english: string[]; arabic: string[] } {
  const base = buildBasicQueries(input);
  const keywords = extractContextKeywords(input);
  const projectName = input.rfpContext?.projectName?.trim();

  const contextEnglish = [
    projectName ? `"${input.clientName}" "${projectName}" Saudi Arabia` : "",
    ...keywords.slice(0, 4).map((keyword) => `"${input.clientName}" ${keyword} Saudi Arabia`),
    `"${input.clientName}" procurement awards brand campaign`,
    `"${input.clientName}" annual report strategy marketing`
  ].filter(Boolean);

  const arabicName = input.clientNameArabic?.trim();
  const arabicKeywords = keywords.filter((keyword) => /[\u0600-\u06FF]/.test(keyword));
  const contextArabic = arabicName
    ? [
      `"${arabicName}" استراتيجية العلامة التجارية`,
      `"${arabicName}" حملات تسويقية`,
      ...arabicKeywords.slice(0, 3).map((keyword) => `"${arabicName}" ${keyword}`)
    ]
    : [];

  return {
    english: dedupeQueries([...contextEnglish, ...base.english], 8),
    arabic: dedupeQueries([...contextArabic, ...base.arabic], 5)
  };
}

function stripMarkdownCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function cleanJsonOutput(raw: string): string {
  const withoutFences = stripMarkdownCodeFences(raw).replace(/\u0000/g, "").trim();
  const firstOpen = withoutFences.indexOf("{");
  const lastClose = withoutFences.lastIndexOf("}");
  if (firstOpen >= 0 && lastClose > firstOpen) {
    return withoutFences.slice(firstOpen, lastClose + 1).trim();
  }
  return withoutFences;
}

function extractFirstJsonObject(raw: string): string | null {
  const sanitized = cleanJsonOutput(raw);
  const start = sanitized.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < sanitized.length; index += 1) {
    const char = sanitized[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return sanitized.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseJsonObjectLoose(raw: string): Record<string, unknown> | null {
  const jsonText = extractFirstJsonObject(raw);
  if (!jsonText) {
    return null;
  }

  const attempts = [
    jsonText,
    jsonText.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'"),
    jsonText.replace(/,\s*([}\]])/g, "$1"),
    jsonText
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Continue to next repair strategy.
    }
  }

  return null;
}

function extractQueryArrayByKey(raw: string, key: "english" | "arabic"): string[] {
  const sanitized = stripMarkdownCodeFences(raw);
  const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, "i");
  const match = sanitized.match(keyRegex);
  if (!match || !match[1]) {
    return [];
  }

  const block = match[1];
  const quoted = block.match(/"((?:\\.|[^"\\])+)"/g) ?? [];
  return dedupeQueries(
    quoted
      .map((value) =>
        value
          .slice(1, -1)
          .replace(/\\"/g, "\"")
          .replace(/\\n/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((value) => value.length >= 6),
    key === "english" ? 8 : 5
  );
}

function extractQuotedQueriesFallback(raw: string): { english: string[]; arabic: string[] } {
  const quotedMatches = raw.match(/"([^"\n]{6,140})"/g) ?? [];
  const cleaned = quotedMatches
    .map((value) => value.replace(/^"|"$|\\+"/g, "").replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 6);

  const english: string[] = [];
  const arabic: string[] = [];
  for (const query of cleaned) {
    if (/[\u0600-\u06FF]/.test(query)) {
      arabic.push(query);
    } else {
      english.push(query);
    }
  }

  return {
    english: dedupeQueries(english, 8),
    arabic: dedupeQueries(arabic, 5)
  };
}

function isReadableContext(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 120) {
    return false;
  }

  const readableChars = (normalized.match(/[\p{L}\p{N}\s.,;:!?'"()\-[\]{}\/%@&+]/gu) ?? []).length;
  const readableRatio = readableChars / Math.max(normalized.length, 1);
  const tokens = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}\-]{2,}/gu) ?? [];
  const uniqueRatio = tokens.length > 0
    ? new Set(tokens.map((token) => token.toLowerCase())).size / tokens.length
    : 0;

  return readableRatio >= 0.62 && (tokens.length < 120 || uniqueRatio >= 0.1);
}

function parseSmartQueriesFromText(raw: string): { english: string[]; arabic: string[] } | null {
  const parsed = parseJsonObjectLoose(raw);
  if (parsed) {
    const validated = ResearchQueriesSchema.safeParse(parsed);
    if (validated.success) {
      return {
        english: dedupeQueries(validated.data.english, 8),
        arabic: dedupeQueries(validated.data.arabic, 5)
      };
    }
  }

  const englishFromArray = extractQueryArrayByKey(raw, "english");
  const arabicFromArray = extractQueryArrayByKey(raw, "arabic");
  if (englishFromArray.length + arabicFromArray.length >= 2) {
    return {
      english: englishFromArray,
      arabic: arabicFromArray
    };
  }

  const quotedFallback = extractQuotedQueriesFallback(raw);
  if (quotedFallback.english.length + quotedFallback.arabic.length >= 3) {
    return quotedFallback;
  }

  return null;
}

function mergeSmartQueries(
  generated: { english: string[]; arabic: string[] },
  baseline: { english: string[]; arabic: string[] }
): { english: string[]; arabic: string[] } {
  return {
    english: dedupeQueries([...generated.english, ...baseline.english], 8),
    arabic: dedupeQueries([...generated.arabic, ...baseline.arabic], 5)
  };
}


/**
 * Generate semantically relevant search queries based on RFP context using Gemini.
 * Uses generateObject with retry logic, abort signals, and hard timeouts for reliable structured output.
 */
async function generateSmartQueries(input: ResearchClientInput): Promise<{ english: string[]; arabic: string[] }> {
  const baselineQueries = buildContextAwareQueries(input);
  const apiKey = resolveGoogleApiKey();
  const modelDiagnostics = getGeminiModelResolutionDiagnostics();

  // Fall back to basic queries if no API key or no context
  if (!apiKey || !input.rfpContext) {
    return baselineQueries;
  }

  const googleProvider = createGoogleGenerativeAI({ apiKey });
  const context = input.rfpContext;
  const contextSignal = `${context.projectName ?? ""} ${context.projectDescription ?? ""}`.replace(/\s+/g, " ").trim();
  if (contextSignal.length < 80) {
    console.warn("[Research] Context too sparse for smart query generation; using deterministic queries");
    return baselineQueries;
  }
  const contextSummary = [
    context.projectName && `Project: ${context.projectName}`,
    context.projectDescription && `Description: ${context.projectDescription.slice(0, 700)}`,
    context.scopeOfWork && `Scope: ${context.scopeOfWork.slice(0, 700)}`,
    context.industry && `Industry: ${context.industry}`
  ].filter(Boolean).join("\n");
  if (!isReadableContext(contextSummary)) {
    console.warn("[Research] Context quality too low for smart query generation; using deterministic queries");
    return baselineQueries;
  }
  console.log(
    `[Research] Smart-query model candidates: ${modelDiagnostics.candidates.join(", ")} (resolved=${modelDiagnostics.resolvedModel})`
  );

  const prompt = `Generate search queries to research "${input.clientName}" in Saudi Arabia.
${input.clientNameArabic ? `Arabic name: ${input.clientNameArabic}` : ""}
${contextSummary}

Create queries to find: organization type, size, marketing activity, digital presence, recent news.
Put exact name in quotes for precise matching.

Return ONLY valid JSON with "english" and "arabic" arrays of query strings. No explanations.
JSON shape:
{"english":["..."],"arabic":["..."]}`;

  // Use text-mode with strict JSON instruction; this is more reliable than strict schema mode for query generation.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 32_000);

      const result = await withHardTimeout(
        runWithGeminiFlashModel((model) =>
          generateText({
            model: googleProvider(model),
            temperature: 0,
            maxOutputTokens: 3200,
            abortSignal: abortController.signal,
            prompt: `${prompt}

STRICT OUTPUT RULES:
- Return one JSON object only, no markdown.
- english must contain 4-8 queries.
- arabic must contain 2-5 queries.
- Do not include commentary.`
          })
        ),
        35_000,
        "Smart query generation timed out"
      );

      clearTimeout(timeoutId);
      const raw = result.text ?? "";
      if (!raw.trim()) {
        console.warn("[Research] Smart query model returned empty text output");
        throw new Error("No output generated.");
      }
      const parsed = parseSmartQueriesFromText(raw);
      if (parsed && (parsed.english.length >= 1 || parsed.arabic.length >= 1)) {
        console.log(`[Research] Smart queries generated: ${parsed.english.length} EN, ${parsed.arabic.length} AR`);
        return mergeSmartQueries(parsed, baselineQueries);
      }
      console.warn(`[Research] Smart query raw output (truncated): ${(raw || "<empty>").slice(0, 260)}`);
      throw new Error("Smart query JSON parse failed.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Research] Smart query attempt ${attempt + 1} failed: ${msg.slice(0, 100)}`);
      if (/no output generated/i.test(msg)) {
        console.warn("[Research] Skipping repeated smart-query retries after empty model output");
        break;
      }
      if (attempt < 2) {
        const backoffMs = Math.min(2000, 400 * (attempt + 1));
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }

  console.warn("[Research] All smart query attempts failed, using context-aware deterministic queries");
  return baselineQueries;
}

/**
 * Basic fallback queries when Claude generation isn't available
 */
function buildBasicQueries(input: ResearchClientInput): { english: string[]; arabic: string[] } {
  const english = [
    `"${input.clientName}" company organization about`,
    `"${input.clientName}" size employees headquarters`,
    `"${input.clientName}" marketing advertising campaigns`,
    `"${input.clientName}" news 2024 2025`
  ];

  const nameArabic = input.clientNameArabic?.trim() || input.clientName;
  const arabic = [
    `"${nameArabic}" نبذة عن المؤسسة`,
    `"${nameArabic}" أخبار 2024 2025`
  ];

  return { english, arabic };
}

export function buildBilingualQueries(input: ResearchClientInput): { english: string[]; arabic: string[] } {
  return buildBasicQueries(input);
}

function mappedClaims(docs: ProviderDocument[]) {
  return docs.map((doc) => ({
    key: doc.key,
    value: doc.value,
    source: doc.source,
    tier: doc.tier,
    sourceDate: doc.sourceDate,
    category: doc.category
  }));
}

interface ProviderRuntimeStats {
  attempts: number;
  successes: number;
  failures: number;
  retries: number;
  rateLimitedCount: number;
  latenciesMs: number[];
  lastError: string | null;
}

function createProviderRuntimeStats(): Record<ProviderName, ProviderRuntimeStats> {
  return {
    brave: {
      attempts: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      rateLimitedCount: 0,
      latenciesMs: [],
      lastError: null
    },
    tavily: {
      attempts: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      rateLimitedCount: 0,
      latenciesMs: [],
      lastError: null
    },
    exa: {
      attempts: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      rateLimitedCount: 0,
      latenciesMs: [],
      lastError: null
    },
    firecrawl: {
      attempts: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      rateLimitedCount: 0,
      latenciesMs: [],
      lastError: null
    }
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function p95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index] ?? 0;
}

function dedupeProviderDocs(docs: ProviderDocument[]): ProviderDocument[] {
  const seen = new Set<string>();
  const output: ProviderDocument[] = [];

  for (const doc of docs) {
    const key = `${doc.source}|${doc.key}|${doc.value}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(doc);
  }

  return output;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function inferStatusCode(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error && typeof (error as { status: unknown }).status === "number") {
    return (error as { status: number }).status;
  }

  const message = errorMessage(error);
  const match = message.match(/\b(\d{3})\b/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRateLimited(error: unknown): boolean {
  const statusCode = inferStatusCode(error);
  if (statusCode === 429) {
    return true;
  }
  return /rate limit|rate-limited|429/i.test(errorMessage(error));
}

function inferRetries(error: unknown): number {
  const message = errorMessage(error);
  if (/after retries/i.test(message)) {
    return 2;
  }
  const afterAttemptsMatch = message.match(/after\s+(\d+)\s+attempts?/i);
  if (afterAttemptsMatch?.[1]) {
    const attempts = Number(afterAttemptsMatch[1]);
    if (Number.isFinite(attempts) && attempts > 1) {
      return attempts - 1;
    }
  }
  const match = message.match(/attempt\s+(\d+)\/(\d+)/i);
  if (!match || !match[2]) {
    return 0;
  }

  const total = Number(match[2]);
  return Number.isFinite(total) && total > 0 ? total - 1 : 0;
}

export async function researchClientInput(
  input: ResearchClientInput,
  providers?: ProviderSet
): Promise<ClientResearchV1> {
  if (!input.analysisId || !input.clientName) {
    throw makeError(400, "validation_error", "analysisId and clientName are required", "research-client", {
      retryable: false
    });
  }

  const p = {
    brave: providers?.brave ?? queryBrave,
    tavily: providers?.tavily ?? queryTavily,
    exa: providers?.exa ?? queryExa,
    firecrawl: providers?.firecrawl ?? queryFirecrawl
  };

  // Generate semantically relevant queries based on RFP context
  const { english, arabic } = await generateSmartQueries(input);
  const warnings: string[] = [];

  const runtimeStats = createProviderRuntimeStats();
  const analysisProfile = resolvedAnalysisProfile();
  const highAssurance = analysisProfile === "high_assurance";
  const docs: ProviderDocument[] = [];

  const retrievalFunctions: Record<"tavily" | "exa" | "brave", (query: string) => Promise<ProviderDocument[]>> = {
    tavily: p.tavily,
    exa: p.exa,
    brave: p.brave
  };

  const retrievalOrder = rankProviders(["tavily", "exa", "brave"]).filter(
    (provider): provider is "tavily" | "exa" | "brave" => provider !== "firecrawl"
  );
  const allQueries = [...english, ...arabic];

  async function runQueryWithFailover(query: string): Promise<ProviderDocument[]> {
    const queryWarnings: string[] = [];
    const providerDocs: ProviderDocument[] = [];
    let successfulProviders = 0;

    for (const provider of retrievalOrder) {
      const startedAt = Date.now();
      runtimeStats[provider].attempts += 1;

      try {
        const result = await callWithCircuit(provider, () => retrievalFunctions[provider](query));
        const latency = Date.now() - startedAt;
        runtimeStats[provider].successes += 1;
        runtimeStats[provider].latenciesMs.push(latency);
        recordProviderOutcome(provider, {
          ok: true,
          latencyMs: latency,
          rateLimited: false
        });

        if (result.warning) {
          queryWarnings.push(result.warning);
        }

        if (result.docs.length > 0) {
          providerDocs.push(...result.docs);
          successfulProviders += 1;
          if (!highAssurance || successfulProviders >= 2) {
            warnings.push(...queryWarnings);
            return dedupeProviderDocs(providerDocs);
          }
        }
      } catch (error: unknown) {
        const latency = Date.now() - startedAt;
        const statusCode = inferStatusCode(error);
        const rateLimited = isRateLimited(error);
        const message = errorMessage(error);
        runtimeStats[provider].failures += 1;
        runtimeStats[provider].latenciesMs.push(latency);
        runtimeStats[provider].lastError = message;
        runtimeStats[provider].retries += inferRetries(error);
        if (rateLimited) {
          runtimeStats[provider].rateLimitedCount += 1;
        }
        if (/provider_config_missing/i.test(message)) {
          warnings.push(`[provider_config_missing] ${provider} is not configured for this run.`);
        }

        recordProviderOutcome(provider, {
          ok: false,
          latencyMs: latency,
          statusCode: statusCode ?? undefined,
          rateLimited
        });
      }
    }

    if (providerDocs.length > 0) {
      if (highAssurance) {
        warnings.push(`High-assurance retrieval used limited provider diversity for query: ${query.slice(0, 80)}`);
      }
      warnings.push(...queryWarnings);
      return dedupeProviderDocs(providerDocs);
    }

    warnings.push(`All retrieval providers failed for query: ${query.slice(0, 80)}`);
    return [];
  }

  const retrievalDocs = await Promise.all(allQueries.map((query) => runQueryWithFailover(query)));
  for (const result of retrievalDocs) {
    docs.push(...result);
  }
  const dedupedRetrievalDocs = dedupeProviderDocs(docs);
  docs.length = 0;
  docs.push(...dedupedRetrievalDocs);

  // Website crawl attempt (try common domain patterns) using firecrawl only.
  const cleanName = input.clientName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const crawlUrls = [`https://www.${cleanName}.com`, `https://${cleanName}.sa`];
  for (const url of crawlUrls) {
    const startedAt = Date.now();
    runtimeStats.firecrawl.attempts += 1;
    try {
      const result = await callWithCircuit("firecrawl", () => p.firecrawl(url));
      const latency = Date.now() - startedAt;
      runtimeStats.firecrawl.successes += 1;
      runtimeStats.firecrawl.latenciesMs.push(latency);
      recordProviderOutcome("firecrawl", {
        ok: true,
        latencyMs: latency,
        rateLimited: false
      });
      docs.push(...result.docs);
      if (result.warning) {
        warnings.push(result.warning);
      }
    } catch (error: unknown) {
      const latency = Date.now() - startedAt;
      const statusCode = inferStatusCode(error);
      const rateLimited = isRateLimited(error);
      runtimeStats.firecrawl.failures += 1;
      runtimeStats.firecrawl.latenciesMs.push(latency);
      runtimeStats.firecrawl.lastError = errorMessage(error);
      if (rateLimited) {
        runtimeStats.firecrawl.rateLimitedCount += 1;
      }

      recordProviderOutcome("firecrawl", {
        ok: false,
        latencyMs: latency,
        statusCode: statusCode ?? undefined,
        rateLimited
      });
    }
  }

  if (runtimeStats.brave.failures > 0 && runtimeStats.brave.successes === 0) {
    warnings.push("Brave search unavailable or rate-limited; continued with Tavily/Exa.");
  }
  if (runtimeStats.tavily.failures > 0 && runtimeStats.tavily.successes === 0) {
    warnings.push("Tavily unavailable for this run; continued with Exa/Brave.");
  }
  if (runtimeStats.exa.failures > 0 && runtimeStats.exa.successes === 0) {
    warnings.push("Exa unavailable for this run; continued with Tavily/Brave.");
  }
  if (runtimeStats.firecrawl.failures > 0 && runtimeStats.firecrawl.successes === 0) {
    warnings.push("Website crawl source unavailable for this run; official-site evidence may be limited.");
  }

  if (docs.length === 0) {
    throw makeError(503, "upstream_unavailable", "All research providers failed", "research-client", {
      retryable: true
    });
  }

  const resolved = resolveClaims(mappedClaims(docs));

  const confidenceValues = resolved.map((claim) => {
    const freshnessCap = confidenceCapForFreshness(claim.key === "officialSignal" ? "official" : "news", claim.sourceDate);
    const tierBase = claim.tier === 1 ? 0.95 : claim.tier === 2 ? 0.85 : claim.tier === 3 ? 0.7 : 0.5;
    return Math.min(freshnessCap, tierBase);
  });

  const overallConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0.6;

  const englishSources = docs.filter((doc) => /[A-Za-z]/.test(doc.value)).length;
  const arabicSources = docs.filter((doc) => /[\u0600-\u06FF]/.test(doc.value)).length;
  const providerStatsPayload = (Object.keys(runtimeStats) as ProviderName[]).map((provider) => {
    const stats = runtimeStats[provider];
    const health = getProviderHealthScore(provider);
    const finalStatus: "ok" | "degraded" | "failed" =
      stats.successes > 0 ? (stats.failures > 0 ? "degraded" : "ok") : "failed";

    return {
      provider,
      attempts: stats.attempts,
      successes: stats.successes,
      failures: stats.failures,
      retries: stats.retries,
      rateLimitedCount: stats.rateLimitedCount,
      finalStatus,
      avgLatencyMs: average(stats.latenciesMs),
      p95LatencyMs: p95(stats.latenciesMs),
      healthScore: Math.round(health.healthScore * 100) / 100,
      lastError: stats.lastError
    };
  });

  const uniqueSources = Array.from(new Set(docs.map((doc) => doc.source)));
  const healthyProviders = providerStatsPayload.filter((provider) => provider.finalStatus !== "failed");
  if (healthyProviders.length < 2) {
    warnings.push("Research quality degraded: fewer than two providers returned usable evidence.");
  }
  if (uniqueSources.length < 3) {
    warnings.push("Research evidence density is low; validate findings before acting.");
  }

  const output: ClientResearchV1 = {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    companyName: input.clientName,
    companyNameArabic: input.clientNameArabic ?? null,
    companyProfile: {
      entityType: resolved.some((claim) => claim.key === "officialSignal") ? "public_company" : "unknown",
      industry: "unknown",
      confidence: Math.max(0.6, overallConfidence),
      sources: Array.from(new Set(resolved.map((claim) => claim.source))).slice(0, 6)
    },
    financialIndicators: {
      marketingBudgetIndicator: resolved.some((claim) => /campaign|ads?|spend/i.test(claim.value)) ? "MEDIUM_OR_HIGH" : "UNKNOWN",
      confidence: Math.max(0.55, overallConfidence)
    },
    digitalPresence: {
      bilingual: arabicSources > 0 && englishSources > 0,
      confidence: Math.max(0.55, overallConfidence)
    },
    advertisingActivity: {
      confidence: Math.max(0.5, overallConfidence),
      estimatedMonthlySpend: resolved.some((claim) => /high|enterprise|major/i.test(claim.value)) ? "HIGH" : undefined
    },
    positiveSignals: [
      "Bilingual query coverage executed",
      "Trust-tier conflict resolution applied"
    ],
    redFlags: warnings.length > 2 ? ["High provider volatility"] : [],
    researchMetadata: {
      sourcesUsed: uniqueSources.length,
      englishSources,
      arabicSources,
      overallConfidence,
      researchDate: new Date().toISOString().slice(0, 10),
      providerStats: providerStatsPayload
    },
    confidence: overallConfidence,
    evidence: resolved.map((claim) => ({
      claim: `${claim.key}: ${claim.value}`,
      source: claim.source,
      tier: claim.tier
    })),
    warnings
  };

  return output;
}
