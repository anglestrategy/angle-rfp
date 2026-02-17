import type { AnalyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import {
  extractWithClaude,
  type ClaudeExtractedFields,
  type ClaudeExtractionResult
} from "@/lib/extraction/claude-extractor";

export interface DeliverableItem {
  item: string;
  source: "verbatim" | "inferred";
}

export interface DeliverableRequirementItem {
  title: string;
  description: string;
  source: "verbatim" | "inferred";
  evidenceRef?: string;
}

export interface DeliverableRequirements {
  technical: DeliverableRequirementItem[];
  commercial: DeliverableRequirementItem[];
  strategicCreative: DeliverableRequirementItem[];
}

export interface EvaluationCriteriaGroup {
  title: string;
  weight: string | null;
  items: string[];
  evidenceRefs: string[];
}

export interface Pass1Output {
  clientName: string;
  clientNameArabic: string | null;
  projectName: string;
  projectNameOriginal: string | null;
  projectDescription: string;
  scopeOfWork: string;
  evaluationCriteria: string;
  evaluationCriteriaStructured: EvaluationCriteriaGroup[];
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

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const MAX_DELIVERABLES_PER_CATEGORY = positiveIntFromEnv(
  process.env.EXTRACTION_MAX_DELIVERABLES_PER_CATEGORY,
  12
);
const MAX_SCOPE_ITEMS_FOR_ANALYSIS = positiveIntFromEnv(
  process.env.EXTRACTION_MAX_SCOPE_ITEMS,
  80
);

function bySectionName(
  text: string,
  sections: AnalyzeRfpInput["parsedDocument"]["sections"],
  names: string[]
): string | null {
  const match = sections.find((section) => names.includes(section.name));
  if (!match) {
    return null;
  }

  if (
    match.startOffset < 0 ||
    match.endOffset <= match.startOffset ||
    match.endOffset > text.length
  ) {
    return null;
  }

  // Guard against stale offsets that point inside a token (can happen when text is rewritten in tests
  // or if upstream parser offsets drift). In that case, fall back to heading-based extraction.
  if (match.startOffset > 0) {
    const prevChar = text[match.startOffset - 1] ?? "";
    const currentChar = text[match.startOffset] ?? "";
    const isTokenChar = /[\p{L}\p{N}]/u;
    if (isTokenChar.test(prevChar) && isTokenChar.test(currentChar)) {
      return null;
    }
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
  origin: "section" | "evaluation";
}

const DELIVERABLE_SECTION_START_PATTERNS = [
  /submission format/i,
  /submission requirements?/i,
  /proposal requirements?/i,
  /technical proposals?\s+should\s+include/i,
  /commercial proposals?\s+should\s+include/i,
  /technical proposal submission/i,
  /commercial proposal submission/i,
  /صيغة التقديم|متطلبات التقديم|متطلبات العرض|العرض الفني|العرض المالي/i
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
  /^terms?\s*&?\s*conditions?$/i,
  /^general conditions?$/i,
  /^contract conditions?$/i,
  /^instructions to bidders$/i,
  /^legal/i,
  /^annex/i,
  /^نطاق العمل$/i,
  /^الشروط(?:\s+الخاصة)?$/i,
  /^الشروط والأحكام$/i,
  /^الجدول الزمني$/i
];

const DELIVERABLE_NOISE_PATTERNS = [
  /^table of contents/i,
  /^page\s+\d+/i,
  /^\d{1,3}$/,
  /^(?:phase|program)\s+\d+/i,
  /^section\s+\d+/i,
  /^article\s+\d+/i,
  /\[vendor name\]/i,
  /riyadh site at the heart/i,
  /^the technical proposals?\s+should\s+include\s+the\s+following\s+sections?/i,
  /^the commercial proposals?\s+should\s+include\s+the\s+following\s+sections?/i
];

const DELIVERABLE_CLAUSE_DROP_PATTERNS = [
  /accepts no liability/i,
  /shall not be responsible/i,
  /reserves the right/i,
  /reserves the right to ultimately define/i,
  /if the vendor decides/i,
  /other information,?\s*if relevant/i,
  /for any costs incurred/i,
  /visionary concept of urban development/i,
  /site at the heart of/i,
  /no clarification.*shall be binding/i,
  /shall not be binding or have any legal validity/i,
  /referred to as ["“]?vendor["”]?/i,
  /proposal documents will be submitted to/i,
  /vendor to prepare and submit to the vendor/i,
  /following sections?/i,
  /following areas?/i,
  /as stated in this rfp/i,
  /on condition that such/i,
  /all proposal documents/i,
  /no vendor may add/i,
  /referred to as.*vendor/i,
  /rectification shall be binding/i,
  /legal validity whatsoever/i,
  /the employer accepts no liability/i,
  /shall provide its proposed payment terms.*however/i,
  /the vendor decides to submit an alternative/i,
  /once delivered to.*no vendor may add/i,
  /terms?\s*&?\s*conditions?/i,
  /general conditions?/i,
  /contract conditions?/i,
  /instructions to bidders?/i,
  /confidentiality|liability|governing law|indemnif/i,
  /^vendor$/i,
  /^commercial proposals?\s+should\s+include/i,
  /consortium|joint venture|subcontractor/i,
  /business continuity/i,
  /disaster recovery/i,
  /public\s*-\s*key infrastructure/i,
  /internet-?based standards/i,
  /cybersecurity/i,
  /network (?:architecture|infrastructure|security)/i,
  /infrastructure (?:security|operations|standards)/i
];

const GENERIC_DELIVERABLE_DIRECTIVE_PATTERNS = [
  /proposals?\s+address\s+all\s+requirements/i,
  /following\s+(sections?|areas?)\s+(within|in)\s+(their\s+)?proposal/i,
  /all proposal documents will be submitted/i,
  /referred to as ["“]?vendor["”]?/i,
  /vendor to prepare and submit/i,
  /no clarification,?\s+explanation/i,
  /no vendor may add/i
];

const CONCRETE_DELIVERABLE_ARTIFACT_PATTERNS = [
  /executive summary/i,
  /methodology|approach/i,
  /credentials?|references?|vendor profile|track record/i,
  /\bcv\b|resume|team composition|account team|consultants?|smes?/i,
  /certificate/i,
  // Removed: /technical proposal/i - too broad, captures narrative text
  // Removed: /commercial proposal|financial proposal/i - too broad
  /pricing\s+breakdown|fee\s+schedule|cost\s+breakdown/i, // More specific than /pricing|fees/
  /encrypted file|password/i,
  /project management plan|risk management plan|communication.*framework|scheduling management/i,
  /brand strategy|positioning|messaging framework|campaign plan/i,
  /عرض فني|عرض مالي|منهجية|سيرة|مرجع|شهادة|ملف الشركة|الدفع|مالي|فني|استراتيجي|إبداعي/
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
    .replace(/^[0-9]+[:.)]\s*/g, "")
    .replace(/^[ivxlcdm]+[:.)]\s*/i, "")
    .replace(/\[\s*vendor name\s*\]/gi, "")
    .replace(/\s*\b(?:page|pg\.?)\s*\d+\b/gi, "")
    .replace(/\(\s*\d{1,3}\s*\)\s*$/g, "")
    .replace(/\b(?:project team|team)\s+\d+\b/gi, "Project Team")
    .replace(/\s+[:\-]?\s*\d{1,3}\s*$/g, "")
    .replace(/\s+\d{1,2}\s*$/g, "")
    .replace(/\b(and|or|و)\s*$/i, "")
    .replace(/^\s*(?:the\s+)?(?:following|below)\s+(?:sections?|areas?)\s*(?:within|in)?\s*(?:their\s+)?proposal\s*[:\-]?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^(.{10,180}?)\s+\1$/i, "$1")
    .replace(/^(?:referred to as\s+)?["“]?vendor["”]?\s*,?\s*/i, "")
    .replace(/^\s*(?:the\s+)?commercial proposals?\s+should\s+include\s+the\s+following\s+sections?\s*:?\s*/i, "")
    .replace(/^\s*(?:the\s+)?technical proposals?\s+should\s+include\s+the\s+following\s+sections?\s*:?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return "";
  }

  return cleaned;
}

function looksLikeRequirementStatement(line: string): boolean {
  return /(must|shall|required|should include|submit|submitted|provide|attach|include|present|prepare|deliver|upload|تقديم|إرفاق|يشمل|يتضمن|يجب)/i.test(line);
}

const TECHNICAL_REQUIREMENT_SIGNALS = [
  /technical proposal/i,
  /methodology/i,
  /approach/i,
  /executive summary/i,
  /credentials?/i,
  /vendor profile/i,
  /track record/i,
  /references?/i,
  /\bcv\b|resume/i,
  /team composition/i,
  /project management plan/i,
  /risk management plan/i,
  /communication.*framework/i,
  /certificate/i,
  /عرض فني|منهجية|سيرة|مرجع|شهادة|ملف الشركة|الخبرات/
];

const COMMERCIAL_REQUIREMENT_SIGNALS = [
  /commercial proposal/i,
  /financial proposal/i,
  /pricing|price|fees?|cost/i,
  /payment terms?/i,
  /encrypted file|password/i,
  /tax|subtotal|grand total/i,
  /quotation|quote/i,
  /عرض مالي|مالي|تجاري|الدفع|ضريبة|تكلفة|سعر/
];

const STRATEGIC_CREATIVE_REQUIREMENT_SIGNALS = [
  /strategic planning/i,
  /creativity/i,
  /creative/i,
  /campaign strategy/i,
  /brand strategy/i,
  /positioning/i,
  /messaging framework/i,
  /communication framework/i,
  /creative direction/i,
  /استراتيجي|إبداعي|الحملة|التموضع|الرسائل|الهوية/
];

function hasSignal(line: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(line));
}

