import { describe, expect, test } from "vitest";
import { analyzeRfpInput } from "@/lib/extraction/analyze-rfp";

const baseDocument = {
  schemaVersion: "1.0.0",
  analysisId: "f7df722f-9968-4c17-980a-fcb53aaf56d1",
  primaryLanguage: "english" as const,
  rawText: [
    "Client: Example Holdings",
    "Project Name: KSA Launch Campaign",
    "Scope of Work",
    "The agency will develop brand strategy and create 5 hero videos.",
    "Evaluation Criteria",
    "Technical Approach 30%",
    "Team Experience 25%",
    "Commercial 45%",
    "Submission deadline: 2026-03-15",
    "Questions deadline: 2026-03-01",
    "Submit via email procurement@example.com in PDF format",
    "No budget specified"
  ].join("\n"),
  sections: [
    { name: "scope_of_work", startOffset: 60, endOffset: 175 },
    { name: "evaluation_criteria", startOffset: 176, endOffset: 270 }
  ],
  tables: [],
  evidenceMap: []
};

describe("analyzeRfpInput", () => {
  test("extracts all required fields with schema version", () => {
    const result = analyzeRfpInput({
      analysisId: baseDocument.analysisId,
      parsedDocument: baseDocument
    });

    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.clientName).toBe("Example Holdings");
    expect(result.projectName).toBe("KSA Launch Campaign");
    expect(result.scopeOfWork.length).toBeGreaterThan(0);
    expect(result.evaluationCriteria.length).toBeGreaterThan(0);
    expect(result.requiredDeliverables.length).toBeGreaterThan(0);
    expect(result.importantDates.length).toBeGreaterThan(0);
    expect(result.submissionRequirements.method).not.toBe("Unknown");
  });

  test("preserves exact scope/evaluation snippets from source text", () => {
    const result = analyzeRfpInput({
      analysisId: baseDocument.analysisId,
      parsedDocument: baseDocument
    });

    expect(baseDocument.rawText.includes(result.scopeOfWork)).toBe(true);
    expect(baseDocument.rawText.includes(result.evaluationCriteria)).toBe(true);
  });

  test("detects conflicts in submission deadlines", () => {
    const conflictDoc = {
      ...baseDocument,
      rawText: `${baseDocument.rawText}\nSubmission deadline: 16/03/2026`
    };

    const result = analyzeRfpInput({
      analysisId: conflictDoc.analysisId,
      parsedDocument: conflictDoc
    });

    expect(result.conflicts?.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes("Conflicting submission"))).toBe(true);
  });

  test("flags missing contract terms and gaps", () => {
    const sparseDoc = {
      ...baseDocument,
      rawText: "Client: X\nProject Name: Y\nScope of Work\nSmall scope only"
    };

    const result = analyzeRfpInput({
      analysisId: sparseDoc.analysisId,
      parsedDocument: sparseDoc
    });

    expect(result.missingInformation.length).toBeGreaterThan(0);
    expect(result.completenessScore).toBeLessThan(1);
  });
});
