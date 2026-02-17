import { generateObject, generateText } from "ai";
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
import { resolveGoogleApiKey, runWithGeminiFlashModel } from "@/lib/ai/model-resolver";

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

/**
 * Extract JSON from model response, handling markdown code blocks
 */
function extractJsonFromResponse(text: string): unknown {
  // Try to extract JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return JSON.parse(codeBlockMatch[1].trim());
  }
  // Try direct JSON parse
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  // Try to find JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error("No JSON found in response");
}

/**
 * Generate semantically relevant search queries based on RFP context using Gemini.
 * Uses generateText with manual JSON parsing for better reliability.
 */
async function generateSmartQueries(input: ResearchClientInput): Promise<{ english: string[]; arabic: string[] }> {
  const apiKey = resolveGoogleApiKey();

  // Fall back to basic queries if no API key or no context
  if (!apiKey || !input.rfpContext) {
    return buildBasicQueries(input);
  }
  const googleProvider = createGoogleGenerativeAI({ apiKey });

  const context = input.rfpContext;
  const contextSummary = [
    context.projectName && `Project: ${context.projectName}`,
    context.projectDescription && `Description: ${context.projectDescription.slice(0, 500)}`,
    context.scopeOfWork && `Scope: ${context.scopeOfWork.slice(0, 500)}`,
    context.industry && `Industry: ${context.industry}`
  ].filter(Boolean).join("\n");

  const prompt = `Generate search queries to research "${input.clientName}" (Saudi Arabia) for a business proposal.

${input.clientNameArabic ? `Arabic name: ${input.clientNameArabic}` : ""}
${contextSummary ? `\nContext:\n${contextSummary}` : ""}

Return ONLY a JSON object with this exact format:
{"english":["query1","query2","query3","query4"],"arabic":["query1","query2"]}

Generate 4-6 English and 2-4 Arabic search queries to find company info, size, marketing activity, news.
Use exact name in quotes. No explanation, just JSON.`;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 30_000);

  try {
    const result = await runWithGeminiFlashModel((model) =>
      generateText({
        model: googleProvider(model),
        temperature: 0,
        maxTokens: 800,
        abortSignal: abortController.signal,
        prompt
      })
    );

    const parsed = extractJsonFromResponse(result.text);
    const validated = ResearchQueriesSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn("Smart query schema validation failed:", validated.error.message);
      return buildBasicQueries(input);
    }

    const basic = buildBasicQueries(input);
    const english = Array.from(
      new Set((validated.data.english ?? []).map((q) => q.trim()).filter(Boolean))
    ).slice(0, 8);
    const arabic = Array.from(
      new Set((validated.data.arabic ?? []).map((q) => q.trim()).filter(Boolean))
    ).slice(0, 6);

    console.log(`[Research] Smart queries generated: ${english.length} EN, ${arabic.length} AR`);

    return {
      english: english.length >= 3 ? english : basic.english,
      arabic: arabic.length >= 1 ? arabic : basic.arabic
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Smart query generation failed, using basic queries:", message);
    return buildBasicQueries(input);
  } finally {
    clearTimeout(timeoutId);
  }
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
        runtimeStats[provider].failures += 1;
        runtimeStats[provider].latenciesMs.push(latency);
        runtimeStats[provider].lastError = errorMessage(error);
        runtimeStats[provider].retries += inferRetries(error);
        if (rateLimited) {
          runtimeStats[provider].rateLimitedCount += 1;
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
