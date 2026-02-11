import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { makeError } from "@/lib/api/errors";
import { InMemoryCircuitBreaker } from "@/lib/ops/circuit-breaker";
import { confidenceCapForFreshness } from "@/lib/research/freshness";
import { queryBrave, type ProviderDocument } from "@/lib/research/providers/brave";
import { queryFirecrawl } from "@/lib/research/providers/firecrawl";
import { queryTavily } from "@/lib/research/providers/tavily";
import { resolveClaims } from "@/lib/research/trust-resolver";

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
  firecrawl?: typeof queryFirecrawl;
}

const providerBreakers = {
  brave: new InMemoryCircuitBreaker(),
  tavily: new InMemoryCircuitBreaker(),
  firecrawl: new InMemoryCircuitBreaker()
} as const;

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
  };
  confidence: number;
  evidence: Array<{ claim: string; source: string; tier: 1 | 2 | 3 | 4 }>;
  warnings: string[];
}

// Schema for Claude-generated research queries
const ResearchQueriesSchema = z.object({
  english: z.array(z.string()).min(4).max(8),
  arabic: z.array(z.string()).min(2).max(6)
});

/**
 * Generate semantically relevant search queries based on RFP context using Claude.
 * This produces better research results than static templates.
 */
async function generateSmartQueries(input: ResearchClientInput): Promise<{ english: string[]; arabic: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Fall back to basic queries if no API key or no context
  if (!apiKey || !input.rfpContext) {
    return buildBasicQueries(input);
  }

  const client = new Anthropic({ apiKey, timeout: 60000 });  // 1 minute for query generation

  const context = input.rfpContext;
  const contextSummary = [
    context.projectName && `Project: ${context.projectName}`,
    context.projectDescription && `Description: ${context.projectDescription.slice(0, 500)}`,
    context.scopeOfWork && `Scope: ${context.scopeOfWork.slice(0, 500)}`,
    context.industry && `Industry: ${context.industry}`
  ].filter(Boolean).join("\n");

  const prompt = `You are a research analyst. Generate search queries to research a company/organization for a business proposal.

CLIENT: ${input.clientName}
${input.clientNameArabic ? `CLIENT (Arabic): ${input.clientNameArabic}` : ""}
COUNTRY: Saudi Arabia

RFP CONTEXT:
${contextSummary || "No additional context provided."}

Generate search queries that will help us understand:
1. What type of organization this is (company, government entity, event, etc.)
2. Their size, scale, and significance
3. Their marketing/advertising activity and budget indicators
4. Their digital presence and social media
5. Recent news and developments

IMPORTANT:
- Use the EXACT client name in quotes for precise matching
- Include context-specific terms from the RFP (e.g., if it mentions "World Expo", include that)
- Generate queries that would reveal the organization's importance and scale
- Arabic queries should use the Arabic name if provided

Return JSON only:
{
  "english": ["query1", "query2", ...],  // 4-8 queries
  "arabic": ["query1", "query2", ...]    // 2-6 queries
}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-latest",  // Fast model for query generation
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    });

    const textContent = response.content.find(block => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return buildBasicQueries(input);
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```")) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match?.[1]) {
        jsonText = match[1];
      }
    }

    const parsed = JSON.parse(jsonText);
    const validated = ResearchQueriesSchema.parse(parsed);
    return validated;
  } catch (error) {
    console.error("Smart query generation failed, using basic queries:", error);
    return buildBasicQueries(input);
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
    firecrawl: providers?.firecrawl ?? queryFirecrawl
  };

  // Generate semantically relevant queries based on RFP context
  const { english, arabic } = await generateSmartQueries(input);
  const warnings: string[] = [];

  // Build research calls dynamically based on generated queries
  // Alternate between Brave (web search) and Tavily (deep research) for coverage
  const researchCalls: Promise<{ docs: ProviderDocument[]; warning?: string }>[] = [];

  // English queries - distribute across providers
  english.forEach((query, index) => {
    const provider = index % 2 === 0 ? "brave" : "tavily";
    const fn = provider === "brave" ? p.brave : p.tavily;
    researchCalls.push(callWithCircuit(provider, () => fn(query)));
  });

  // Arabic queries - distribute across providers
  arabic.forEach((query, index) => {
    const provider = index % 2 === 0 ? "brave" : "tavily";
    const fn = provider === "brave" ? p.brave : p.tavily;
    researchCalls.push(callWithCircuit(provider, () => fn(query)));
  });

  // Website crawl attempt (try common domain patterns)
  const cleanName = input.clientName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  researchCalls.push(
    callWithCircuit("firecrawl", () => p.firecrawl(`https://www.${cleanName}.com`)),
    callWithCircuit("firecrawl", () => p.firecrawl(`https://${cleanName}.sa`))
  );

  const settled = await Promise.allSettled(researchCalls);

  const docs: ProviderDocument[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      docs.push(...result.value.docs);
      if (result.value.warning) {
        warnings.push(result.value.warning);
      }
    } else {
      warnings.push(`Provider call failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
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
      sourcesUsed: Array.from(new Set(docs.map((doc) => doc.source))).length,
      englishSources,
      arabicSources,
      overallConfidence,
      researchDate: new Date().toISOString().slice(0, 10)
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