function isConcreteDeliverableLine(line: string): boolean {
  const normalized = normalizeRequirementLine(line);
  if (!normalized) {
    return false;
  }
  if (GENERIC_DELIVERABLE_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return CONCRETE_DELIVERABLE_ARTIFACT_PATTERNS.some((pattern) => pattern.test(normalized));
}

const TECHNICAL_SUBMISSION_HINTS = [
  /technical proposal/i,
  /executive summary/i,
  /methodology|approach/i,
  /team composition|account team|consultants?/i,
  /\bcv\b|resume/i,
  /credentials?|references?|track record|vendor profile/i,
  /certificate/i,
  /project management plan|risk management plan|communication.*framework|scheduling management/i,
  /عرض فني|منهجية|سيرة|مرجع|شهادة|ملف الشركة|الخبرات/
];

const COMMERCIAL_SUBMISSION_HINTS = [
  /commercial proposal|financial proposal/i,
  /pricing|price|fees?|cost|quotation|quote/i,
  /payment terms?/i,
  /encrypted file|password/i,
  /subtotal|grand total|tax/i,
  /عرض مالي|مالي|تجاري|الدفع|ضريبة|تكلفة|سعر/
];

const STRATEGIC_CREATIVE_SUBMISSION_HINTS = [
  /strategic planning|strategic framework|strategy/i,
  /creative proposal|creative direction|creative concept/i,
  /campaign strategy|campaign concept/i,
  /brand strategy|brand positioning|messaging framework/i,
  /استراتيجي|إبداعي|الحملة|التموضع|الرسائل/
];

function isSubmissionDeliverableLine(line: string, category: DeliverableCategory): boolean {
  if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line))) {
    return false;
  }
  if (!isConcreteDeliverableLine(line)) {
    return false;
  }

  if (category === "technical") {
    return hasSignal(line, TECHNICAL_SUBMISSION_HINTS);
  }
  if (category === "commercial") {
    return hasSignal(line, COMMERCIAL_SUBMISSION_HINTS);
  }
  return hasSignal(line, STRATEGIC_CREATIVE_SUBMISSION_HINTS);
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
    if (startsSection) {
      inSection = true;
      sectionLineCount = 0;
      if (headingHint !== null) {
        currentHint = headingHint;
      }
      if (REQUIREMENT_LINE_PATTERNS.explicit.test(normalized)) {
        out.push({
          text: normalized,
          hint: currentHint,
          explicit: true,
          origin: "section"
        });
        sectionLineCount += 1;
      }
      continue;
    }

    if (inSection && headingHint !== null) {
      currentHint = headingHint;
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

    const explicit = REQUIREMENT_LINE_PATTERNS.explicit.test(normalized) || looksLikeRequirementStatement(normalized);
    if (!explicit && normalized.split(/\s+/).length < 3) {
      continue;
    }

    out.push({
      text: normalized,
      hint: currentHint,
      explicit,
      origin: "section"
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
  const allCandidates = scopedLines;

  const deduped = new Set<string>();
  const out: DeliverableItem[] = [];

  for (const candidate of allCandidates) {
    for (const clause of splitRequirementClauses(candidate)) {
      const clean = cleanDeliverableRequirementText(clause);
      if (!clean || clean.length < 5) {
        continue;
      }

      if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(clean))) {
        continue;
      }
      if (!isConcreteDeliverableLine(clean)) {
        continue;
      }

      if (!/proposal|submission|cv|resume|certificate|payment|pricing|commercial|financial|methodology|credentials|references|عرض|تقديم|مطلوب|شهادة|سيرة|الخبرات|الدفع|مالي|فني/i.test(clean)) {
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

      if (out.length >= 40) {
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

function emptyDeliverableRequirements(): DeliverableRequirements {
  return {
    technical: [],
    commercial: [],
    strategicCreative: []
  };
}

function hasDeliverableRequirementContent(value: DeliverableRequirements): boolean {
  return (
    value.technical.length > 0 ||
    value.commercial.length > 0 ||
    value.strategicCreative.length > 0
  );
}

function normalizeCategoryItems(
  category: DeliverableCategory,
  items: Array<{ title: string; description: string; source: "verbatim" | "inferred"; evidenceRef?: string }>
): DeliverableRequirementItem[] {
  const byTitle = new Map<string, DeliverableRequirementItem>();

  for (const item of items) {
    const cleanTitle = truncateAtWordBoundary(normalizeRequirementLine(item.title), 110);
    const cleanDescription = truncateAtWordBoundary(
      cleanDeliverableRequirementText(item.description || item.title),
      220
    );
    const cleanEvidenceRef = truncateAtWordBoundary(
      cleanDeliverableRequirementText(item.evidenceRef || item.description || item.title),
      180
    );

    if (!cleanDescription || cleanDescription.length < 6) {
      continue;
    }
    if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(cleanDescription))) {
      continue;
    }
    const explicitRequirement = looksLikeRequirementStatement(cleanDescription);
    if (!isConcreteDeliverableLine(cleanDescription) && !explicitRequirement) {
      continue;
    }
    if (!isSubmissionDeliverableLine(cleanDescription, category)) {
      continue;
    }

    const resolvedTitle = cleanTitle || inferDeliverableTitle(cleanDescription, category);
    const normalizedTitle = normalizeDedupeKey(resolvedTitle);
    if (!normalizedTitle) {
      continue;
    }
    const existing = byTitle.get(normalizedTitle);
    const candidate: DeliverableRequirementItem = {
      title: resolvedTitle,
      description: cleanDescription,
      source: item.source,
      evidenceRef: cleanEvidenceRef || undefined
    };

    if (!existing) {
      byTitle.set(normalizedTitle, candidate);
    } else {
      const existingScore =
        (existing.source === "verbatim" ? 2 : 0) +
        Math.min(existing.description.length / 80, 3);
      const candidateScore =
        (candidate.source === "verbatim" ? 2 : 0) +
        Math.min(candidate.description.length / 80, 3);
      if (candidateScore > existingScore) {
        byTitle.set(normalizedTitle, candidate);
      }
    }

    if (byTitle.size >= MAX_DELIVERABLES_PER_CATEGORY) {
      break;
    }
  }

  return Array.from(byTitle.values()).slice(0, MAX_DELIVERABLES_PER_CATEGORY);
}

function buildDeliverableRequirementsFromClaude(
  claude: ClaudeExtractedFields
): DeliverableRequirements {
  if (!claude.deliverableRequirements) {
    return emptyDeliverableRequirements();
  }

  return {
    technical: normalizeCategoryItems("technical", claude.deliverableRequirements.technical),
    commercial: normalizeCategoryItems("commercial", claude.deliverableRequirements.commercial),
    strategicCreative: normalizeCategoryItems("strategicCreative", claude.deliverableRequirements.strategicCreative)
  };
}

function mergeDeliverableRequirements(
  primary: DeliverableRequirements,
  fallback: DeliverableRequirements
): DeliverableRequirements {
  const mergeCategory = (
    first: DeliverableRequirementItem[],
    second: DeliverableRequirementItem[]
  ): DeliverableRequirementItem[] => {
    const mergedByTitle = new Map<string, DeliverableRequirementItem>();
    for (const item of [...first, ...second]) {
      const normalizedTitle = normalizeDedupeKey(item.title);
      if (!normalizedTitle) {
        continue;
      }
      const existing = mergedByTitle.get(normalizedTitle);
      if (!existing) {
        mergedByTitle.set(normalizedTitle, item);
        continue;
      }

      const existingScore =
        (existing.source === "verbatim" ? 2 : 0) +
        Math.min(existing.description.length / 80, 3);
      const candidateScore =
        (item.source === "verbatim" ? 2 : 0) +
        Math.min(item.description.length / 80, 3);
      if (candidateScore > existingScore) {
        mergedByTitle.set(normalizedTitle, item);
      }
    }
    return Array.from(mergedByTitle.values()).slice(0, MAX_DELIVERABLES_PER_CATEGORY);
  };

  return {
    technical: mergeCategory(primary.technical, fallback.technical),
    commercial: mergeCategory(primary.commercial, fallback.commercial),
    strategicCreative: mergeCategory(primary.strategicCreative, fallback.strategicCreative)
  };
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
    source: "verbatim" | "inferred",
    evidenceRef?: string
  ): void => {
    const cleanTitle = title.replace(/\s+/g, " ").trim();
    const cleanDescription = truncateAtWordBoundary(description.replace(/\s+/g, " ").trim(), 220);
    const cleanEvidenceRef = evidenceRef
      ? truncateAtWordBoundary(evidenceRef.replace(/\s+/g, " ").trim(), 180)
      : truncateAtWordBoundary(cleanDescription, 180);
    if (!cleanTitle || !cleanDescription) {
      return;
    }
    if (cleanDescription.split(/\s+/).length < 3) {
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
      source,
      evidenceRef: cleanEvidenceRef || undefined
    });
  };

  const sectionLines = collectDeliverableSectionLines(text);
  const candidateLines = sectionLines.slice(0, 1200);
  for (const candidateLine of candidateLines) {
    for (const clause of splitRequirementClauses(candidateLine.text)) {
      const line = cleanDeliverableRequirementText(clause);
      if (!line || line.length < 8) {
        continue;
      }

      if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line))) {
        continue;
      }

      const category =
        candidateLine.origin === "evaluation"
          ? "strategicCreative"
          : candidateLine.hint !== "unknown"
            ? candidateLine.hint
            : classifyDeliverableCategory(line);
      if (!category) {
        continue;
      }

      if (!isSubmissionDeliverableLine(line, category)) {
        continue;
      }

      const explicitSignal =
        candidateLine.explicit ||
        REQUIREMENT_LINE_PATTERNS.explicit.test(line) ||
        /must|shall|required|should include|to include|submitted?|provide|عرض|تقديم|مطلوب|يجب/i.test(line);

      const strongSignal =
        category === "technical"
          ? hasSignal(line, TECHNICAL_REQUIREMENT_SIGNALS)
          : category === "commercial"
            ? hasSignal(line, COMMERCIAL_REQUIREMENT_SIGNALS)
            : hasSignal(line, STRATEGIC_CREATIVE_REQUIREMENT_SIGNALS);

      if (!strongSignal && !explicitSignal) {
        continue;
      }

      // Keep deliverables actionable; discard narrative/legal boilerplate.
      if (candidateLine.origin === "section" && !looksLikeRequirementStatement(line) && !strongSignal) {
        continue;
      }

      if (
        candidateLine.origin === "section" &&
        !explicitSignal &&
        line.split(/\s+/).length < 8
      ) {
        continue;
      }

      if (category === "commercial" && !hasSignal(line, COMMERCIAL_REQUIREMENT_SIGNALS) && !explicitSignal) {
        continue;
      }

      if (category === "technical" && !hasSignal(line, TECHNICAL_REQUIREMENT_SIGNALS) && !explicitSignal) {
        continue;
      }

      if (category === "strategicCreative" && !hasSignal(line, STRATEGIC_CREATIVE_REQUIREMENT_SIGNALS) && !explicitSignal) {
        continue;
      }

      const source: "verbatim" | "inferred" =
        candidateLine.origin === "evaluation"
          ? "inferred"
          : (candidateLine.explicit || explicitSignal ? "verbatim" : "inferred");
      addItem(category, inferDeliverableTitle(line, category), line, source, candidateLine.text);
    }
  }

  for (const deliverable of requiredDeliverables) {
    const clean = cleanDeliverableRequirementText(deliverable.item);
    if (!clean || clean.length < 8) {
      continue;
    }
    if (!isConcreteDeliverableLine(clean)) {
      continue;
    }
    const category = classifyDeliverableCategory(clean);
    if (!category) {
      continue;
    }
    addItem(category, inferDeliverableTitle(clean, category), clean, deliverable.source, clean);
  }

  const hasStrategicSignal =
    REQUIREMENT_LINE_PATTERNS.strategicCreative.test(text) ||
    REQUIREMENT_LINE_PATTERNS.strategicCreative.test(evaluationCriteria);

  if (grouped.technical.length === 0) {
    addItem(
      "technical",
      "Technical Proposal Submission",
      "Prepare a technical proposal with methodology, team credentials, and relevant experience aligned to the RFP scope.",
      "inferred",
      "Technical proposal with methodology, team credentials, and relevant experience"
    );
  }
  if (grouped.commercial.length === 0) {
    addItem(
      "commercial",
      "Commercial Proposal Submission",
      "Prepare a commercial/financial proposal including pricing structure and payment terms as required by the RFP.",
      "inferred",
      "Commercial proposal with pricing structure and payment terms"
    );
  }
  if (grouped.strategicCreative.length === 0 && hasStrategicSignal) {
    addItem(
      "strategicCreative",
      "Strategic and Creative Proposal",
      "Develop a strategic and creative proposal responding to brand strategy, positioning, and campaign creativity criteria in the RFP.",
      "inferred",
      "Strategic and creative proposal aligned with brand strategy and campaign criteria"
    );
  }

  grouped.technical = grouped.technical.slice(0, MAX_DELIVERABLES_PER_CATEGORY);
  grouped.commercial = grouped.commercial.slice(0, MAX_DELIVERABLES_PER_CATEGORY);
  grouped.strategicCreative = grouped.strategicCreative.slice(0, MAX_DELIVERABLES_PER_CATEGORY);

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
  const normalizedInput = input.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const lines = normalizedInput.split(/\r?\n/);
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
    .split(/\r?\n|\\r\\n|\\n/)
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
  const keepSignalPattern =
    /(proposal|submit|submission|deliverable|certificate|credentials?|portfolio|track record|references?|\\bcv\\b|resume|methodology|approach|team|payment terms?|pricing|tax|commercial|financial|technical|عرض|تقديم|شهادة|سيرة|الدفع|مالي|فني)/i;
  const verbatimDropPatterns = [
    /referred to as.*vendor/i,
    /no clarification.*binding/i,
    /legal validity whatsoever/i,
    /accepts no liability/i,
    /no vendor may add/i,
    /proposal documents will be submitted to/i
  ];

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

    if (verbatimDropPatterns.some((pattern) => pattern.test(cleaned))) {
      continue;
    }

    if (!keepSignalPattern.test(cleaned)) {
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

function ensureRequiredDeliverables(
  items: DeliverableItem[],
  grouped: DeliverableRequirements
): DeliverableItem[] {
  const deduped = dedupeDeliverables(items);
  if (deduped.length > 0) {
    return deduped;
  }

  const inferred: DeliverableItem[] = [];
  const pushFromCategory = (categoryItems: DeliverableRequirementItem[]): void => {
    for (const item of categoryItems.slice(0, 2)) {
      const candidate = item.title?.trim() || item.description?.trim();
      if (!candidate) {
        continue;
      }
      inferred.push({
        item: truncateAtWordBoundary(candidate, 140),
        source: item.source ?? "inferred"
      });
    }
  };

  pushFromCategory(grouped.technical);
  pushFromCategory(grouped.commercial);
  pushFromCategory(grouped.strategicCreative);

  if (inferred.length === 0) {
    inferred.push(
      {
        item: "Technical Proposal Submission",
        source: "inferred"
      },
      {
        item: "Commercial Proposal Submission",
        source: "inferred"
      }
    );
  }

  return dedupeDeliverables(inferred);
}

const SCOPE_NON_WORK_PATTERNS = [
  /submission deadline/i,
  /intent to tender/i,
  /deadline for questions/i,
  /responses?\s+to\s+questions?/i,
  /proposal submission deadline/i,
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
  /^نطاق العمل$/i
];

const SCOPE_PHASE_TITLE_PATTERNS = [
  /^(?:\d+[\.\)]\s*)?phase\s*\d+[:\s]/i,
  /^(?:\d+[\.\)]\s*)?program phases?(?:\s*\(.*\))?$/i,
  /^(?:\d+[\.\)]\s*)?research and analysis\s*\/\s*benchmarks$/i,
  /^(?:\d+[\.\)]\s*)?strategic foundation and alignment$/i,
  /^(?:\d+[\.\)]\s*)?local brand and launch campaign strategy development$/i,
  /^(?:\d+[\.\)]\s*)?local design system$/i,
  /^(?:\d+[\.\)]\s*)?brand book$/i,
  /^(?:\d+[\.\)]\s*)?post-?launch plan$/i,
  /^(?:\d+[\.\)]\s*)?project management$/i
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
  const fallbackCandidates: string[] = [];

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

    if (!cleaned || cleaned.length < 8) {
      continue;
    }

    const normalized = normalizeDedupeKey(cleaned);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    if (SCOPE_HEADING_PATTERNS.some((pattern) => pattern.test(cleaned))) {
      continue;
    }

    const isPhaseTitle = SCOPE_PHASE_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned));
    const isNonWork = SCOPE_NON_WORK_PATTERNS.some((pattern) => pattern.test(cleaned));
    if (isNonWork && !SCOPE_ACTION_VERB_PATTERN.test(cleaned)) {
      continue;
    }

    // Drop short category labels and phase titles; keep concrete action lines.
    const wordCount = cleaned.split(/\s+/).length;
    const hasActionVerb = SCOPE_ACTION_VERB_PATTERN.test(cleaned);
    if ((!hasActionVerb && wordCount <= 6) || isPhaseTitle) {
      // Keep as fallback candidate in case model output is sparse.
      if (!isNonWork) {
        fallbackCandidates.push(cleaned);
      }
      continue;
    }

    seen.add(normalized);
    workItems.push(cleaned);

    if (workItems.length >= MAX_SCOPE_ITEMS_FOR_ANALYSIS) {
      break;
    }
  }

  if (workItems.length === 0) {
    const softCandidates = fallbackCandidates.length > 0
      ? fallbackCandidates
      : scopeText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^#{1,6}\s*/, "").trim())
        .filter((line) => line.length >= 8)
        .filter((line) => !SCOPE_HEADING_PATTERNS.some((pattern) => pattern.test(line)))
        .filter((line) => !SCOPE_NON_WORK_PATTERNS.some((pattern) => pattern.test(line)));
    return softCandidates.slice(0, 12).map((line) => `• ${line}`).join("\n");
  }

  return workItems.map((item) => `• ${item}`).join("\n");
}

