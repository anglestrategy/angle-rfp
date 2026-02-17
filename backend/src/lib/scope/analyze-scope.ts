import { makeError } from "@/lib/api/errors";
import { resolveMarketResearchSupport } from "@/lib/scope/capability-profile";
import {
  isMarketResearchScopeItem,
  matchScopeItems,
  splitScopeItems,
  taxonomySupportsMarketResearch
} from "@/lib/scope/matcher";
import { matchScopeWithClaude } from "@/lib/scope/claude-matcher";
import { classifyOutputTypes, parseOutputQuantities } from "@/lib/scope/quantity-parser";
import { loadAgencyTaxonomy, taxonomyVersionFromServices } from "@/lib/scope/taxonomy-loader";

export interface AnalyzeScopeInput {
  analysisId: string;
  scopeOfWork: string;
  language: "arabic" | "english" | "mixed";
}

export interface ScopeAnalysisV1 {
  schemaVersion: "1.0.0";
  analysisId: string;
  taxonomyVersion: string;
  scopeItems: string[];
  unclassifiedItems: string[];
  uncertainItems: string[];
  matches: Array<{
    scopeItem: string;
    service: string;
    class: "full" | "partial" | "none" | "uncertain";
    confidence: number;
    classificationSource: "semantic" | "token" | "rule";
    reasoning?: string;
  }>;
  agencyServicePercentage: number;
  outsourcingPercentage: number;
  outputQuantities: {
    videoProduction: number | null;
    motionGraphics: number | null;
    visualDesign: number | null;
    contentOnly: number | null;
  };
  outputTypes: Array<"videoProduction" | "motionGraphics" | "visualDesign" | "contentOnly">;
  warnings: string[];
}

function roundToOneDecimalAsRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const AGENCY_DOMAIN_HINT = /(brand|branding|campaign|marketing|communication|content|design|creative|media|narrative|strategy|launch|social|digital|production|messaging|identity|locali[sz]ation|positioning|إبداع|تسويق|هوية|استراتيجية|محتوى|تصميم)/i;

function normalizeAgencyDomainMatch(match: {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none" | "uncertain";
  confidence: number;
  classificationSource?: "semantic" | "token" | "rule";
  reasoning?: string;
}, marketResearchSupported: boolean): {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none" | "uncertain";
  confidence: number;
  classificationSource: "semantic" | "token" | "rule";
  reasoning?: string;
} {
  const defaultReasoning =
    match.class === "none"
      ? "No direct agency-service capability match detected."
      : match.class === "uncertain"
        ? "Insufficient confidence for definitive scope classification."
        : undefined;

  if (isMarketResearchScopeItem(match.scopeItem) && !marketResearchSupported) {
    return {
      ...match,
      service: match.service === "No direct match" ? "Market-research capability requires confirmation" : match.service,
      class: "uncertain",
      confidence: Math.min(Math.max(match.confidence, 0.35), 0.6),
      classificationSource: "rule",
      reasoning: "Market-research capability is profile-limited; manual confirmation required."
    };
  }

  if (isMarketResearchScopeItem(match.scopeItem) && marketResearchSupported) {
    if (match.class === "none" || match.class === "uncertain") {
      return {
        ...match,
        service: "Market research & insights",
        class: "full",
        confidence: Math.max(match.confidence, 0.7),
        classificationSource: "rule",
        reasoning: "Capability profile explicitly supports market-research and benchmarking scope."
      };
    }

    return {
      ...match,
      classificationSource: match.classificationSource ?? "semantic",
      reasoning: match.reasoning || "Capability profile confirms this strategy-research scope is in-agency."
    };
  }

  if (match.class !== "none") {
    return {
      ...match,
      classificationSource: match.classificationSource ?? "semantic",
      reasoning: match.reasoning || defaultReasoning
    };
  }

  if (!AGENCY_DOMAIN_HINT.test(match.scopeItem)) {
    return {
      ...match,
      classificationSource: match.classificationSource ?? "semantic",
      reasoning: match.reasoning || defaultReasoning
    };
  }

  if (match.confidence >= 0.45) {
    return {
      ...match,
      service: match.service === "No direct match" ? "Broad agency capability" : match.service,
      class: "partial",
      confidence: Math.max(match.confidence, 0.5),
      classificationSource: "rule",
      reasoning: match.reasoning || "Agency-domain signal detected with moderate confidence."
    };
  }

  return {
    ...match,
    service: match.service === "No direct match" ? "Broad agency capability" : match.service,
    class: "uncertain",
    confidence: Math.max(Math.min(match.confidence, 0.6), 0.35),
    classificationSource: "rule",
    reasoning: match.reasoning || "Agency-domain signal detected but confidence remains low."
  };
}

