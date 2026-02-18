import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";

export function runPass4Completeness(
  input: AnalyzeRfpInput,
  extracted: {
    scopeOfWork: string;
    evaluationCriteria: string;
    importantDates: Array<{ date: string }>;
    submissionRequirements: { method: string; format: string };
  }
): {
  completenessScore: number;
  missingInformation: Array<{ field: string; suggestedQuestion: string }>;
  warnings: string[];
} {
  const text = input.parsedDocument.rawText.toLowerCase();
  const missingInformation: Array<{ field: string; suggestedQuestion: string }> = [];

  if (!/budget|cost|pricing|ميزانية|تكلفة/.test(text)) {
    missingInformation.push({
      field: "budget",
      suggestedQuestion: "What is the anticipated budget range for this project?"
    });
  }

  if (extracted.importantDates.length === 0 || extracted.importantDates[0]?.date === "2099-12-31") {
    missingInformation.push({
      field: "important_dates",
      suggestedQuestion: "Can you confirm all critical submission and Q&A dates?"
    });
  }

  if (extracted.submissionRequirements.method === "Unknown") {
    missingInformation.push({
      field: "submission_method",
      suggestedQuestion: "What is the exact submission channel and process?"
    });
  }

  if (extracted.submissionRequirements.format === "Unspecified") {
    missingInformation.push({
      field: "submission_format",
      suggestedQuestion: "What file format and size constraints apply to submissions?"
    });
  }

  if (!/contract|liability|payment\s+terms|شروط\s+العقد/.test(text)) {
    missingInformation.push({
      field: "contract_terms",
      suggestedQuestion: "Can you provide standard contract and payment terms?"
    });
  }

  const criticalFields = new Set(["important_dates", "submission_method", "submission_format"]);
  const criticalGapCount = missingInformation.filter((item) => criticalFields.has(item.field)).length;
  const advisoryGapCount = Math.max(0, missingInformation.length - criticalGapCount);
  const weightedPenalty = criticalGapCount * 0.18 + advisoryGapCount * 0.06;
  const completenessScore = Math.max(0, Math.min(1, 1 - weightedPenalty));

  const warnings = missingInformation.length > 0
    ? [
        `${missingInformation.length} information gap(s) detected (${criticalGapCount} critical, ${advisoryGapCount} advisory).`
      ]
    : [];

  return {
    completenessScore,
    missingInformation,
    warnings
  };
}
