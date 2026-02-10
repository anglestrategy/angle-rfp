import { makeError } from "@/lib/api/errors";
import { buildFactorBreakdown, type FactorBreakdownItem } from "@/lib/scoring/factors";
import { computeCompletenessPenalty, computeRedFlagPenalty } from "@/lib/scoring/penalties";

interface ExtractedRfpLike {
  schemaVersion?: string;
  analysisId?: string;
  redFlags?: Array<{ severity?: string }>;
  completenessScore?: number;
  requiredDeliverables?: string[];
  importantDates?: Array<{ date?: string }>;
}

interface ScopeAnalysisLike {
  schemaVersion?: string;
  analysisId?: string;
  agencyServicePercentage?: number;
  outputQuantities?: {
    videoProduction?: number | null;
    motionGraphics?: number | null;
    visualDesign?: number | null;
    contentOnly?: number | null;
  };
  outputTypes?: string[];
}

interface ClientResearchLike {
  schemaVersion?: string;
  analysisId?: string;
  companyProfile?: Record<string, unknown> & { entityType?: string };
  financialIndicators?: Record<string, unknown> & { marketingBudgetIndicator?: string };
  digitalPresence?: Record<string, unknown> & { bilingual?: boolean; confidence?: number };
  advertisingActivity?: Record<string, unknown> & { confidence?: number };
  researchMetadata?: Record<string, unknown> & { sourcesUsed?: number };
}

export interface CalculateScoreInput {
  analysisId: string;
  extractedRfp: ExtractedRfpLike;
  scopeAnalysis: ScopeAnalysisLike;
  clientResearch: ClientResearchLike;
}

export interface FinancialScoreV1 {
  schemaVersion: "1.0.0";
  analysisId: string;
  baseScore: number;
  redFlagPenalty: number;
  completenessPenalty: number;
  finalScore: number;
  recommendationBand: "EXCELLENT" | "GOOD" | "MODERATE" | "LOW";
  factorBreakdown: FactorBreakdownItem[];
  rationale: string;
}

export interface CalculateScoreResult {
  score: FinancialScoreV1;
  warnings: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function recommendationBandForScore(finalScore: number): FinancialScoreV1["recommendationBand"] {
  if (finalScore >= 85) {
    return "EXCELLENT";
  }
  if (finalScore >= 70) {
    return "GOOD";
  }
  if (finalScore >= 50) {
    return "MODERATE";
  }
  return "LOW";
}

function rationaleForBand(
  band: FinancialScoreV1["recommendationBand"],
  factors: FactorBreakdownItem[],
  warnings: string[]
): string {
  const strongest = [...factors]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2)
    .map((item) => item.factor)
    .join(", ");

  const riskNote = warnings.length > 0 ? "Review warnings before final decision." : "No material confidence warnings.";
  switch (band) {
    case "EXCELLENT":
      return `Pursue aggressively. Strongest drivers: ${strongest}. ${riskNote}`;
    case "GOOD":
      return `Recommended to pursue with standard diligence. Strongest drivers: ${strongest}. ${riskNote}`;
    case "MODERATE":
      return `Proceed with caution and validate assumptions. Strongest drivers: ${strongest}. ${riskNote}`;
    case "LOW":
      return `Consider passing unless strategic context changes. Strongest drivers: ${strongest}. ${riskNote}`;
  }
}

export async function calculateScoreInput(input: CalculateScoreInput): Promise<CalculateScoreResult> {
  if (!input.analysisId) {
    throw makeError(400, "validation_error", "analysisId is required", "calculate-score", {
      retryable: false
    });
  }

  if (!input.extractedRfp || !input.scopeAnalysis || !input.clientResearch) {
    throw makeError(
      400,
      "validation_error",
      "extractedRfp, scopeAnalysis, and clientResearch are required",
      "calculate-score",
      {
        retryable: false
      }
    );
  }

  const factorResult = buildFactorBreakdown({
    extractedRfp: input.extractedRfp,
    scopeAnalysis: input.scopeAnalysis,
    clientResearch: input.clientResearch
  });

  const redFlagPenalty = computeRedFlagPenalty(input.extractedRfp.redFlags);
  const completenessPenalty = computeCompletenessPenalty(input.extractedRfp.completenessScore);
  const baseScore = roundToTwo(clamp(factorResult.baseScore, 0, 100));
  const finalScore = roundToTwo(clamp(baseScore - redFlagPenalty - completenessPenalty, 0, 100));
  const recommendationBand = recommendationBandForScore(finalScore);

  const warnings = [...factorResult.warnings];
  if (input.extractedRfp.completenessScore === undefined) {
    warnings.push("completenessScore missing; maximum completeness penalty applied.");
  }

  const score: FinancialScoreV1 = {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    baseScore,
    redFlagPenalty,
    completenessPenalty,
    finalScore,
    recommendationBand,
    factorBreakdown: factorResult.factors,
    rationale: rationaleForBand(recommendationBand, factorResult.factors, warnings)
  };

  return {
    score,
    warnings
  };
}
