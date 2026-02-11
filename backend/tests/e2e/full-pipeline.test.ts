import { describe, expect, test } from "vitest";
import { parseDocumentInput } from "@/lib/parsing/parse-document";
import { analyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { analyzeScopeInput } from "@/lib/scope/analyze-scope";
import { researchClientInput } from "@/lib/research/research-client";
import { calculateScoreInput } from "@/lib/scoring/calculate-score";
import { exportAnalysis } from "@/lib/export/export-service";

const analysisId = "e6c1c93e-6f43-4f16-bbe0-30761998a4db";

const sampleRfp = `
Client: Saudi Aramco
Project Name: Brand Refresh Campaign 2026

Scope of Work:
Develop campaign strategy, produce 6 videos, 14 motion graphics assets, and 40 visual design assets.
Coordinate with media buying supervision and bilingual campaign operations.

Evaluation Criteria:
Creative quality 40%
Team capability 30%
Cost efficiency 30%

Submission Requirements:
Send proposal to procurement@example.com in PDF format.
Submission deadline: 15/03/2026
`;

describe("full pipeline e2e", () => {
  test("executes parse -> extract -> scope -> research -> score -> export", async () => {
    const parsed = await parseDocumentInput({
      analysisId,
      fileName: "rfp.txt",
      mimeType: "text/plain",
      fileBytes: Buffer.from(sampleRfp, "utf8")
    });

    const extracted = await analyzeRfpInput({
      analysisId,
      parsedDocument: parsed
    });

    const scope = await analyzeScopeInput({
      analysisId,
      scopeOfWork: extracted.scopeOfWork,
      language: parsed.primaryLanguage
    });

    const research = await researchClientInput(
      {
        analysisId,
        clientName: extracted.clientName,
        clientNameArabic: extracted.clientNameArabic ?? undefined,
        country: "SA"
      },
      {
        brave: async () => [
          {
            key: "officialSignal",
            value: "Public company listed on exchange",
            source: "Tadawul",
            tier: 1,
            sourceDate: "2026-02-10",
            category: "official"
          }
        ],
        tavily: async () => [
          {
            key: "marketSignal",
            value: "High campaign activity in region",
            source: "Reuters",
            tier: 2,
            sourceDate: "2026-02-09",
            category: "news"
          }
        ],
        firecrawl: async () => [
          {
            key: "brandSignal",
            value: "Bilingual corporate site and campaigns",
            source: "Company Website",
            tier: 1,
            sourceDate: "2026-02-08",
            category: "official"
          }
        ]
      }
    );

    const scoring = await calculateScoreInput({
      analysisId,
      extractedRfp: extracted,
      scopeAnalysis: scope,
      clientResearch: research
    });

    const report = {
      schemaVersion: "1.0.0",
      analysisId,
      summary: {
        headline: `${extracted.projectName} opportunity`,
        recommendation: scoring.score.recommendationBand,
        score: scoring.score.finalScore
      },
      extractedRfp: extracted,
      scopeAnalysis: scope,
      clientResearch: research,
      financialScore: scoring.score,
      warnings: [...parsed.warnings, ...extracted.warnings, ...research.warnings, ...scoring.warnings],
      generatedAt: new Date().toISOString()
    };

    const exported = await exportAnalysis({
      analysisId,
      report,
      format: "link"
    });

    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(extracted.schemaVersion).toBe("1.0.0");
    expect(scope.schemaVersion).toBe("1.0.0");
    expect(research.schemaVersion).toBe("1.0.0");
    expect(scoring.score.schemaVersion).toBe("1.0.0");
    expect(exported.schemaVersion).toBe("1.0.0");
    expect(scoring.score.factorBreakdown).toHaveLength(11);
    expect(exported.format).toBe("link");
  });
});
