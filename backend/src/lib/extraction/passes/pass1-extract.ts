import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { extractWithClaude, type ClaudeExtractedFields } from "@/lib/extraction/claude-extractor";

export interface DeliverableItem {
  item: string;
  source: "verbatim" | "inferred";
}

export interface DeliverableRequirementItem {
  title: string;
  description: string;
  source: "verbatim" | "inferred";
}

export interface DeliverableRequirements {
  technical: DeliverableRequirementItem[];
  commercial: DeliverableRequirementItem[];
  strategicCreative: DeliverableRequirementItem[];
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
  deliverableRequirements: DeliverableRequirements;
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
  if (!match) {
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

type DeliverableCategory = "technical" | "commercial" | "strategicCreative";
type DeliverableHeadingHint = DeliverableCategory | "unknown";

interface ScopedDeliverableLine {
  text: string;
  hint: DeliverableHeadingHint;
  explicit: boolean;
}

const DELIVERABLE_SECTION_START_PATTERNS = [
  /submission format/i,
  /submission requirements?/i,
  /proposal requirements?/i,
  /deliverables?/i,
  /technical proposals?\s+should\s+include/i,
  /commercial proposals?\s+should\s+include/i,
  /technical proposal/i,
  /commercial proposal/i,
  /financial proposal/i,
  /evaluation criteria/i,
  /project management\s*&?\s*deliverables?/i,
  /صيغة التقديم|متطلبات التقديم|متطلبات العرض|التسليمات|المخرجات|العرض الفني|العرض المالي|معايير التقييم/i
];

const DELIVERABLE_SECTION_STOP_PATTERNS = [
  /^scope of work$/i,
  /^timeline$/i,
  /^important dates?$/i,
  /^special conditions?$/i,
  /^financial potential$/i,
  /^submission method$/i,
  /^executive summary$/i,
  /^project description$/i,
  /^نطاق العمل$/i,
  /^الشروط الخاصة$/i,
  /^الجدول الزمني$/i
];

const DELIVERABLE_NOISE_PATTERNS = [
  /^table of contents/i,
  /^page\s+\d+/i,
  /^\d{1,3}$/,
  /^(?:phase|program)\s+\d+/i,
  /\[vendor name\]/i,
  /riyadh site at the heart/i
];

const DELIVERABLE_CLAUSE_DROP_PATTERNS = [
  /accepts no liability/i,
  /shall not be responsible/i,
  /reserves the right/i,
  /if the vendor decides/i,
  /other information,?\s*if relevant/i,
  /for any costs incurred/i,
  /visionary concept of urban development/i,
  /site at the heart of/i
];

const DELIVERABLE_HINT_PATTERNS: Record<DeliverableHeadingHint, RegExp[]> = {
  technical: [
    /technical proposals?\s+should\s+include/i,
    /technical proposal/i,
    /methodology/i,
    /vendor profile/i,
    /team composition/i,
    /عرض فني/i
  ],
  commercial: [
    /commercial proposals?\s+should\s+include/i,
    /commercial proposal/i,
    /financial proposal/i,
    /payment terms?/i,
    /pricing/i,
    /عرض مالي/i
  ],
  strategicCreative: [
    /strategic planning/i,
    /creativity/i,
    /creative proposal/i,
    /campaign strategy/i,
    /brand strategy/i,
    /استراتيجي|إبداعي|الحملة/i
  ],
  unknown: [
    /submission requirements?/i,
    /proposal requirements?/i,
    /deliverables?/i
  ]
};

function splitRequirementClauses(line: string): string[] {
  return line
    .split(/(?<=[.;؛])\s+|\s+\|\s+|\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanDeliverableRequirementText(raw: string): string {
  const cleaned = normalizeRequirementLine(raw)
    .replace(/\[\s*vendor name\s*\]/gi, "")
    .replace(/\s*\b(?:page|pg\.?)\s*\d+\b/gi, "")
    .replace(/\(\s*\d{1,3}\s*\)\s*$/g, "")
    .replace(/\s+[:\-]?\s*\d{1,3}\s*$/g, "")
    .replace(/\bproject team\s*\d+\b/gi, "Project Team")
    .replace(/\b(and|or|و)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return "";
  }

  return cleaned;
}

function inferDeliverableHeadingHint(line: string): DeliverableHeadingHint | null {
  const normalized = normalizeRequirementLine(line);

  const order: DeliverableHeadingHint[] = ["commercial", "technical", "strategicCreative", "unknown"];
  for (const hint of order) {
    if (DELIVERABLE_HINT_PATTERNS[hint].some((pattern) => pattern.test(normalized))) {
      return hint;
    }
  }

  return null;
}

function collectDeliverableSectionLines(text: string): ScopedDeliverableLine[] {
  const lines = text.split(/\r?\n/);
  const out: ScopedDeliverableLine[] = [];
  let inSection = false;
  let sectionLineCount = 0;
  let currentHint: DeliverableHeadingHint = "unknown";

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeRequirementLine(trimmed);
    const headingHint = inferDeliverableHeadingHint(trimmed);
    const startsSection = DELIVERABLE_SECTION_START_PATTERNS.some((pattern) => pattern.test(trimmed));
    if (startsSection || headingHint !== null) {
      inSection = true;
      sectionLineCount = 0;
      if (headingHint !== null) {
        currentHint = headingHint;
      }
      if (REQUIREMENT_LINE_PATTERNS.explicit.test(normalized)) {
        out.push({
          text: normalized,
          hint: currentHint,
          explicit: true
        });
        sectionLineCount += 1;
      }
      continue;
    }

    if (inSection && DELIVERABLE_SECTION_STOP_PATTERNS.some((pattern) => pattern.test(trimmed)) && sectionLineCount > 0) {
      inSection = false;
      currentHint = "unknown";
      sectionLineCount = 0;
      continue;
    }

    if (!inSection) {
      continue;
    }

    if (DELIVERABLE_NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      continue;
    }

    const explicit = REQUIREMENT_LINE_PATTERNS.explicit.test(normalized);
    if (!explicit && normalized.split(/\s+/).length < 3) {
      continue;
    }

    out.push({
      text: normalized,
      hint: currentHint,
      explicit
    });
    sectionLineCount += 1;
    if (sectionLineCount >= 100) {
      inSection = false;
      currentHint = "unknown";
      sectionLineCount = 0;
    }
  }

  return out;
}

function extractDeliverables(text: string): DeliverableItem[] {
  const scopedLines = collectDeliverableSectionLines(text).map((entry) => entry.text);
  const allCandidates = scopedLines.length > 0
    ? scopedLines
    : text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => REQUIREMENT_LINE_PATTERNS.explicit.test(line))
        .filter((line) => /proposal|submission|deliverable|cv|resume|certificate|payment|pricing|commercial|financial|عرض|تقديم|مطلوب|شهادة|سيرة/i.test(line))
        .slice(0, 120);

  const deduped = new Set<string>();
  const out: DeliverableItem[] = [];

  for (const candidate of allCandidates) {
    for (const clause of splitRequirementClauses(candidate)) {
      const clean = cleanDeliverableRequirementText(clause);
      if (!clean || clean.length < 16) {
        continue;
      }

      if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(clean))) {
        continue;
      }

      if (!/proposal|submission|deliverable|cv|resume|certificate|payment|pricing|commercial|financial|methodology|credentials|references|عرض|تقديم|مطلوب|شهادة|سيرة|الخبرات|الدفع|مالي|فني/i.test(clean)) {
        continue;
      }

      const key = normalizeDedupeKey(clean);
      if (!key || deduped.has(key)) {
        continue;
      }

      deduped.add(key);
      out.push({
        item: clean,
        source: "verbatim"
      });

      if (out.length >= 16) {
        return out;
      }
    }
  }

