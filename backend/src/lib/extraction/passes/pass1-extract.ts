import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { extractWithClaude, type ClaudeExtractedFields } from "@/lib/extraction/claude-extractor";

export interface DeliverableItem {
  item: string;
  source: "verbatim" | "inferred";
}

export interface Pass1Output {
  clientName: string;
  clientNameArabic: string | null;
  projectName: string;
  projectNameOriginal: string | null;
  projectDescription: string;
  scopeOfWork: string;
  evaluationCriteria: string;
  requiredDeliverables: DeliverableItem[];
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findLineValue(text: string, keys: string[]): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    for (const key of keys) {
      const escapedKey = escapeRegex(key);
      const regex = new RegExp(`^\\s*${escapedKey}\\s*[:：-]\\s*(.+)$`, "i");
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

  // Patterns that indicate this line is an address, not a date
  const addressPatterns = /address|street|building|floor|district|p\.?o\.?\s*box|postal|zip|avenue|road|blvd|suite|unit|city|region|حي|شارع|مبنى|طابق|صندوق بريد/i;

  for (const line of lines) {
    // Skip lines that look like addresses (they may contain registration dates)
    if (addressPatterns.test(line)) {
      continue;
    }

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

function extractDeliverables(text: string): DeliverableItem[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const candidates = lines.filter((line) =>
    /deliverable|proposal|cv|case study|submission|required|مطلوب|تسليم/i.test(line)
  );

  // Return empty array if nothing found - no hardcoded defaults
  if (candidates.length === 0) {
    return [];
  }

  return Array.from(new Set(candidates)).slice(0, 12).map((item) => ({
    item,
    source: "verbatim" as const
  }));
}

function normalizeDedupeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_#]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStructuredText(input: string): string {
  const lines = input.split(/\r?\n/);
  const seen = new Set<string>();
  const output: string[] = [];

  for (const originalLine of lines) {
    let line = originalLine.trim();
    if (!line) {
      if (output[output.length - 1] !== "") {
        output.push("");
      }
      continue;
    }

    if (/^```/.test(line)) {
      continue;
    }

    line = line.replace(/\*\*/g, "");

    const listStripped = line.replace(/^\s*(?:[-*•▪‣●]|\d+[.)])\s+/u, "").trim();
    if (/^#{1,6}\s*/.test(listStripped)) {
      const heading = listStripped.replace(/^#{1,6}\s*/, "").trim();
      if (!heading) {
        continue;
      }
      line = `## ${heading}`;
    }

    const dedupeKey = normalizeDedupeKey(line);
    if (!dedupeKey) {
      continue;
    }

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    output.push(line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function dedupeDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  const byKey = new Map<string, DeliverableItem>();

  for (const item of items) {
    const cleaned = item.item.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 4) {
      continue;
    }

    const key = normalizeDedupeKey(cleaned);
    if (!key) {
      continue;
    }

    const current = byKey.get(key);
    if (!current || (current.source === "inferred" && item.source === "verbatim")) {
      byKey.set(key, {
        item: cleaned,
        source: item.source
      });
    }
  }

  return Array.from(byKey.values());
}

function dedupeImportantDates(
  dates: Array<{ title: string; date: string; type: string; isCritical: boolean }>
): Array<{ title: string; date: string; type: string; isCritical: boolean }> {
  const byKey = new Map<string, { title: string; date: string; type: string; isCritical: boolean }>();

  for (const date of dates) {
    const cleanTitle = date.title.replace(/\s+/g, " ").trim();
    if (!cleanTitle) {
      continue;
    }

    const key = `${date.date}|${date.type}|${normalizeDedupeKey(cleanTitle)}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...date,
        title: cleanTitle
      });
    }
  }

  return Array.from(byKey.values());
}

function extractSubmission(text: string): Pass1Output["submissionRequirements"] {
  // Use word boundaries to avoid matching partial strings
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)?.[0] ?? null;

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
    otherRequirements: [] // Don't put deliverables here
  };
}

function mapClaudeToPass1Output(
  claude: ClaudeExtractedFields,
  text: string
): Pass1Output {
  const warnings: string[] = [];

  // Map Claude date types to our format with isCritical flag
  const mappedDates = claude.importantDates.map((d) => ({
    title: d.title,
    date: d.date,
    type: d.type,
    isCritical: d.type === "submission_deadline" || d.type === "presentation"
  }));
  const importantDates = dedupeImportantDates(mappedDates);

  // Ensure we have at least one date entry
  if (importantDates.length === 0) {
    importantDates.push({
      title: "Date not explicitly extracted",
      date: "2099-12-31",
      type: "other",
      isCritical: false
    });
  }

  const evidence: Array<{ field: string; page: number; excerpt: string }> = [
    {
      field: "scopeOfWork",
      page: 1,
      excerpt: (claude.scopeOfWork || "").slice(0, 200)
    },
    {
      field: "evaluationCriteria",
      page: 1,
      excerpt: (claude.evaluationCriteria || "").slice(0, 200)
    }
  ];

  // High confidence since Claude extraction is intelligent
  const confidenceScores: Record<string, number> & { overall: number } = {
    clientName: claude.clientName ? 0.95 : 0.5,
    projectName: claude.projectName ? 0.95 : 0.55,
    scopeOfWork: claude.scopeOfWork ? 0.92 : 0.65,
    evaluationCriteria: claude.evaluationCriteria ? 0.9 : 0.6,
    dates: importantDates[0]?.date !== "2099-12-31" ? 0.88 : 0.5,
    overall: 0.9
  };

  return {
    clientName: claude.clientName || "Unknown Client",
    clientNameArabic: /[\u0600-\u06FF]/.test(claude.clientName) ? claude.clientName : null,
    projectName: claude.projectName || "Untitled Project",
    projectNameOriginal: /[\u0600-\u06FF]/.test(claude.projectName) ? claude.projectName : null,
    projectDescription: normalizeStructuredText(claude.projectDescription || text.slice(0, 320).replace(/\s+/g, " ").trim()),
    scopeOfWork: normalizeStructuredText(claude.scopeOfWork || text.slice(0, 1200)),
    evaluationCriteria: normalizeStructuredText(claude.evaluationCriteria || "Evaluation criteria not explicitly found."),
    requiredDeliverables: dedupeDeliverables(
      claude.requiredDeliverables.map((d) => ({
        item: typeof d === "string" ? d : d.item,
        source: (typeof d === "string" ? "verbatim" : d.source) as "verbatim" | "inferred"
      }))
    ),
    importantDates,
    submissionRequirements: {
      method: claude.submissionRequirements.method || "Unknown",
      email: claude.submissionRequirements.email,
      physicalAddress: claude.submissionRequirements.physicalAddress,
      format: claude.submissionRequirements.format || "Unspecified",
      copies: claude.submissionRequirements.copies,
      otherRequirements: [] // Don't put deliverables here - they belong in requiredDeliverables
    },
    warnings,
    evidence,
    confidenceScores
  };
}

function runPass1ExtractionFallback(input: AnalyzeRfpInput): Pass1Output {
  // Original regex-based extraction as fallback
  const text = input.parsedDocument.rawText;
  const warnings: string[] = ["Claude extraction failed; using regex fallback."];

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

export async function runPass1Extraction(input: AnalyzeRfpInput): Promise<Pass1Output> {
  const text = input.parsedDocument.rawText;

  // Try Claude extraction first
  try {
    const claudeResult = await extractWithClaude(text);
    return mapClaudeToPass1Output(claudeResult, text);
  } catch (error) {
    console.error(
      "Claude extraction failed, using fallback:",
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
    );
    return runPass1ExtractionFallback(input);
  }
}
