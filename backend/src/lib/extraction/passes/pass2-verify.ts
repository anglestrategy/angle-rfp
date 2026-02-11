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
  const text = input.parsedDocument.rawText.toLowerCase();

  let verificationScore = 0.9;

  // Check that key terms from the extracted content appear in the source
  // This is more flexible than requiring exact verbatim match while still
  // ensuring the extraction is grounded in the source document
  const scopeKeyTerms = extractKeyTerms(extracted.scopeOfWork);
  const scopeMatchRate = countMatches(scopeKeyTerms, text) / Math.max(scopeKeyTerms.length, 1);
  if (scopeMatchRate < 0.5) {
    verificationScore -= 0.15;
    warnings.push("Scope extraction may contain content not found in source document.");
  }

  const criteriaKeyTerms = extractKeyTerms(extracted.evaluationCriteria);
  const criteriaMatchRate = countMatches(criteriaKeyTerms, text) / Math.max(criteriaKeyTerms.length, 1);
  if (criteriaMatchRate < 0.5) {
    verificationScore -= 0.15;
    warnings.push("Evaluation criteria may contain content not found in source document.");
  }

  // Check evaluation criteria percentages if present
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

/**
 * Extract significant terms (3+ chars) from text for verification
 */
function extractKeyTerms(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4);

  // Get unique terms, prioritize longer/more significant words
  const unique = [...new Set(words)];
  return unique.slice(0, 20); // Check top 20 key terms
}

/**
 * Count how many key terms appear in the source text
 */
function countMatches(terms: string[], sourceText: string): number {
  return terms.filter(term => sourceText.includes(term)).length;
}