  return out;
}
const REQUIREMENT_LINE_PATTERNS = {
  explicit: /(must|shall|required|should include|should be included|include the following|submit|submitted|provide|to include|يجب|مطلوب|تقديم|إرفاق|يشمل|ينبغي)/i,
  technical: /(technical proposal|executive summary|methodology|approach|credentials?|team|cv\b|resume|references?|certificate|vendor profile|track record|عرض فني|منهجية|سيرة|مرجع|شهادة|ملف الشركة|الخبرات)/i,
  commercial: /(commercial proposal|financial proposal|pricing|price|payment terms?|tax|subtotal|grand total|fees?|cost|quotation|budget|عرض مالي|مالي|تجاري|الدفع|ضريبة|تكلفة|سعر)/i,
  strategicCreative: /(strategic\s+(proposal|plan|framework|approach)|creative\s+(proposal|brief|concept|direction)|campaign\s+(strategy|concept|plan)|brand\s+(strategy|positioning|messaging|localization)|positioning|messaging framework|communication framework|استراتيجي|إبداعي|الحملة|التموضع|الرسائل)/i
};

function normalizeRequirementLine(raw: string): string {
  return raw
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\s*(?:[-*•▪‣●]|\d+[.)]|[ivx]+\.)\s+/iu, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyDeliverableCategory(line: string): DeliverableCategory | null {
  if (REQUIREMENT_LINE_PATTERNS.commercial.test(line)) {
    return "commercial";
  }
  if (REQUIREMENT_LINE_PATTERNS.technical.test(line)) {
    return "technical";
  }
  if (REQUIREMENT_LINE_PATTERNS.strategicCreative.test(line)) {
    return "strategicCreative";
  }
  return null;
}

