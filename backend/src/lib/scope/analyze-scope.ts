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
  if (isMarketResearchScopeItem(match.scopeItem) && !marketResearchSupported) {
    return {
      ...match,
      service: "No direct match",
      class: "none",
      confidence: Math.min(match.confidence, 0.35),
      classificationSource: "rule",
      reasoning: "Market research capability is outside configured agency scope."
    };
  }

  if (match.class !== "none") {
    return {
      ...match,
      classificationSource: match.classificationSource ?? "semantic"
    };
  }

  if (!AGENCY_DOMAIN_HINT.test(match.scopeItem)) {
    return {
      ...match,
      classificationSource: match.classificationSource ?? "semantic"
    };
  }

  return {
    ...match,
    service: match.service === "No direct match" ? "Broad agency capability" : match.service,
    class: "uncertain",
    confidence: Math.max(Math.min(match.confidence, 0.6), 0.4),
    classificationSource: "rule",
    reasoning: match.reasoning || "Agency-domain signal detected."
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

  const scopeItems = splitScopeItems(input.scopeOfWork);

  // Try Claude-based semantic matching in batches; fall back to token matching per-batch
  const warnings: string[] = [];
  let matches: Array<{
    scopeItem: string;
    service: string;
    class: "full" | "partial" | "none" | "uncertain";
    confidence: number;
    classificationSource: "semantic" | "token" | "rule";
    reasoning?: string;
  }> = [];

  const batches = chunkArray(scopeItems, 14);
  const marketResearchPolicy = resolveMarketResearchSupport(taxonomySupportsMarketResearch(taxonomy));
  const marketResearchSupported = marketResearchPolicy.supported;
  let fallbackBatchCount = 0;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    if (batch.length === 0) {
      continue;
    }

    try {
      const claudeMatches = await matchScopeWithClaude(batch, taxonomy);
      matches.push(
        ...claudeMatches.map((match) =>
          normalizeAgencyDomainMatch(
            {
              ...match,
              classificationSource: "semantic"
            },
            marketResearchSupported
          )
        )
      );
    } catch (error) {
      console.error(`Claude scope matching failed for batch ${i + 1}/${batches.length}, using token fallback:`, error);
      fallbackBatchCount += 1;
      matches.push(...matchScopeItems(batch, taxonomy).map((match) => ({ ...match, classificationSource: match.classificationSource ?? "token" })));
    }
  }

  if (fallbackBatchCount > 0 && fallbackBatchCount === batches.length) {
    warnings.push("Scope matching used deterministic fallback for this document.");
  }

  if (marketResearchPolicy.source === "env_override" && !marketResearchSupported) {
    warnings.push("Market research capability is disabled by profile policy (AGENCY_SUPPORTS_MARKET_RESEARCH=false).");
  }

  const fullCount = matches.filter((item) => item.class === "full").length;
  const partialCount = matches.filter((item) => item.class === "partial").length;
  const uncertainCount = matches.filter((item) => item.class === "uncertain").length;
  const classifiedTotal = Math.max(matches.filter((item) => item.class !== "uncertain").length, 1);

  const agencyServicePercentage = roundToOneDecimalAsRatio((fullCount + 0.5 * partialCount) / classifiedTotal);
  const outsourcingPercentage = roundToOneDecimalAsRatio(1 - agencyServicePercentage);

  const outputQuantities = parseOutputQuantities(input.scopeOfWork);
  const outputTypes = classifyOutputTypes(outputQuantities, input.scopeOfWork);

  if (scopeItems.length === 0) {
    warnings.push("No granular scope items could be segmented from scope text.");
  }

  const noneCount = matches.filter((item) => item.class === "none").length;
  const noneRatio = matches.length > 0 ? noneCount / matches.length : 0;
  if (noneCount >= 6 && noneRatio >= 0.65) {
    warnings.push("One or more scope items have no direct agency-service match.");
  }
  if (uncertainCount > 0) {
    warnings.push("One or more scope items were classified as uncertain and excluded from percentage computation.");
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
    matches,
    agencyServicePercentage,
    outsourcingPercentage,
    outputQuantities,
    outputTypes,
    warnings
  };
}
