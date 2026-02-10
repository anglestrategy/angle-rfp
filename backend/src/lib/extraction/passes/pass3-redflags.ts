import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";

const redFlagKeywords: Array<{
  type: "contractual" | "feasibility" | "process";
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  pattern: RegExp;
  recommendation: string;
}> = [
  {
    type: "contractual",
    severity: "HIGH",
    title: "Unlimited Revisions",
    pattern: /unlimited\s+revisions|غير\s+محدود\s+من\s+التعديلات/i,
    recommendation: "Negotiate revision cap with change-request process."
  },
  {
    type: "contractual",
    severity: "MEDIUM",
    title: "IP Ownership Risk",
    pattern: /all\s+work\s+becomes\s+client\s+property|work\s+for\s+hire/i,
    recommendation: "Request ownership carve-out for unused concepts."
  },
  {
    type: "feasibility",
    severity: "MEDIUM",
    title: "Unrealistic Timeline",
    pattern: /within\s+\d+\s+days|خلال\s+\d+\s+يوم/i,
    recommendation: "Clarify delivery sequencing and milestone expectations."
  },
  {
    type: "process",
    severity: "LOW",
    title: "No Q&A Window",
    pattern: /no\s+questions|without\s+q&a|بدون\s+أسئلة/i,
    recommendation: "Request formal clarification window before submission."
  }
];

export function runPass3RedFlags(input: AnalyzeRfpInput, extracted: { scopeOfWork: string }) {
  const text = `${input.parsedDocument.rawText}\n${extracted.scopeOfWork}`;
  const warnings: string[] = [];

  const redFlags = redFlagKeywords
    .filter((item) => item.pattern.test(text))
    .map((item) => ({
      type: item.type,
      severity: item.severity,
      title: item.title,
      description: `${item.title} detected in RFP language.`,
      sourceText: text.slice(0, 220),
      recommendation: item.recommendation
    }));

  if (redFlags.length > 0) {
    warnings.push(`${redFlags.length} red flag(s) detected.`);
  }

  return { redFlags, warnings };
}