function countScopeItems(scopeText: string): number {
  return scopeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("• "))
    .length;
}

function scopeQualityScore(scopeText: string): number {
  const items = countScopeItems(scopeText);
  if (items === 0) {
    return 0;
  }
  const actionCount = scopeText
    .split(/\r?\n/)
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter((line) => SCOPE_ACTION_VERB_PATTERN.test(line)).length;
  return items * 2 + actionCount;
}

function buildScopeFromSource(parsedDocument: AnalyzeRfpInput["parsedDocument"]): string {
  const text = parsedDocument.rawText;
  const scopeFromSection = bySectionName(text, parsedDocument.sections, ["scope_of_work"]);
  const scopeFromHeading = extractExactBlock(
    text,
    /scope\s+of\s+work|statement\s+of\s+work|services\s+required|نطاق\s+العمل/i,
    5000
  );
  const candidates = [scopeFromSection, scopeFromHeading]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => sanitizeScopeForAnalysis(normalizeStructuredText(value)))
    .filter((value) => value.trim().length > 0);

  if (candidates.length === 0) {
    return "";
  }

  candidates.sort((a, b) => scopeQualityScore(b) - scopeQualityScore(a));
  return candidates[0] ?? "";
}

function chooseBestScopeScopeText(claudeScope: string, sourceScope: string): string {
  const claudeScore = scopeQualityScore(claudeScope);
  const sourceScore = scopeQualityScore(sourceScope);
  if (sourceScore >= claudeScore + 2) {
    return sourceScope;
  }
  if (claudeScore === 0 && sourceScore > 0) {
    return sourceScope;
  }
  return claudeScope || sourceScope;
}

