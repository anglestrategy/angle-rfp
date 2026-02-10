import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";

interface Pass1Output {
  clientName: string;
  clientNameArabic: string | null;
  projectName: string;
  projectNameOriginal: string | null;
  projectDescription: string;
  scopeOfWork: string;
  evaluationCriteria: string;
  requiredDeliverables: string[];
  importantDates: Array<{ title: string; date: string; type: string; isCritical: boolean }>;
  submissionRequirements: {
    method: string;
    email: string | null;
    physicalAddress: string | null;
    format: string;
    copies: number | null;
    otherRequirements: string[];
  };
  warnings: string[];
  evidence: Array<{ field: string; page: number; excerpt: string }>;
  confidenceScores: Record<string, number> & { overall: number };
}

function bySectionName(
  text: string,
  sections: AnalyzeRfpInput["parsedDocument"]["sections"],
  names: string[]
): string | null {
  const match = sections.find((section) => names.includes(section.name));
  if (!match) {
    return null;
  }

  return text.slice(match.startOffset, match.endOffset).trim() || null;
}

function findLineValue(text: string, keys: string[]): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    for (const key of keys) {
      const regex = new RegExp(`^\\s*${key}\\s*[:：-]\\s*(.+)$`, "i");
      const m = line.match(regex);
      if (m?.[1]) {
        return m[1].trim();
      }
    }
  }

  return null;
}

function extractExactBlock(text: string, headingRegex: RegExp, fallbackLength: number): string | null {
  const match = headingRegex.exec(text);
  if (!match?.index) {
    return null;
  }

  const start = match.index;
  const tail = text.slice(start + match[0].length);
  const nextHeading = tail.search(/\n\s*(?:[A-Z][^\n]{1,60}:|\d+\.\s+[A-Z]|[\u0600-\u06FF]{3,}\s*[:：])/);
  const end = nextHeading > 0 ? start + match[0].length + nextHeading : Math.min(text.length, start + fallbackLength);

  return text.slice(start, end).trim();
}

function normalizeDate(raw: string): string | null {
  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso?.[1]) {
    return iso[1];
  }

  const dmy = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function extractDates(text: string): Array<{ title: string; date: string; type: string; isCritical: boolean }> {
  const lines = text.split(/\r?\n/);
  const out: Array<{ title: string; date: string; type: string; isCritical: boolean }> = [];

  for (const line of lines) {
    const normalized = normalizeDate(line);
    if (!normalized) {
      continue;
    }

    const lower = line.toLowerCase();
    const type = lower.includes("question")
      ? "qa_deadline"
      : lower.includes("submission")
        ? "submission_deadline"
        : lower.includes("presentation")
          ? "presentation"
          : "other";

    out.push({
      title: line.replace(/\s+/g, " ").trim().slice(0, 120),
      date: normalized,
      type,
      isCritical: type === "submission_deadline" || type === "presentation"
    });
  }

  if (out.length === 0) {
    return [
      {
        title: "Date not explicitly extracted",
        date: "2099-12-31",
        type: "other",
        isCritical: false
      }
    ];
  }

  return out;
}

function extractDeliverables(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const candidates = lines.filter((line) =>
    /deliverable|proposal|cv|case study|submission|required|مطلوب|تسليم/i.test(line)
  );

  if (candidates.length === 0) {
    return ["Technical proposal", "Financial proposal"];
  }

  return Array.from(new Set(candidates)).slice(0, 12);
}

function extractSubmission(text: string): Pass1Output["submissionRequirements"] {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] ?? null;

  let method = "Unknown";
  if (/email/i.test(text) && /physical|hard copy|sealed|address/i.test(text)) {
    method = "Email + Physical copies";
  } else if (/email/i.test(text)) {
    method = "Email";
  } else if (/portal|website|platform/i.test(text)) {
    method = "Online portal";
  }

  const format = /\bpdf\b/i.test(text) ? "PDF" : "Unspecified";
  const copiesMatch = text.match(/\b(\d+)\s+cop(y|ies)\b/i);

  return {
    method,
    email: emailMatch,
    physicalAddress: /riyadh|jeddah|dammam|address/i.test(text) ? "See RFP address section" : null,
    format,
    copies: copiesMatch?.[1] ? Number(copiesMatch[1]) : null,
    otherRequirements: extractDeliverables(text).slice(0, 3)
  };
}

export function runPass1Extraction(input: AnalyzeRfpInput): Pass1Output {
  const text = input.parsedDocument.rawText;
  const warnings: string[] = [];

  const clientName =
    findLineValue(text, ["Client", "Client Name", "Issuer", "العميل"]) ??
    "Unknown Client";

  const projectName =
    findLineValue(text, ["Project", "Project Name", "RFP", "اسم المشروع"]) ??
    "Untitled Project";

  const scopeFromSection = bySectionName(text, input.parsedDocument.sections, ["scope_of_work"]);
  const scopeFromHeading = extractExactBlock(text, /scope\s+of\s+work|نطاق\s+العمل/i, 2000);
  const scopeOfWork = scopeFromSection ?? scopeFromHeading ?? text.slice(0, Math.min(1200, text.length));

  if (!scopeFromSection && !scopeFromHeading) {
    warnings.push("Scope section not clearly detected; fallback extraction used.");
  }

  const evalFromSection = bySectionName(text, input.parsedDocument.sections, ["evaluation_criteria"]);
  const evalFromHeading = extractExactBlock(text, /evaluation\s+criteria|معايير\s+التقييم/i, 1500);
  const evaluationCriteria = evalFromSection ?? evalFromHeading ?? "Evaluation criteria not explicitly found.";

  if (!evalFromSection && !evalFromHeading) {
    warnings.push("Evaluation criteria section not clearly detected.");
  }

  const requiredDeliverables = extractDeliverables(text);
  const importantDates = extractDates(text);
  const submissionRequirements = extractSubmission(text);

  const projectDescription = text.slice(0, 320).replace(/\s+/g, " ").trim();

  const evidence: Array<{ field: string; page: number; excerpt: string }> = [
    {
      field: "scopeOfWork",
      page: 1,
      excerpt: scopeOfWork.slice(0, 200)
    },
    {
      field: "evaluationCriteria",
      page: 1,
      excerpt: evaluationCriteria.slice(0, 200)
    }
  ];

  const confidenceScores: Record<string, number> & { overall: number } = {
    clientName: clientName === "Unknown Client" ? 0.5 : 0.9,
    projectName: projectName === "Untitled Project" ? 0.55 : 0.9,
    scopeOfWork: scopeFromSection || scopeFromHeading ? 0.9 : 0.65,
    evaluationCriteria: evalFromSection || evalFromHeading ? 0.87 : 0.6,
    dates: importantDates[0]?.date === "2099-12-31" ? 0.5 : 0.82,
    overall: 0.8
  };

  return {
    clientName,
    clientNameArabic: /[\u0600-\u06FF]/.test(clientName) ? clientName : null,
    projectName,
    projectNameOriginal: /[\u0600-\u06FF]/.test(projectName) ? projectName : null,
    projectDescription,
    scopeOfWork,
    evaluationCriteria,
    requiredDeliverables,
    importantDates,
    submissionRequirements,
    warnings,
    evidence,
    confidenceScores
  };
}
