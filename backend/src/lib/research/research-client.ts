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

export function buildBilingualQueries(input: ResearchClientInput): { english: string[]; arabic: string[] } {
  const english = [
    `${input.clientName} company size revenue employees`,
    `${input.clientName} marketing budget advertising agency`,
    `${input.clientName} latest campaign Saudi Arabia`
  ];

  const nameArabic = input.clientNameArabic?.trim() || input.clientName;
  const arabic = [
    `${nameArabic} حجم الشركة الإيرادات الموظفين`,
    `${nameArabic} ميزانية التسويق وكالة إعلانات`,
    `${nameArabic} أخبار حملة السعودية`
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

  const { english, arabic } = buildBilingualQueries(input);
  const warnings: string[] = [];

  const settled = await Promise.allSettled([
    callWithCircuit("brave", () => p.brave(english[0])),
    callWithCircuit("brave", () => p.brave(arabic[0])),
    callWithCircuit("tavily", () => p.tavily(english[1])),
    callWithCircuit("tavily", () => p.tavily(arabic[1])),
    callWithCircuit("firecrawl", () => p.firecrawl(`https://www.${input.clientName.toLowerCase().replace(/\s+/g, "")}.com`))
  ]);

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