function buildScopeFromDeliverableSignals(
  requiredDeliverables: DeliverableItem[],
  deliverableRequirements: DeliverableRequirements
): string {
  const candidates: string[] = [];
  for (const item of requiredDeliverables) {
    const clean = normalizeRequirementLine(item.item);
    if (clean.length >= 12) {
      candidates.push(clean);
    }
  }

  const grouped = [
    ...deliverableRequirements.technical,
    ...deliverableRequirements.strategicCreative
  ];
  for (const item of grouped) {
    const title = normalizeRequirementLine(item.title);
    const description = normalizeRequirementLine(item.description);
    const combined = title && description ? `${title}: ${description}` : title || description;
    if (combined.length >= 14) {
      candidates.push(combined);
    }
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeDedupeKey(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(candidate);
    if (deduped.length >= 12) {
      break;
    }
  }
  return deduped.map((line) => `• ${truncateAtWordBoundary(line, 180)}`).join("\n");
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

function parseEvaluationWeight(value: string): string | null {
  const match = value.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!match?.[1]) {
    return null;
  }
  return `${match[1]}%`;
}

function normalizeEvaluationGroupTitle(value: string): string {
  return truncateAtWordBoundary(
    normalizeRequirementLine(value)
      .replace(/^(\d+)[.)]\s*/, "")
      .replace(/\(\s*weight[^)]*\)/i, "")
      .trim(),
    140
  );
}

