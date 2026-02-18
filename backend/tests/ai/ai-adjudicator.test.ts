import { describe, expect, test } from "vitest";
import { __aiAdjudicatorTestUtils } from "@/lib/extraction/ai-adjudicator";

const deterministicHints = {
  verificationScore: 0.62,
  completenessScore: 0.66,
  warnings: ["deterministic warning"],
  redFlags: [],
  missingInformation: [{ field: "submissionRequirements.format", suggestedQuestion: "What file format is required?" }],
  conflicts: [{ field: "projectDescription", candidates: ["Scope sentence copied"], resolution: "Needs narrative summary" }]
};

describe("ai adjudicator fallback utilities", () => {
  test("parses fenced/prefixed JSON with common formatting defects", () => {
    const parsed = __aiAdjudicatorTestUtils.parseObjectFromModelText(`Result:\n\n\
\`\`\`json
{ verificationScore: 0.71,
  "completenessScore": 0.81,
  "quality": {
    "status": "review_required",
    "evidenceDensity": 0.74,
    "sectionScores": { "extraction": 0.7, "scope": 0.6, "evaluation": 0.6 },
  },
  "conflicts": [],
  "warnings": []
}
\`\`\`
Done.`);

    expect(parsed).not.toBeNull();
    expect(parsed?.verificationScore).toBe(0.71);
    expect(parsed?.completenessScore).toBe(0.81);
  });

  test("normalizes oversized loose payloads into schema-safe adjudication", () => {
    const loose = {
      verificationScore: "0.73",
      completenessScore: 0.82,
      quality: {
        status: "review_required",
        evidenceDensity: "0.72",
        sectionScores: { extraction: 0.61, scope: 0.51, evaluation: 0.41 },
        blockReasons: []
      },
      conflicts: [
        {
          field: "projectDescription",
          candidates: ["a".repeat(700)],
          resolution: "Re-extract from narrative section"
        }
      ],
      warnings: ["x".repeat(1200)],
      qualityFlags: ["Project Description Shallow", "misplaced_deliverable_requirements"],
      missingInformation: [
        {
          field: "submissionRequirements.format",
          suggestedQuestion:
            "What are the exact file formats, encryption, and max size limits for technical and commercial proposals?"
        }
      ],
      redFlags: []
    };

    const normalized = __aiAdjudicatorTestUtils.normalizeAdjudicationFromLooseObject(
      loose,
      deterministicHints
    );

    expect(normalized).not.toBeNull();
    expect(normalized?.warnings[0]?.length ?? 0).toBeLessThanOrEqual(220);
    expect(normalized?.conflicts[0]?.candidates[0]?.length ?? 0).toBeLessThanOrEqual(180);
    expect(normalized?.qualityFlags).toContain("project_description_shallow");
  });
});
