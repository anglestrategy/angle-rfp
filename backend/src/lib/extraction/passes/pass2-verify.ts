import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";

export function runPass2Verification(
  input: AnalyzeRfpInput,
  extracted: {
    scopeOfWork: string;
    evaluationCriteria: string;
  }
): {
  verificationScore: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const text = input.parsedDocument.rawText;

  let verificationScore = 0.9;

  if (!text.includes(extracted.scopeOfWork)) {
    verificationScore -= 0.2;
    warnings.push("Scope extraction is not a strict verbatim substring of source text.");
  }

  if (!text.includes(extracted.evaluationCriteria)) {
    verificationScore -= 0.2;
    warnings.push("Evaluation criteria extraction is not a strict verbatim substring of source text.");
  }

  const percentages = extracted.evaluationCriteria.match(/(\d{1,3})\s*%/g) ?? [];
  if (percentages.length > 1) {
    const sum = percentages
      .map((token) => Number(token.replace("%", "").trim()))
      .reduce((acc, value) => acc + value, 0);
    if (sum !== 100) {
      warnings.push(`Evaluation criteria percentages sum to ${sum}, not 100.`);
      verificationScore -= 0.05;
    }
  }

  return {
    verificationScore: Math.max(0, Math.min(1, verificationScore)),
    warnings
  };
}
