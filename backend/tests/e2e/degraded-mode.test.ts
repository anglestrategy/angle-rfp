import { describe, expect, test } from "vitest";
import { researchClientInput } from "@/lib/research/research-client";
import { calculateScoreInput } from "@/lib/scoring/calculate-score";

const analysisId = "2d887df7-8114-4f67-ac44-ed9902eb77b6";

describe("degraded mode e2e", () => {
  test("continues with partial research when one provider fails", async () => {
    const research = await researchClientInput(
      {
        analysisId,
        clientName: "Saudi Aramco",
        country: "SA"
      },
      {
        brave: async () => {
          throw new Error("provider timeout");
        },
        tavily: async () => [
          {
            key: "marketSignal",
            value: "Campaign activity remains high",
            source: "Bloomberg",
            tier: 2,
            sourceDate: "2026-02-10",
            category: "financial"
          }
        ],
        firecrawl: async () => [
          {
            key: "officialSignal",
            value: "Corporate site confirms active initiatives",
            source: "Company Website",
            tier: 1,
            sourceDate: "2026-02-10",
            category: "official"
          }
        ]
      }
    );

    const score = await calculateScoreInput({
      analysisId,
      extractedRfp: {
        analysisId,
        requiredDeliverables: ["Technical proposal", "Financial proposal"],
        importantDates: [{ date: "2026-03-15" }],
        redFlags: [],
        completenessScore: 0.9
      },
      scopeAnalysis: {
        analysisId,
        agencyServicePercentage: 0.7,
        outputQuantities: {
          videoProduction: 2,
          motionGraphics: 5,
          visualDesign: 8,
          contentOnly: 3
        },
        outputTypes: ["videoProduction", "motionGraphics", "visualDesign"]
      },
      clientResearch: research
    });

    expect(research.warnings.length).toBeGreaterThan(0);
    expect(research.evidence.length).toBeGreaterThan(0);
    expect(score.score.finalScore).toBeGreaterThanOrEqual(0);
    expect(score.score.finalScore).toBeLessThanOrEqual(100);
  });
});
