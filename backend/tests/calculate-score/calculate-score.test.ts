import { describe, expect, test } from "vitest";
import { calculateScoreInput, recommendationBandForScore } from "@/lib/scoring/calculate-score";

const baseInput = {
  analysisId: "e6c1c93e-6f43-4f16-bbe0-30761998a4db",
  extractedRfp: {
    requiredDeliverables: ["Technical proposal", "Financial proposal"],
    importantDates: [
      { date: "2026-03-15" },
      { date: "2026-09-15" }
    ],
    redFlags: [{ severity: "MEDIUM" }],
    completenessScore: 0.88
  },
  scopeAnalysis: {
    agencyServicePercentage: 0.75,
    outputQuantities: {
      videoProduction: 5,
      motionGraphics: 12,
      visualDesign: 45,
      contentOnly: 20
    },
    outputTypes: ["videoProduction", "motionGraphics", "visualDesign"]
  },
  clientResearch: {
    companyProfile: {
      entityType: "public_company",
      estimatedEmployees: 8000,
      holdingGroupTier: "major"
    },
    financialIndicators: {
      marketingBudgetIndicator: "VERY_HIGH"
    },
    digitalPresence: {
      bilingual: true,
      confidence: 0.95
    },
    advertisingActivity: {
      confidence: 0.84
    },
    researchMetadata: {
      sourcesUsed: 14
    }
  }
} as const;

describe("recommendationBandForScore", () => {
  test("maps deterministic thresholds", () => {
    expect(recommendationBandForScore(90)).toBe("EXCELLENT");
    expect(recommendationBandForScore(72)).toBe("GOOD");
    expect(recommendationBandForScore(64)).toBe("MODERATE");
    expect(recommendationBandForScore(20)).toBe("LOW");
  });
});

describe("calculateScoreInput", () => {
  test("builds 11-factor deterministic score output", async () => {
    const first = await calculateScoreInput(baseInput);
    const second = await calculateScoreInput(baseInput);

    expect(first.score.schemaVersion).toBe("1.0.0");
    expect(first.score.factorBreakdown).toHaveLength(11);
    expect(first.score.finalScore).toBe(second.score.finalScore);
    expect(first.score.baseScore).toBe(second.score.baseScore);
  });

  test("applies red-flag and completeness penalties deterministically", async () => {
    const result = await calculateScoreInput({
      ...baseInput,
      extractedRfp: {
        ...baseInput.extractedRfp,
        redFlags: [
          { severity: "HIGH" },
          { severity: "HIGH" },
          { severity: "MEDIUM" },
          { severity: "LOW" }
        ],
        completenessScore: 0.5
      }
    });

    expect(result.score.redFlagPenalty).toBe(20);
    expect(result.score.completenessPenalty).toBe(5);
    expect(result.score.finalScore).toBeLessThan(result.score.baseScore);
  });

  test("adds warning when completenessScore is missing", async () => {
    const result = await calculateScoreInput({
      ...baseInput,
      extractedRfp: {
        ...baseInput.extractedRfp,
        completenessScore: undefined
      }
    });

    expect(result.warnings.some((warning) => warning.includes("completenessScore"))).toBe(true);
  });

  test("marks holding-group factor as unavailable when profile is unknown", async () => {
    const result = await calculateScoreInput({
      ...baseInput,
      clientResearch: {
        ...baseInput.clientResearch,
        companyProfile: {
          entityType: "public_company",
          estimatedEmployees: 8000,
          holdingGroupTier: "unknown",
          holdingGroup: "N/A"
        }
      }
    });

    const holdingFactor = result.score.factorBreakdown.find(
      (factor) => factor.factor === "Holding Group Affiliation"
    );

    expect(holdingFactor).toBeDefined();
    expect(holdingFactor?.identified).toBe(false);
    expect(holdingFactor?.score).toBe(0);
  });
});
