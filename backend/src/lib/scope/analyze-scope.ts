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

function shouldUseScopeAiWrapperMode(): boolean {
  if (process.env.SCOPE_AI_WRAPPER_MODE === "1") {
    return true;
  }
  if (process.env.SCOPE_AI_WRAPPER_MODE === "0") {
    return false;
  }
  return true;
}

function isAiEndToEndModeEnabled(): boolean {
  if (process.env.RFP_AI_END_TO_END === "1") {
    return true;
  }
  if (process.env.RFP_AI_END_TO_END === "0") {
    return false;
  }
  return process.env.NODE_ENV !== "test";
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
const SCOPE_METADATA_NOISE_PATTERN =
  /(prepared by|procurement department|expo\s*2030\s*riyadh\s*company|fifa\s*world\s*cup|expo\s*dubai|page\s+\d+|table of contents|^\d+$)/i;
const SCOPE_WORK_SIGNAL_PATTERN =
  /(develop|design|create|build|launch|define|align|deliver|implement|execute|produce|manage|lead|plan|map|research|analy[sz]e|optimi[sz]e|monitor|coordinate|supervise|supervision|brand|campaign|strategy|creative|content|design|visual|communication|messaging|benchmark|insights?|positioning|locali[sz]ation|video|motion|animation|graphics?|media|production|iconography|تطوير|تصميم|تنفيذ|إطلاق|إدارة|بحث|تحليل|استراتيجية|إبداع|محتوى|حملة)/i;

function normalizeScopeKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function collectScopeNoiseFragments(scopeText: string, scopeItems: string[]): string[] {
  const known = new Set(scopeItems.map((item) => normalizeScopeKey(item)));
  const out: string[] = [];
  const seen = new Set<string>();

  const lines = scopeText
    .split(/\r?\n|[؛;•]/u)
    .map((line) => line.replace(/^[-*•\d.)\s]+/u, "").trim())
    .filter((line) => line.length >= 6);

  for (const line of lines) {
    const normalized = normalizeScopeKey(line);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    const appearsInScopeList = known.has(normalized);
    if (appearsInScopeList) {
      continue;
    }
    if (SCOPE_METADATA_NOISE_PATTERN.test(line)) {
      seen.add(normalized);
      out.push(line);
      continue;
    }
    if (/^phase\s*\d+[:\s-]*$/i.test(line) || /^program phases?/i.test(line)) {
      seen.add(normalized);
      out.push(line);
    }
  }

  return out.slice(0, 20);
}

function isLikelyNoiseScopeItem(scopeItem: string): boolean {
  const normalized = scopeItem.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }
  if (SCOPE_METADATA_NOISE_PATTERN.test(normalized)) {
    return true;
  }
  if (
    /^(?:fifa|expo)\s*\d{4}/i.test(normalized) ||
    /qatar\s*2022/i.test(normalized)
  ) {
    return true;
  }
  const mostlyUpperMetadata =
    /^[A-Z0-9\s&/\-]{6,}$/.test(normalized) &&
    !/[a-z]/.test(normalized) &&
    normalized.split(/\s+/).length <= 8;
  if (mostlyUpperMetadata) {
    return true;
  }
  if (!SCOPE_WORK_SIGNAL_PATTERN.test(normalized) && normalized.split(/\s+/).length <= 4) {
    return true;
  }
  return false;
}

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
  const scopeAiWrapperMode = shouldUseScopeAiWrapperMode();
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

  const prefilteredNoiseItems: string[] = [];
  if (!scopeAiWrapperMode && scopeItems.length > 0) {
    const kept: string[] = [];
    const noiseSeen = new Set<string>();
    for (const scopeItem of scopeItems) {
      if (isLikelyNoiseScopeItem(scopeItem)) {
        const noiseKey = normalizeScopeKey(scopeItem);
        if (noiseKey && !noiseSeen.has(noiseKey)) {
          noiseSeen.add(noiseKey);
          prefilteredNoiseItems.push(scopeItem);
        }
        continue;
      }
      kept.push(scopeItem);
    }
    if (prefilteredNoiseItems.length > 0) {
      warnings.push(
        `Scope contamination pre-filter removed ${prefilteredNoiseItems.length} metadata/noise fragments before matching.`
      );
    }
    scopeItems = kept;
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
        batchResults[batchIndex] = scopeAiWrapperMode
          ? claudeMatches.map((match) => ({
            ...match,
            classificationSource: "semantic" as const
          }))
          : claudeMatches.map((match) =>
            normalizeAgencyDomainMatch(
              {
                ...match,
                classificationSource: "semantic"
              },
              marketResearchSupported
            )
          );
      } catch (error) {
        if (isAiEndToEndModeEnabled()) {
          throw makeError(
            422,
            "upstream_unavailable",
            `AI end-to-end mode requires AI scope matching, but batch ${batchIndex + 1}/${batches.length} failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            "analyze-scope",
            { retryable: true }
          );
        }
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

  const matchedNoiseItems = scopeAiWrapperMode
    ? []
    : matches
      .map((match) => match.scopeItem)
      .filter((scopeItem) => isLikelyNoiseScopeItem(scopeItem));
  if (!scopeAiWrapperMode && matchedNoiseItems.length > 0) {
    const noiseKeys = new Set(matchedNoiseItems.map((item) => normalizeScopeKey(item)));
    matches = matches.filter((match) => !noiseKeys.has(normalizeScopeKey(match.scopeItem)));
    warnings.push(
      `Scope contamination post-filter removed ${noiseKeys.size} noisy matched fragments before scoring.`
    );
  }

  if (fallbackBatchCount > 0 && fallbackBatchCount === batches.length) {
    warnings.push("Scope matching used deterministic fallback for this document.");
  }
  if (isAiEndToEndModeEnabled() && fallbackBatchCount > 0) {
    throw makeError(
      422,
      "upstream_unavailable",
      "AI end-to-end mode requires AI scope matching for all batches, but deterministic fallback was used.",
      "analyze-scope",
      { retryable: true }
    );
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

  const uncertainItems = matches
    .filter((item) => item.class === "uncertain")
    .map((item) => item.scopeItem);
  const noiseItems = scopeAiWrapperMode
    ? []
    : [
      ...prefilteredNoiseItems,
      ...matchedNoiseItems,
      ...collectScopeNoiseFragments(input.scopeOfWork, scopeItems)
    ];
  if (!scopeAiWrapperMode && noiseItems.length > 0) {
    warnings.push(`Scope contamination filtered: ${noiseItems.length} non-work metadata lines moved to unclassified items.`);
  }
  const unclassifiedItems = Array.from(
    new Set([...uncertainItems, ...noiseItems])
  );

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    taxonomyVersion: taxonomyVersionFromServices(taxonomy),
    scopeItems,
    unclassifiedItems,
    uncertainItems,
    matches,
    agencyServicePercentage,
    outsourcingPercentage,
    outputQuantities,
    outputTypes,
    warnings
  };
}