function buildEvaluationCriteriaStructuredFromText(criteriaText: string): EvaluationCriteriaGroup[] {
  const lines = criteriaText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const groups: EvaluationCriteriaGroup[] = [];
  let current: EvaluationCriteriaGroup | null = null;

  const pushCurrent = (): void => {
    if (!current) {
      return;
    }
    current.items = current.items
      .map((item) => truncateAtWordBoundary(item, 220))
      .filter((item) => item.length >= 8)
      .slice(0, 8);
    current.evidenceRefs = Array.from(new Set(current.evidenceRefs)).slice(0, 8);
    if (current.title && current.items.length > 0) {
      groups.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    const cleaned = normalizeRequirementLine(line);
    if (!cleaned || EVALUATION_HEADING_NOISE.some((pattern) => pattern.test(cleaned))) {
      continue;
    }

    const upperColonMatch = cleaned.match(/^([A-Z][A-Z0-9\s,&/]{6,140})\s*:\s*(.{12,})$/);
    if (upperColonMatch?.[1] && upperColonMatch[2]) {
      pushCurrent();
      current = {
        title: normalizeEvaluationGroupTitle(upperColonMatch[1]) || "Evaluation Criterion",
        weight: parseEvaluationWeight(cleaned),
        items: [truncateAtWordBoundary(upperColonMatch[2].trim(), 220)],
        evidenceRefs: [truncateAtWordBoundary(cleaned, 180)]
      };
      continue;
    }

    const headingMatch = cleaned.match(/^(\d+)\.\s+(.+)$/) ?? cleaned.match(/^([A-Z][A-Za-z\s&/]{8,120})(?:\s*\(|\s*-\s*weight)/);
    if (headingMatch) {
      pushCurrent();
      const rawTitle = headingMatch[2] ?? headingMatch[1] ?? cleaned;
      current = {
        title: normalizeEvaluationGroupTitle(rawTitle) || "Evaluation Criterion",
        weight: parseEvaluationWeight(cleaned),
        items: [],
        evidenceRefs: [truncateAtWordBoundary(cleaned, 180)]
      };
      continue;
    }

    const bullet = cleaned.replace(/^•\s*/, "").trim();
    if (bullet.length < 8) {
      continue;
    }

    if (!current) {
      current = {
        title: "Evaluation Criteria",
        weight: null,
        items: [],
        evidenceRefs: []
      };
    }
    current.items.push(bullet);
    current.evidenceRefs.push(truncateAtWordBoundary(bullet, 180));
  }

  pushCurrent();
  return groups.slice(0, 8);
}

function formatEvaluationCriteriaStructured(groups: EvaluationCriteriaGroup[]): string {
  if (groups.length === 0) {
    return "Evaluation criteria not explicitly found.";
  }

  const lines: string[] = [];
  groups.forEach((group, idx) => {
    const suffix = group.weight ? ` (Weight ${group.weight})` : " (Weight not specified)";
    lines.push(`${idx + 1}. ${group.title}${suffix}`);
    group.items.slice(0, 8).forEach((item) => {
      lines.push(`• ${truncateAtWordBoundary(item, 220)}`);
    });
  });

  return lines.join("\n");
}

function splitEvaluationSentences(line: string): string[] {
  return line
    .split(/(?<=[.;!?؟])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12)
    .map((part) => part.replace(/[.;]+$/g, "").trim());
}

function sanitizeEvaluationCriteria(criteriaText: string): string {
  const normalizedCriteria = criteriaText.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  const lines = normalizedCriteria.split(/\r?\n/);
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

    let inlineTail: string | null = null;
    const weightedInlineMatch = line.match(/^(\d+\.\s+.+?\(\s*weight[^)]*\))\s+(.{24,})$/i);
    if (weightedInlineMatch?.[1] && weightedInlineMatch[2]) {
      line = weightedInlineMatch[1].trim();
      inlineTail = weightedInlineMatch[2].trim();
    } else {
      const colonInlineMatch = line.match(/^(\d+\.\s+[^:]{8,140}:)\s+(.{24,})$/i);
      if (colonInlineMatch?.[1] && colonInlineMatch[2]) {
        line = colonInlineMatch[1].trim();
        inlineTail = colonInlineMatch[2].trim();
      }
    }

    const dedupeKey = normalizeDedupeKey(line);
    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    // Detect numbered headings like "1. Technical" OR weighted headings like "Technical Evaluation (40%)"
    const isNumberedHeading = /^\d+\.\s/.test(line);
    const isWeightedHeading = /^[A-Z][A-Za-z\s]{5,60}\s*[\(\-–]\s*\d+\s*%/.test(line);
    if (isNumberedHeading || isWeightedHeading) {
      previousWasNumberedHeading = inlineTail == null;
      output.push(isNumberedHeading ? line : `## ${line}`);
      if (inlineTail) {
        const sentenceParts = splitEvaluationSentences(inlineTail);
        const parts = sentenceParts.length > 0 ? sentenceParts : [inlineTail];
        for (const part of parts) {
          output.push(`• ${truncateAtWordBoundary(part, 220)}`);
        }
      }
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

function evaluationStructureScore(text: string): number {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const numberedHeadingCount = lines.filter((line) => /^\d+\.\s/.test(line)).length;
  const weightedHeadingCount = lines.filter((line) => /^(?:##\s+)?[A-Z][A-Za-z\s]{5,60}\s*[\(\-–]\s*\d+\s*%/.test(line)).length;
  const bulletCount = lines.filter((line) => /^•\s+/.test(line)).length;
  return (numberedHeadingCount + weightedHeadingCount) * 3 + bulletCount;
}

function buildEvaluationCriteriaFromTables(
  tables: AnalyzeRfpInput["parsedDocument"]["tables"]
): EvaluationCriteriaGroup[] {
  const grouped = new Map<string, EvaluationCriteriaGroup>();

  for (const table of tables) {
    const headers = table.headers.map((header) => header.toLowerCase());
    const criteriaColIndex = headers.findIndex((header) =>
      /(criteria|criterion|category|معيار|المعيار)/i.test(header)
    );
    const detailColIndex = headers.findIndex((header) =>
      /(description|details?|requirements?|weight|score|الوصف|تفاصيل|متطلبات|وزن)/i.test(header)
    );

    if (criteriaColIndex < 0 || detailColIndex < 0) {
      continue;
    }

    let currentGroup = "";
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex] ?? [];
      const groupCell = cleanDeliverableRequirementText(row[criteriaColIndex] ?? "");
      const detailCell = cleanDeliverableRequirementText(row[detailColIndex] ?? "");

      if (groupCell && !EVALUATION_HEADING_NOISE.some((pattern) => pattern.test(groupCell))) {
        currentGroup = normalizeEvaluationGroupTitle(groupCell);
      }

      const group = currentGroup;
      const detail = detailCell;
      if (!group || !detail) {
        continue;
      }
      if (detail.length < 8 || DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(detail))) {
        continue;
      }

      const key = normalizeDedupeKey(group);
      if (!key) {
        continue;
      }
      const existing = grouped.get(key) ?? {
        title: group,
        weight: parseEvaluationWeight(groupCell || detail),
        items: [],
        evidenceRefs: []
      };
      const dedupeKey = normalizeDedupeKey(detail);
      if (dedupeKey && !existing.items.some((entry) => normalizeDedupeKey(entry) === dedupeKey)) {
        existing.items.push(detail);
        existing.evidenceRefs.push(
          truncateAtWordBoundary(
            `Table ${table.title || "Evaluation criteria"} row ${rowIndex + 1}: ${detail}`,
            180
          )
        );
      }
      if (!existing.weight) {
        existing.weight = parseEvaluationWeight(detail);
      }
      grouped.set(key, existing);
    }
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: group.items.slice(0, 8),
      evidenceRefs: Array.from(new Set(group.evidenceRefs)).slice(0, 8)
    }))
    .filter((group) => group.title.length > 0 && group.items.length > 0)
    .slice(0, 8);
}

function buildEvaluationCriteriaFromSource(
  parsedDocument: AnalyzeRfpInput["parsedDocument"]
): { formatted: string; structured: EvaluationCriteriaGroup[] } {
  const text = parsedDocument.rawText;
  const sectionText = bySectionName(text, parsedDocument.sections, ["evaluation_criteria"]);
  const tableStructured = buildEvaluationCriteriaFromTables(parsedDocument.tables);
  const tableText = tableStructured.length > 0 ? formatEvaluationCriteriaStructured(tableStructured) : null;
  const headingText = extractExactBlock(text, /evaluation\s+criteria|technical\s+evaluation\s+criteria|معايير\s+التقييم/i, 3500);
  const candidates: Array<{ source: "section" | "table" | "heading"; value: string; structured: EvaluationCriteriaGroup[] }> = [];

  if (sectionText && sectionText.trim().length > 0) {
    const sanitized = sanitizeEvaluationCriteria(normalizeStructuredText(sectionText));
    candidates.push({
      source: "section",
      value: sanitized,
      structured: buildEvaluationCriteriaStructuredFromText(sanitized)
    });
  }
  if (tableText && tableText.trim().length > 0) {
    candidates.push({
      source: "table",
      value: sanitizeEvaluationCriteria(normalizeStructuredText(tableText)),
      structured: tableStructured
    });
  }
  if (headingText && headingText.trim().length > 0) {
    const sanitized = sanitizeEvaluationCriteria(normalizeStructuredText(headingText));
    candidates.push({
      source: "heading",
      value: sanitized,
      structured: buildEvaluationCriteriaStructuredFromText(sanitized)
    });
  }

  if (candidates.length === 0) {
    return {
      formatted: "Evaluation criteria not explicitly found.",
      structured: []
    };
  }

  const scoreCandidate = (candidate: { source: "section" | "table" | "heading"; value: string; structured: EvaluationCriteriaGroup[] }): number => {
    const clean = candidate.value.trim();
    if (!clean || /not explicitly found/i.test(clean)) {
      return 0;
    }
    const structure = evaluationStructureScore(clean);
    const length = Math.min(clean.length / 1800, 1);
    const groupBonus = Math.min(candidate.structured.length, 4) * 1.4;
    const tableBonus = candidate.source === "table" ? 2 : 0;
    return structure + length + groupBonus + tableBonus;
  };

  candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  const selected = candidates[0]!;
  return {
    formatted: selected.value,
    structured: selected.structured
  };
}

function chooseBestEvaluationCriteria(primary: string, fallback: string): string {
  const primaryClean = primary.trim();
  const fallbackClean = fallback.trim();
  const primaryMissing = /not explicitly found/i.test(primaryClean) || primaryClean.length < 80;
  const fallbackMissing = /not explicitly found/i.test(fallbackClean) || fallbackClean.length < 80;

  if (primaryMissing && !fallbackMissing) {
    return fallback;
  }
  if (fallbackMissing) {
    return primary;
  }

  const primaryScore = evaluationStructureScore(primary);
  const fallbackScore = evaluationStructureScore(fallback);

  if (fallbackScore >= primaryScore + 2) {
    return fallback;
  }
  if (fallbackScore > primaryScore && fallbackClean.length >= Math.floor(primaryClean.length * 0.75)) {
    return fallback;
  }
  if (fallbackScore === primaryScore && fallbackClean.length > Math.floor(primaryClean.length * 1.15)) {
    return fallback;
  }

  return primary;
}

function dedupeDeliverableRequirementCategory(
  items: DeliverableRequirementItem[]
): DeliverableRequirementItem[] {
  const byTitle = new Map<string, DeliverableRequirementItem>();
  const byDescription = new Map<string, DeliverableRequirementItem>();
  for (const item of items) {
    const title = item.title?.trim() ?? "";
    const description = item.description?.trim() ?? "";
    if (!title && !description) {
      continue;
    }
    const titleKey = normalizeDedupeKey(title);
    const descriptionKey = normalizeDedupeKey(description);
    const key = titleKey || descriptionKey;
    if (!key || (!titleKey && !descriptionKey)) {
      continue;
    }
    const existing = byTitle.get(key) ?? (descriptionKey ? byDescription.get(descriptionKey) : undefined);
    if (!existing) {
      byTitle.set(key, item);
      if (descriptionKey) {
        byDescription.set(descriptionKey, item);
      }
      continue;
    }

    const existingScore =
      (existing.source === "verbatim" ? 2 : 0) +
      (existing.evidenceRef ? 1 : 0) +
      Math.min(existing.description.length / 120, 2);
    const currentScore =
      (item.source === "verbatim" ? 2 : 0) +
      (item.evidenceRef ? 1 : 0) +
      Math.min(description.length / 120, 2);

    if (currentScore > existingScore) {
      byTitle.set(key, item);
      if (descriptionKey) {
        byDescription.set(descriptionKey, item);
      }
    }
  }
  const unique = dedupeDeliverableItems(Array.from(byTitle.values()));
  return unique.slice(0, MAX_DELIVERABLES_PER_CATEGORY);
}

function dedupeDeliverableItems(items: DeliverableRequirementItem[]): DeliverableRequirementItem[] {
  const seen = new Set<string>();
  const out: DeliverableRequirementItem[] = [];
  for (const item of items) {
    const titleKey = normalizeDedupeKey(item.title);
    const descKey = normalizeDedupeKey(item.description);
    const key = `${titleKey}|${descKey}`;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
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
  extractionResult: ClaudeExtractionResult,
  parsedDocument: AnalyzeRfpInput["parsedDocument"]
): Pass1Output {
  const claude: ClaudeExtractedFields = extractionResult.fields;
  const coverage = extractionResult.coverage;
  const text = parsedDocument.rawText;
  const warnings: string[] = [...(parsedDocument.warnings ?? [])];
  if (coverage.coveragePercent < 0.995) {
    warnings.push("Document coverage is incomplete; some chunks were not analyzed successfully.");
  }
  if (coverage.missingSectionTags.length > 0) {
    warnings.push(`Missing section hints: ${coverage.missingSectionTags.join(", ")}.`);
  }
  const sourceEvaluation = buildEvaluationCriteriaFromSource(parsedDocument);
  const claudeEvaluation = sanitizeEvaluationCriteria(
    normalizeStructuredText(claude.evaluationCriteria || "Evaluation criteria not explicitly found.")
  );
  const candidateEvaluation = chooseBestEvaluationCriteria(claudeEvaluation, sourceEvaluation.formatted);
  const evaluationCriteriaStructured =
    sourceEvaluation.structured.length >= 2
      ? sourceEvaluation.structured
      : buildEvaluationCriteriaStructuredFromText(candidateEvaluation);
  const mergedEvaluation =
    evaluationCriteriaStructured.length >= 2
      ? formatEvaluationCriteriaStructured(evaluationCriteriaStructured)
      : candidateEvaluation;
  const requiredDeliverables = dedupeDeliverables(
    claude.requiredDeliverables.map((d) => ({
      item: typeof d === "string" ? d : d.item,
      source: (typeof d === "string" ? "verbatim" : d.source) as "verbatim" | "inferred"
    }))
  );
  const claudeDeliverableRequirements = buildDeliverableRequirementsFromClaude(claude);
  const allowHeuristicDeliverableFallback =
    process.env.ALLOW_HEURISTIC_DELIVERABLE_FALLBACK !== "0";
  const heuristicDeliverableRequirements = allowHeuristicDeliverableFallback
    ? buildDeliverableRequirements(
      text,
      mergedEvaluation,
      requiredDeliverables
    )
    : { technical: [], commercial: [], strategicCreative: [] };

  function mergeCategory(
    primary: DeliverableRequirementItem[],
    secondary: DeliverableRequirementItem[],
    minItems: number
  ): DeliverableRequirementItem[] {
    const combined = [...primary];
    if (combined.length < minItems) {
      for (const candidate of secondary) {
        combined.push(candidate);
        if (combined.length >= minItems + 4) {
          break;
        }
      }
    }
    return dedupeDeliverableRequirementCategory(combined);
  }
  const mergedDeliverableRequirements: DeliverableRequirements = {
    technical: mergeCategory(claudeDeliverableRequirements.technical, heuristicDeliverableRequirements.technical, 5),
    commercial: mergeCategory(claudeDeliverableRequirements.commercial, heuristicDeliverableRequirements.commercial, 3),
    strategicCreative: mergeCategory(claudeDeliverableRequirements.strategicCreative, heuristicDeliverableRequirements.strategicCreative, 3)
  };
  if (!allowHeuristicDeliverableFallback) {
    const hasAnyDeliverableRequirement =
      mergedDeliverableRequirements.technical.length > 0 ||
      mergedDeliverableRequirements.commercial.length > 0 ||
      mergedDeliverableRequirements.strategicCreative.length > 0;
    if (!hasAnyDeliverableRequirement) {
      warnings.push("Deliverable requirement groups were not confidently extracted from AI output.");
    }
  }
  const canonicalRequiredDeliverables = ensureRequiredDeliverables(
    requiredDeliverables,
    mergedDeliverableRequirements
  );
  let selectedScope = chooseBestScopeScopeText(
    sanitizeScopeForAnalysis(normalizeStructuredText(claude.scopeOfWork || "")),
    buildScopeFromSource(parsedDocument)
  );
  if (countScopeItems(selectedScope) < 2) {
    const synthesizedScope = buildScopeFromDeliverableSignals(
      canonicalRequiredDeliverables,
      mergedDeliverableRequirements
    );
    if (countScopeItems(synthesizedScope) >= 2) {
      selectedScope = synthesizedScope;
      warnings.push("Scope was reconstructed from deliverable signals due sparse direct scope extraction.");
    }
  }

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
    scopeOfWork: selectedScope,
    evaluationCriteria: mergedEvaluation,
    evaluationCriteriaStructured,
    requiredDeliverables: canonicalRequiredDeliverables,
    deliverableRequirements: mergedDeliverableRequirements,
    importantDates,
    submissionRequirements: {
      method: claude.submissionRequirements?.method || "Unknown",
      email: claude.submissionRequirements?.email ?? null,
      physicalAddress: claude.submissionRequirements?.physicalAddress ?? null,
      format: claude.submissionRequirements?.format || "Unspecified",
      copies: claude.submissionRequirements?.copies ?? null,
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
  const warnings: string[] = ["AI extraction failed; using deterministic fallback."];

  const clientName =
    findLineValue(text, ["Client", "Client Name", "Issuer", "العميل"]) ??
    "Unknown Client";

  const projectName =
    findLineValue(text, ["Project", "Project Name", "RFP", "اسم المشروع"]) ??
    "Untitled Project";

  const scopeFromSection = bySectionName(text, input.parsedDocument.sections, ["scope_of_work"]);
  const scopeFromHeading = extractExactBlock(text, /scope\s+of\s+work|نطاق\s+العمل/i, 2000);
  const scopeOfWork = scopeFromSection ?? scopeFromHeading ?? "Scope of work not explicitly found.";

  if (!scopeFromSection && !scopeFromHeading) {
    warnings.push("Scope section not clearly detected; fallback extraction used.");
  }

  const evalFromSection = bySectionName(text, input.parsedDocument.sections, ["evaluation_criteria"]);
  const evalFromHeading = extractExactBlock(text, /evaluation\s+criteria|معايير\s+التقييم/i, 1500);
  const sourceEvaluation = buildEvaluationCriteriaFromSource(input.parsedDocument);
  const evaluationCriteria = sourceEvaluation.formatted;
  const evaluationCriteriaStructured =
    sourceEvaluation.structured.length > 0
      ? sourceEvaluation.structured
      : buildEvaluationCriteriaStructuredFromText(
        sanitizeEvaluationCriteria(normalizeStructuredText(evaluationCriteria))
      );

  if (!evalFromSection && !evalFromHeading) {
    warnings.push("Evaluation criteria section not clearly detected.");
  }

  const requiredDeliverables = extractDeliverables(text);
  const importantDates = extractDates(text);
  const submissionRequirements = extractSubmission(text);
  const dedupedRequiredDeliverables = dedupeDeliverables(requiredDeliverables);
  const deliverableRequirements = buildDeliverableRequirements(
    text,
    sanitizeEvaluationCriteria(normalizeStructuredText(evaluationCriteria)),
    dedupedRequiredDeliverables
  );
  const canonicalRequiredDeliverables = ensureRequiredDeliverables(
    dedupedRequiredDeliverables,
    deliverableRequirements
  );

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
    evaluationCriteriaStructured,
    requiredDeliverables: canonicalRequiredDeliverables,
    deliverableRequirements,
    importantDates,
    submissionRequirements,
    warnings,
    evidence,
    confidenceScores
  };
}

function shouldAllowRegexFallback(): boolean {
  if (process.env.RFP_ALLOW_REGEX_FALLBACK === "1") {
    return true;
  }
  // Allow deterministic fallback in tests so CI is stable without external API calls.
  if (process.env.NODE_ENV === "test") {
    return true;
  }
  return false;
}

export async function runPass1Extraction(input: AnalyzeRfpInput): Promise<Pass1Output> {
  // Try AI extraction first
  try {
    const extractionResult = await extractWithClaude(input.parsedDocument.rawText);
    return mapClaudeToPass1Output(extractionResult, input.parsedDocument);
  } catch (error) {
    console.error(
      "AI extraction failed, using fallback:",
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
    );
    if (!shouldAllowRegexFallback()) {
      throw new Error(
        "AI extraction failed in high-assurance mode; deterministic fallback is disabled."
      );
    }
    return runPass1ExtractionFallback(input);
  }
}
