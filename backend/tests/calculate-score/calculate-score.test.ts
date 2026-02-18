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
    expect(first.score.factorBreakdown.every((factor) => typeof factor.status === "string")).toBe(true);
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
    expect(holdingFactor?.status).toBe("na");
  });

  test("fails closed when quality gate blocks recommendation", async () => {
    const result = await calculateScoreInput({
      ...baseInput,
      extractedRfp: {
        ...baseInput.extractedRfp,
        qualityFlags: ["critical_info_missing"],
        missingInformation: [{ field: "submission deadline" }],
        requiredDeliverables: [],
        importantDates: [],
        evidence: [{ field: "projectName" }]
      },
      scopeAnalysis: {
        ...baseInput.scopeAnalysis,
        matches: [{ class: "uncertain" }, { class: "uncertain" }],
        unclassifiedItems: ["Ambiguous requirement"]
      },
      clientResearch: {
        ...baseInput.clientResearch,
        confidence: 0.2,
        researchMetadata: {
          sourcesUsed: 1,
          providerStats: [
            { finalStatus: "failed" },
            { finalStatus: "failed" },
            { finalStatus: "failed" }
          ]
        }
      }
    });

    expect(result.score.quality.blocked).toBe(true);
    expect(result.score.finalScore).toBeLessThanOrEqual(49);
    expect(result.score.recommendationBand).toBe("LOW");
    expect(result.warnings.some((warning) => warning.startsWith("quality_gate_blocked:"))).toBe(true);
  });

  test("does not under-score strategy-led scopes when production output types are sparse", async () => {
    const result = await calculateScoreInput({
      ...baseInput,
      extractedRfp: {
        ...baseInput.extractedRfp,
        redFlags: [],
        completenessScore: 0.9,
        requiredDeliverables: [
          "Local Brand Strategy",
          "Launch Campaign Strategy",
          "Research and Benchmark Insights",
          "Local Design System"
        ],
        scopeOfWork: [
          "• Develop local brand strategy and positioning framework",
          "• Build launch campaign strategy and messaging architecture",
          "• Conduct market research and benchmark analysis",
          "• Define creative direction and visual guidelines",
          "• Deliver strategic rollout plan and governance model"
        ].join("\n"),
        evaluationCriteria: [
          "1. Agency Credentials",
          "• Relevant KSA strategy and campaign experience",
          "2. Strategic Planning & Creativity",
          "• Ability to translate insights into localization strategy",
          "3. Project Management & Deliverables",
          "• On-time delivery against milestones"
        ].join("\n"),
        evaluationCriteriaStructured: [
          { title: "Agency Credentials", items: ["Relevant KSA strategy experience"] },
          { title: "Strategic Planning & Creativity", items: ["Localization strategy and campaign quality"] },
          { title: "Project Management & Deliverables", items: ["On-time milestone delivery"] }
        ],
        deliverableRequirements: {
          technical: [{ title: "Methodology", description: "Approach and governance model" }],
          commercial: [{ title: "Pricing", description: "Commercial pricing breakdown" }],
          strategicCreative: [{ title: "Strategic proposal", description: "Brand and campaign strategy proposal" }]
        }
      },
      scopeAnalysis: {
        ...baseInput.scopeAnalysis,
        outputQuantities: {
          videoProduction: null,
          motionGraphics: null,
          visualDesign: null,
          contentOnly: null
        },
        outputTypes: []
      }
    });

    const scopeFactor = result.score.factorBreakdown.find((factor) => factor.factor === "Project Scope Magnitude");
    const outputTypeFactor = result.score.factorBreakdown.find((factor) => factor.factor === "Output Types");

    expect(scopeFactor).toBeDefined();
    expect(outputTypeFactor).toBeDefined();
    expect(scopeFactor?.score ?? 0).toBeGreaterThanOrEqual(45);
    expect(outputTypeFactor?.score ?? 0).toBeGreaterThanOrEqual(40);
  });
});
