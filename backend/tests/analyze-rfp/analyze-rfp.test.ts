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
  test("extracts all required fields with schema version", async () => {
    const result = await analyzeRfpInput({
      analysisId: baseDocument.analysisId,
      parsedDocument: baseDocument
    });

    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.clientName).toBeTruthy();
    expect(result.projectName).toBeTruthy();
    expect(result.scopeOfWork.length).toBeGreaterThan(0);
    expect(result.evaluationCriteria.length).toBeGreaterThan(0);
    expect(result.requiredDeliverables.length).toBeGreaterThan(0);
    expect(result.importantDates.length).toBeGreaterThan(0);
  });

  test("extracts scope and evaluation content", async () => {
    const result = await analyzeRfpInput({
      analysisId: baseDocument.analysisId,
      parsedDocument: baseDocument
    });

    // Claude may summarize/restructure, so just check we got meaningful content
    expect(result.scopeOfWork.length).toBeGreaterThan(10);
    expect(result.evaluationCriteria.length).toBeGreaterThan(10);
  });

  test("keeps scope output concise and excludes phase/admin text", async () => {
    const noisyScopeDoc = {
      ...baseDocument,
      rawText: [
        "Client: Example Holdings",
        "Project Name: KSA Launch Campaign",
        "Scope of Work",
        "## Executive Summary",
        "The engagement includes strategy, creative development, and campaign rollout.",
        "## 1. Research and Analysis / Benchmarks",
        "• Review and identify key learnings from previous editions",
        "## 2. Strategic Foundation and Alignment",
        "• Develop campaign strategy and rollout plan",
        "Submission deadline: 2026-03-15",
        "Deadline for questions from bidders: 2026-03-01",
        "Email submission to procurement@example.com",
        "Evaluation Criteria",
        "Technical Approach 30%",
        "Team Experience 25%",
        "Commercial 45%"
      ].join("\n")
    };

    const result = await analyzeRfpInput({
      analysisId: noisyScopeDoc.analysisId,
      parsedDocument: noisyScopeDoc
    });

    expect(result.scopeOfWork).not.toContain("## Executive Summary");
    expect(result.scopeOfWork).not.toMatch(/research and analysis/i);
    expect(result.scopeOfWork).not.toMatch(/submission deadline/i);
    expect(result.scopeOfWork).not.toMatch(/questions from bidders/i);
    expect(result.scopeOfWork).toMatch(/campaign|strategy|creative|rollout/i);
  });

  test("normalizes evaluation criteria without markdown markers", async () => {
    const markdownCriteriaDoc = {
      ...baseDocument,
      rawText: [
        "Client: Example Holdings",
        "Project Name: KSA Launch Campaign",
        "Scope of Work",
        "Develop local launch strategy and campaign rollout.",
        "## Evaluation Criteria",
        "**1. Technical Approach (40%)**",
        "Brand strategy quality and localization depth.",
        "**2. Team Experience (35%)**",
        "Relevant KSA work history and senior staffing.",
        "**3. Commercial (25%)**",
        "Pricing competitiveness and value."
      ].join("\n")
    };

    const result = await analyzeRfpInput({
      analysisId: markdownCriteriaDoc.analysisId,
      parsedDocument: markdownCriteriaDoc
    });

    expect(result.evaluationCriteria).not.toContain("##");
    expect(result.evaluationCriteria).not.toContain("**");
    expect(result.evaluationCriteria).toMatch(/team experience|commercial|\d+%/i);
  });

  test("detects conflicts in submission deadlines", async () => {
    const conflictDoc = {
      ...baseDocument,
      rawText: `${baseDocument.rawText}\nSubmission deadline: 16/03/2026`
    };

    const result = await analyzeRfpInput({
      analysisId: conflictDoc.analysisId,
      parsedDocument: conflictDoc
    });

    expect(result.conflicts?.length).toBeGreaterThan(0);
    expect(result.warnings.some((warning) => warning.includes("Conflicting submission"))).toBe(true);
  });

  test("flags missing contract terms and gaps", async () => {
    const sparseDoc = {
      ...baseDocument,
      rawText: "Client: X\nProject Name: Y\nScope of Work\nSmall scope only"
    };

    const result = await analyzeRfpInput({
      analysisId: sparseDoc.analysisId,
      parsedDocument: sparseDoc
    });

    expect(result.missingInformation.length).toBeGreaterThan(0);
    expect(result.completenessScore).toBeLessThan(1);
  });

  test("normalizes executive summary without markdown headers or mid-word clipping", async () => {
    const longDoc = {
      ...baseDocument,
      rawText: [
        "Client: Example Holdings",
        "Project Name: KSA Launch Campaign",
        "## Executive Summary",
        "Develop and implement a comprehensive brand localization strategy for Expo 2030 Riyadh that aligns the global brand with Saudi identity and cultural expression while creating a unified narrative across touchpoints, launch campaign strategy, visual system, and long-term brand stewardship for local audiences and stakeholders.",
        "Scope of Work",
        "Brand strategy development",
        "Evaluation Criteria",
        "Technical Approach 30%"
      ].join("\n")
    };

    const result = await analyzeRfpInput({
      analysisId: longDoc.analysisId,
      parsedDocument: longDoc
    });

    expect(result.projectDescription).not.toContain("##");
    expect(result.projectDescription.toLowerCase()).not.toContain("client:");
    expect(result.projectDescription.length).toBeLessThanOrEqual(481);

    const trimmed = result.projectDescription.trim();
    const lastToken = trimmed.split(/\s+/).at(-1) ?? "";
    if (!/[.!?؟…]$/.test(trimmed)) {
      expect(lastToken.length).toBeGreaterThanOrEqual(2);
    }
  });
});