function inferDeliverableTitle(line: string, category: DeliverableCategory): string {
  if (/project team|account team|team composition|consultants?|smes?|\bcv\b|resume/i.test(line)) {
    return "Team Composition and CVs";
  }
  if (/executive summary/i.test(line)) {
    return "Executive Summary";
  }
  if (/methodology|approach/i.test(line)) {
    return "Methodology and Approach";
  }
  if (/credentials?|profile|references?|track record/i.test(line)) {
    return "Agency Credentials and References";
  }
  if (/\bcv\b|resume|team composition|account team/i.test(line)) {
    return "Team Composition and CVs";
  }
  if (/commercial proposal|financial proposal|pricing|price|tax|subtotal|grand total|fees?|cost/i.test(line)) {
    if (/alternative commercial proposal/i.test(line)) {
      return "Alternative Commercial Proposal";
    }
    if (/encrypted file|password|separately/i.test(line)) {
      return "Encrypted Commercial Submission";
    }
    if (/subtotal|grand total|tax|pricing|price|fees?|cost/i.test(line)) {
      return "Pricing Breakdown and Totals";
    }
    return "Commercial and Financial Proposal";
  }
  if (/payment terms?/i.test(line)) {
    return "Payment Terms";
  }
  if (/consortium|joint venture|subcontractor|legal document|nda|non[-\s]?disclosure/i.test(line)) {
    return "Consortium and Legal Documentation";
  }
  if (/strategic|strategy|positioning|messaging|communication/i.test(line)) {
    return "Strategic Framework";
  }
  if (/creative|concept|creative direction|visual|design|campaign/i.test(line)) {
    return "Creative Direction and Campaign Plan";
  }

  const words = line.split(/\s+/).slice(0, 8).join(" ").trim();
  if (!words) {
    return category === "technical"
      ? "Technical Requirement"
      : category === "commercial"
        ? "Commercial Requirement"
        : "Strategic and Creative Requirement";
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function buildDeliverableRequirements(
  text: string,
  evaluationCriteria: string,
  requiredDeliverables: DeliverableItem[]
): DeliverableRequirements {
  const grouped: DeliverableRequirements = {
    technical: [],
    commercial: [],
    strategicCreative: []
  };
  const seen = new Set<string>();

  const addItem = (
    category: DeliverableCategory,
    title: string,
    description: string,
    source: "verbatim" | "inferred"
  ): void => {
    const cleanTitle = title.replace(/\s+/g, " ").trim();
    const cleanDescription = truncateAtWordBoundary(description.replace(/\s+/g, " ").trim(), 220);
    if (!cleanTitle || !cleanDescription) {
      return;
    }
    if (cleanDescription.split(/\s+/).length < 4) {
      return;
    }
    if (/^[A-Za-z]+\s+\d+$/i.test(cleanDescription) || /^\d+$/.test(cleanDescription)) {
      return;
    }
    if (/^project team$/i.test(cleanDescription)) {
      return;
    }

    const normalizedTitle = normalizeDedupeKey(cleanTitle);
    const normalizedDescription = normalizeDedupeKey(cleanDescription);
    if (!normalizedTitle || !normalizedDescription) {
      return;
    }

    const sameTitleCount = grouped[category].filter(
      (item) => normalizeDedupeKey(item.title) === normalizedTitle
    ).length;
    if (sameTitleCount >= 3) {
      return;
    }

    const hasNearDuplicate = grouped[category].some((item) => {
      const existingTitle = normalizeDedupeKey(item.title);
      const existingDescription = normalizeDedupeKey(item.description);
      if (existingTitle !== normalizedTitle) {
        return false;
      }
      return (
        existingDescription.includes(normalizedDescription) ||
        normalizedDescription.includes(existingDescription)
      );
    });
    if (hasNearDuplicate) {
      return;
    }

    const key = `${category}|${normalizedTitle}|${normalizedDescription}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    grouped[category].push({
      title: cleanTitle,
      description: cleanDescription,
      source
    });
  };

  const sectionLines = collectDeliverableSectionLines(text);
  const evaluationRequirementLines: ScopedDeliverableLine[] = evaluationCriteria
    .split(/\r?\n/)
    .map(cleanDeliverableRequirementText)
    .filter((line) => line.length >= 14)
    .filter((line) => /proposal|submission|deliverable|project management|certificate|credentials|cv|resume|payment|pricing|commercial|financial|technical|creative|strategy|عرض|تقديم|مطلوب|شهادة|سيرة|مالي|فني/i.test(line))
    .map((line) => ({
      text: line,
      hint: inferDeliverableHeadingHint(line) ?? "unknown",
      explicit: REQUIREMENT_LINE_PATTERNS.explicit.test(line)
    }))
    .slice(0, 80);

  const candidateLines = [...sectionLines, ...evaluationRequirementLines].slice(0, 260);
  for (const candidateLine of candidateLines) {
    for (const clause of splitRequirementClauses(candidateLine.text)) {
      const line = cleanDeliverableRequirementText(clause);
      if (!line || line.length < 14) {
        continue;
      }

      if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line))) {
        continue;
      }

      const category =
        candidateLine.hint !== "unknown"
          ? candidateLine.hint
          : classifyDeliverableCategory(line);
      if (!category) {
        continue;
      }

      const explicitSignal =
        candidateLine.explicit ||
        REQUIREMENT_LINE_PATTERNS.explicit.test(line) ||
        /proposal|submission|deliverable|must|shall|required|should include|to include|submitted?|provide|عرض|تقديم|مطلوب|يجب/i.test(line);

      const hasArtifactSignal =
        /proposal|submission|deliverable|certificate|credentials|cv|resume|profile|references|methodology|approach|payment|pricing|quotation|plan|framework|عرض|تقديم|شهادة|سيرة|منهجية|ملف|الدفع|تسعير|خطة/i.test(line);

      // Prevent strategic bucket contamination from generic brand/project prose.
      if (
        category === "strategicCreative" &&
        !/(creative|campaign|concept|direction|positioning|messaging|strategic|strategy|brand localization|brand strategy|إبداع|حملة|استراتيجي|التموضع)/i.test(line)
      ) {
        continue;
      }

      if (!explicitSignal && !hasArtifactSignal) {
        continue;
      }

      if (category !== "strategicCreative" && !hasArtifactSignal) {
        continue;
      }

      const source: "verbatim" | "inferred" = explicitSignal ? "verbatim" : "inferred";
      addItem(category, inferDeliverableTitle(line, category), line, source);
    }
  }

  for (const deliverable of requiredDeliverables) {
    const clean = cleanDeliverableRequirementText(deliverable.item);
    if (!clean || clean.length < 12) {
      continue;
    }
    const category = classifyDeliverableCategory(clean);
    if (!category) {
      continue;
    }
    addItem(category, inferDeliverableTitle(clean, category), clean, deliverable.source);
  }

  const hasStrategicSignal =
    REQUIREMENT_LINE_PATTERNS.strategicCreative.test(text) ||
    REQUIREMENT_LINE_PATTERNS.strategicCreative.test(evaluationCriteria);

  if (grouped.technical.length === 0) {
    addItem(
      "technical",
      "Technical Proposal Submission",
      "Prepare a technical proposal with methodology, team credentials, and relevant experience aligned to the RFP scope.",
      "inferred"
    );
  }
  if (grouped.commercial.length === 0) {
    addItem(
      "commercial",
      "Commercial Proposal Submission",
      "Prepare a commercial/financial proposal including pricing structure and payment terms as required by the RFP.",
      "inferred"
    );
  }
  if (grouped.strategicCreative.length === 0 && hasStrategicSignal) {
    addItem(
      "strategicCreative",
      "Strategic and Creative Proposal",
      "Develop a strategic and creative proposal responding to brand strategy, positioning, and campaign creativity criteria in the RFP.",
      "inferred"
    );
  }

  grouped.technical = grouped.technical.slice(0, 8);
  grouped.commercial = grouped.commercial.slice(0, 8);
  grouped.strategicCreative = grouped.strategicCreative.slice(0, 8);

  return grouped;
}

function normalizeDedupeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_#]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const candidate = text.slice(0, maxChars + 1);
  const lastSpace = candidate.lastIndexOf(" ");
  const safeCut = lastSpace >= Math.floor(maxChars * 0.7)
    ? candidate.slice(0, lastSpace)
    : candidate.slice(0, maxChars);

  return `${safeCut.trim().replace(/[,:;\-]+$/g, "").trim()}…`;
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

function fallbackExecutiveSummarySeed(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^client\s*[:：-]/i.test(line))
    .filter((line) => !/^project\s*(name)?\s*[:：-]/i.test(line))
    .filter((line) => !/^scope of work$/i.test(line))
    .filter((line) => !/^evaluation criteria$/i.test(line))
    .filter((line) => !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(line))
    .slice(0, 8);

  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function dedupeDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  const byKey = new Map<string, DeliverableItem>();
  const inferredCandidates: DeliverableItem[] = [];

  const inferredKeepPatterns = [
    /technical proposal/i,
    /commercial proposal/i,
    /certificate/i,
    /credentials?/i,
    /portfolio/i,
    /\bcv\b|resume/i,
    /methodology/i,
    /project management plan/i,
    /risk management plan/i,
    /payment terms?/i,
    /terms?\s*&?\s*conditions?/i,
    /non[-\s]?disclosure|nda/i,
    /سيرة|شهادة|منهجية|عرض فني|عرض مالي|شروط/
  ];

  const inferredDropPatterns = [
    /campaign/i,
    /color palette/i,
    /iconography/i,
    /visual style/i,
    /pattern/i,
    /illustration/i,
    /intro|outro/i,
    /social media/i,
    /content pillars?/i,
    /always-on/i,
    /storytelling/i
  ];

  for (const item of items) {
    const cleaned = item.item.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 4) {
      continue;
    }

    const key = normalizeDedupeKey(cleaned);
    if (!key) {
      continue;
    }

    if (item.source === "inferred") {
      const shouldKeep =
        inferredKeepPatterns.some((pattern) => pattern.test(cleaned)) &&
        !inferredDropPatterns.some((pattern) => pattern.test(cleaned));

      if (shouldKeep) {
        inferredCandidates.push({ item: cleaned, source: "inferred" });
      }
      continue;
    }

    const current = byKey.get(key);
    if (!current || current.source !== "verbatim") {
      byKey.set(key, { item: cleaned, source: "verbatim" });
    }
  }

  const verbatim = Array.from(byKey.values());

  // Keep inferred items only when they add value and do not overwhelm verbatim requirements.
  const inferredLimit = verbatim.length >= 8 ? 0 : 4;
  for (const candidate of inferredCandidates) {
    if (inferredLimit === 0) {
      break;
    }

    const key = normalizeDedupeKey(candidate.item);
    if (!key || byKey.has(key)) {
      continue;
    }

    byKey.set(key, candidate);
    if (Array.from(byKey.values()).filter((item) => item.source === "inferred").length >= inferredLimit) {
      break;
    }
  }

  return Array.from(byKey.values());
}

const SCOPE_NON_WORK_PATTERNS = [
  /submission deadline/i,
  /intent to tender/i,
  /deadline for questions/i,
  /responses?\s+to\s+questions?/i,
  /proposal submission/i,
  /submission requirements?/i,
  /evaluation criteria/i,
  /special conditions?/i,
  /terms?\s*&?\s*conditions?/i,
  /commercial proposal/i,
  /certificate/i,
  /\bcv\b|resume/i,
  /email submission/i,
  /nda|non[-\s]?disclosure/i,
  /must comprise|minimum\s+\d+%/i,
  /موعد تقديم|آخر موعد|شروط التقديم|معايير التقييم|الشروط|اتفاقية/i
];

const SCOPE_HEADING_PATTERNS = [
  /^executive summary$/i,
  /^scope of work$/i,
  /^overview$/i,
  /^key objectives?$/i,
  /^deliverables$/i,
  /^timeline$/i,
  /^important dates?$/i,
  /^program phases?.*/i,
  /^phase\s*\d+[:\s]/i,
  /^(?:\d+\.?\s*)?(research and analysis|strategic foundation|local brand|local design system|brand book|post-launch plan|project management)$/i,
  /^نطاق العمل$/i
];

const SCOPE_ACTION_VERB_PATTERN =
  /(develop|design|create|build|launch|define|align|deliver|craft|implement|execute|produce|manage|lead|plan|map|research|analyze|optimi[sz]e|monitor|coordinate|supervise|developing|designing|creating|building|إعداد|تطوير|تصميم|تنفيذ|إطلاق|إدارة|تحليل|تنسيق|إشراف|إنتاج)/i;

function splitScopeFragments(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const parts = line.split(/[؛;•▪‣●]/u).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      out.push(line.trim());
      continue;
    }
    out.push(...parts);
  }

  return out.filter(Boolean);
}

function sanitizeScopeForAnalysis(scopeText: string): string {
  const fragments = splitScopeFragments(scopeText);
  const seen = new Set<string>();
  const workItems: string[] = [];

  for (const fragment of fragments) {
    if (!fragment || /^```/.test(fragment)) {
      continue;
    }

    const cleaned = fragment
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\s*(?:[-*•▪‣●]|\d+[.)])\s+/u, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 10) {
      continue;
    }

    const normalized = normalizeDedupeKey(cleaned);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    if (SCOPE_HEADING_PATTERNS.some((pattern) => pattern.test(cleaned))) {
      continue;
    }

    if (SCOPE_NON_WORK_PATTERNS.some((pattern) => pattern.test(cleaned))) {
      continue;
    }

    // Drop short category labels and phase titles; keep concrete action lines.
    const wordCount = cleaned.split(/\s+/).length;
    const hasActionVerb = SCOPE_ACTION_VERB_PATTERN.test(cleaned);
    if (!hasActionVerb && wordCount <= 6) {
      continue;
    }

    seen.add(normalized);
    workItems.push(cleaned);

    if (workItems.length >= 12) {
      break;
    }
  }

  if (workItems.length === 0) {
    return scopeText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((line) => `• ${line.replace(/^#{1,6}\s*/, "").trim()}`)
      .join("\n");
  }

  return workItems.map((item) => `• ${item}`).join("\n");
}