export async function analyzeScopeInput(input: AnalyzeScopeInput): Promise<ScopeAnalysisV1> {
  if (!input.analysisId || !input.scopeOfWork.trim()) {
    throw makeError(400, "validation_error", "analysisId and scopeOfWork are required", "analyze-scope", {
      retryable: false
    });
  }

  const taxonomy = await loadAgencyTaxonomy();
  if (taxonomy.length < 50) {
    throw makeError(500, "internal_error", "Agency taxonomy is unexpectedly small", "analyze-scope", {
      retryable: true,
      details: { loaded: taxonomy.length }
    });
  }

  const warnings: string[] = [];
  let scopeItems = splitScopeItems(input.scopeOfWork);
  if (scopeItems.length === 0) {
    const salvage = input.scopeOfWork
      .split(/\r?\n|[؛;•]/u)
      .map((line) => line.replace(/^[-*•\d.)\s]+/u, "").trim())
      .filter((line) => line.length >= 10)
      .slice(0, 24);
    if (salvage.length > 0) {
      scopeItems = salvage;
      warnings.push("Scope segmentation fallback was used due sparse scope formatting.");
    }
  }

  // Try Claude-based semantic matching in batches; fall back to token matching per-batch
  let matches: Array<{
    scopeItem: string;
    service: string;
    class: "full" | "partial" | "none" | "uncertain";
    confidence: number;
    classificationSource: "semantic" | "token" | "rule";
    reasoning?: string;
  }> = [];

  const batchSize = Math.max(4, Math.min(8, Number(process.env.SCOPE_MATCH_BATCH_SIZE ?? 6)));
  const batches = chunkArray(scopeItems, batchSize);
  const marketResearchPolicy = resolveMarketResearchSupport(taxonomySupportsMarketResearch(taxonomy));
  const marketResearchSupported = marketResearchPolicy.supported;
  let fallbackBatchCount = 0;
  const batchResults: Array<typeof matches> = new Array(batches.length).fill(null).map(() => []);
  const concurrency = Math.max(1, Math.min(3, Number(process.env.SCOPE_MATCH_CONCURRENCY ?? 2)));
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < batches.length) {
      const batchIndex = cursor;
      cursor += 1;
      const batch = batches[batchIndex];
      if (!batch || batch.length === 0) {
        continue;
      }

      try {
        const claudeMatches = await matchScopeWithClaude(batch, taxonomy);
        batchResults[batchIndex] = claudeMatches.map((match) =>
          normalizeAgencyDomainMatch(
            {
              ...match,
              classificationSource: "semantic"
            },
            marketResearchSupported
          )
        );
      } catch (error) {
        console.error(`AI scope matching failed for batch ${batchIndex + 1}/${batches.length}, using token fallback:`, error);
        fallbackBatchCount += 1;
        batchResults[batchIndex] = matchScopeItems(batch, taxonomy).map((match) => ({
          ...match,
          classificationSource: match.classificationSource ?? "token"
        }));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  matches = batchResults.flat();

  if (fallbackBatchCount > 0 && fallbackBatchCount === batches.length) {
    warnings.push("Scope matching used deterministic fallback for this document.");
  }

  if (marketResearchPolicy.source === "env_override" && !marketResearchSupported) {
    warnings.push("Market research capability is disabled by profile policy (AGENCY_SUPPORTS_MARKET_RESEARCH=false).");
  } else if (marketResearchPolicy.source === "profile") {
    warnings.push(`Capability profile in use: ${marketResearchPolicy.profile}.`);
  }

  const fullCount = matches.filter((item) => item.class === "full").length;
  const partialCount = matches.filter((item) => item.class === "partial").length;
  const uncertainCount = matches.filter((item) => item.class === "uncertain").length;
  const confidentCount = matches.filter((item) => item.class !== "uncertain").length;

  const agencyServicePercentage = confidentCount > 0
    ? roundToOneDecimalAsRatio((fullCount + 0.5 * partialCount) / confidentCount)
    : 0;
  const outsourcingPercentage = confidentCount > 0
    ? roundToOneDecimalAsRatio(1 - agencyServicePercentage)
    : 0;

  const outputQuantities = parseOutputQuantities(input.scopeOfWork);
  const outputTypes = classifyOutputTypes(outputQuantities, input.scopeOfWork);

  if (scopeItems.length === 0) {
    warnings.push("No granular scope items could be segmented from scope text.");
  }

  const noneCount = matches.filter((item) => item.class === "none").length;
  const noneRatio = confidentCount > 0 ? noneCount / confidentCount : 0;
  if (noneCount >= 6 && noneRatio >= 0.65) {
    warnings.push("One or more scope items have no direct agency-service match.");
  }
  if (uncertainCount > 0) {
    warnings.push("One or more scope items were classified as uncertain and excluded from percentage computation.");
  }
  if (confidentCount === 0 && matches.length > 0) {
    warnings.push("Scope confidence was too low for percentage scoring; agency/outsourcing percentages were withheld.");
  }

  const unclassifiedItems = matches
    .filter((item) => item.class === "uncertain")
    .map((item) => item.scopeItem);

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    taxonomyVersion: taxonomyVersionFromServices(taxonomy),
    scopeItems,
    unclassifiedItems,
    uncertainItems: unclassifiedItems,
    matches,
    agencyServicePercentage,
    outsourcingPercentage,
    outputQuantities,
    outputTypes,
    warnings
  };
}
