import { makeError } from "@/lib/api/errors";
import { matchScopeItems, splitScopeItems } from "@/lib/scope/matcher";
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
  matches: Array<{
    scopeItem: string;
    service: string;
    class: "full" | "partial" | "none";
    confidence: number;
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
    class: "full" | "partial" | "none";
    confidence: number;
    reasoning?: string;
  }> = [];

  const batches = chunkArray(scopeItems, 14);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    if (batch.length === 0) {
      continue;
    }

    try {
      const claudeMatches = await matchScopeWithClaude(batch, taxonomy);
      matches.push(...claudeMatches);
    } catch (error) {
      console.error(`Claude scope matching failed for batch ${i + 1}/${batches.length}, using token fallback:`, error);
      warnings.push(`Scope matching fallback applied for segment ${i + 1} due model-format issue.`);
      matches.push(...matchScopeItems(batch, taxonomy));
    }
  }

  const fullCount = matches.filter((item) => item.class === "full").length;
  const partialCount = matches.filter((item) => item.class === "partial").length;
  const total = Math.max(matches.length, 1);

  const agencyServicePercentage = roundToOneDecimalAsRatio((fullCount + 0.5 * partialCount) / total);
  const outsourcingPercentage = roundToOneDecimalAsRatio(1 - agencyServicePercentage);

  const outputQuantities = parseOutputQuantities(input.scopeOfWork);
  const outputTypes = classifyOutputTypes(outputQuantities, input.scopeOfWork);

  if (scopeItems.length === 0) {
    warnings.push("No granular scope items could be segmented from scope text.");
  }

  if (matches.some((item) => item.class === "none")) {
    warnings.push("One or more scope items have no direct agency-service match.");
  }

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    taxonomyVersion: taxonomyVersionFromServices(taxonomy),
    scopeItems,
    matches,
    agencyServicePercentage,
    outsourcingPercentage,
    outputQuantities,
    outputTypes,
    warnings
  };
}
