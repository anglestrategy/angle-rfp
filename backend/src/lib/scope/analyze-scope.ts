import { makeError } from "@/lib/api/errors";
import { matchScopeItems, splitScopeItems } from "@/lib/scope/matcher";
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
  const matches = matchScopeItems(scopeItems, taxonomy);

  const fullCount = matches.filter((item) => item.class === "full").length;
  const partialCount = matches.filter((item) => item.class === "partial").length;
  const total = Math.max(matches.length, 1);

  const agencyServicePercentage = roundToOneDecimalAsRatio((fullCount + 0.5 * partialCount) / total);
  const outsourcingPercentage = roundToOneDecimalAsRatio(1 - agencyServicePercentage);

  const outputQuantities = parseOutputQuantities(input.scopeOfWork);
  const outputTypes = classifyOutputTypes(outputQuantities);

  const warnings: string[] = [];
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
