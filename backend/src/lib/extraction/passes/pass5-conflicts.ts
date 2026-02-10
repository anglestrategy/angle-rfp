import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";

function extractSubmissionDates(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const values: string[] = [];

  for (const line of lines) {
    if (!/submission|proposal deadline|موعد\s+التقديم/i.test(line)) {
      continue;
    }

    const iso = line.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    const dmy = line.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g) ?? [];
    values.push(...iso, ...dmy);
  }

  return Array.from(new Set(values));
}

export function runPass5Conflicts(input: AnalyzeRfpInput, extracted: { importantDates: Array<{ date: string }> }) {
  const warnings: string[] = [];
  const conflicts: Array<{ field: string; candidates: string[]; resolution: string }> = [];

  const candidateSubmissionDates = extractSubmissionDates(input.parsedDocument.rawText);
  if (candidateSubmissionDates.length > 1) {
    const resolved = extracted.importantDates[0]?.date ?? candidateSubmissionDates[0];
    conflicts.push({
      field: "submission_deadline",
      candidates: candidateSubmissionDates,
      resolution: `Resolved to ${resolved} using first explicit timeline entry.`
    });
    warnings.push("Conflicting submission deadline values detected.");
  }

  return { conflicts, warnings };
}