function normalizeExecutiveSummary(text: string): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*(?:[-*•▪‣●]|\d+[.)])\s+/gmu, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return clean;
  }

  // Keep concise but complete: prioritize sentence boundaries and avoid mid-word clipping.
  const sentences = clean.split(/(?<=[.!?؟])\s+/).filter(Boolean);
  const summary = sentences.slice(0, 2).join(" ").trim();

  if (summary) {
    return truncateAtWordBoundary(summary, 480);
  }

  const words = clean.split(/\s+/).slice(0, 80).join(" ").trim();
  return truncateAtWordBoundary(words || clean, 480);
}

const EVALUATION_HEADING_NOISE = [
  /^evaluation criteria$/i,
  /^criteria$/i,
  /^evaluation$/i,
  /^evaluation matrix$/i,
  /^technical evaluation$/i
];

function splitEvaluationSentences(line: string): string[] {
  return line
    .split(/(?<=[.;!?؟])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12)
    .map((part) => part.replace(/[.;]+$/g, "").trim());
}

function sanitizeEvaluationCriteria(criteriaText: string): string {
  const lines = criteriaText.split(/\r?\n/);
  const seen = new Set<string>();
  const output: string[] = [];
  let previousWasNumberedHeading = false;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || /^```/.test(line)) {
      continue;
    }

    line = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!line || EVALUATION_HEADING_NOISE.some((pattern) => pattern.test(line))) {
      continue;
    }

    line = line.replace(/^(\d+)[)\-]\s+/, "$1. ");

    const dedupeKey = normalizeDedupeKey(line);
    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    if (/^\d+\.\s/.test(line)) {
      previousWasNumberedHeading = true;
      output.push(line);
      continue;
    }

    if (previousWasNumberedHeading) {
      previousWasNumberedHeading = false;
      const sentenceParts = splitEvaluationSentences(line);
      if (sentenceParts.length > 1) {
        for (const part of sentenceParts) {
          output.push(`• ${part}`);
        }
      } else {
        output.push(`• ${line}`);
      }
      continue;
    }

    if (/^\s*(?:[-*•▪‣●])\s+/u.test(line)) {
      output.push(line.replace(/^\s*(?:[-*•▪‣●])\s+/u, "• "));
      continue;
    }

    const sentenceParts = splitEvaluationSentences(line);
    if (sentenceParts.length > 1) {
      for (const part of sentenceParts) {
        output.push(`• ${part}`);
      }
    } else {
      output.push(`• ${line}`);
    }
  }

  if (output.length === 0) {
    return "Evaluation criteria not explicitly found.";
  }

  return output.join("\n");
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
    projectDescription: normalizeExecutiveSummary(
      normalizeStructuredText(claude.projectDescription || fallbackExecutiveSummarySeed(text))
    ),
    scopeOfWork: sanitizeScopeForAnalysis(normalizeStructuredText(claude.scopeOfWork || text.slice(0, 1200))),
    evaluationCriteria: sanitizeEvaluationCriteria(
      normalizeStructuredText(claude.evaluationCriteria || "Evaluation criteria not explicitly found.")
    ),
    requiredDeliverables: dedupeDeliverables(
      claude.requiredDeliverables.map((d) => ({
        item: typeof d === "string" ? d : d.item,
        source: (typeof d === "string" ? "verbatim" : d.source) as "verbatim" | "inferred"
      }))
    ),
    deliverableRequirements: buildDeliverableRequirements(
      text,
      sanitizeEvaluationCriteria(normalizeStructuredText(claude.evaluationCriteria || "")),
      dedupeDeliverables(
        claude.requiredDeliverables.map((d) => ({
          item: typeof d === "string" ? d : d.item,
          source: (typeof d === "string" ? "verbatim" : d.source) as "verbatim" | "inferred"
        }))
      )
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

  const projectDescription = fallbackExecutiveSummarySeed(text);

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
    projectDescription: normalizeExecutiveSummary(projectDescription),
    scopeOfWork: sanitizeScopeForAnalysis(scopeOfWork),
    evaluationCriteria: sanitizeEvaluationCriteria(normalizeStructuredText(evaluationCriteria)),
    requiredDeliverables: dedupeDeliverables(requiredDeliverables),
    deliverableRequirements: buildDeliverableRequirements(
      text,
      sanitizeEvaluationCriteria(normalizeStructuredText(evaluationCriteria)),
      dedupeDeliverables(requiredDeliverables)
    ),
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
