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

function stripSectionHeadingPrefix(line: string): string {
  return line
    .replace(/^\s*(?:[IVXLCM]+|\d+)\s*[\.\)]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
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

function looksLikeMajorHeadingLine(rawLine: string): boolean {
  const line = stripSectionHeadingPrefix(rawLine.trim());
  if (!line) {
    return false;
  }
  if (/^#{1,6}\s+/.test(line)) {
    return true;
  }
  if (/^(?:\d+[\.\)]|[IVXLC]+\.)\s+[A-Z\u0600-\u06FF]/.test(line) && line.length <= 120) {
    return true;
  }
  if (/^[A-Z][A-Z0-9\s&/\-]{6,100}$/.test(line)) {
    return true;
  }
  if (/^[\u0600-\u06FF][\u0600-\u06FF\s]{4,90}$/.test(line) && !/[.!?؟،]/.test(line)) {
    return true;
  }
  return /^(scope of work|evaluation criteria|submission format|important dates?|deliverables|timeline|technical evaluation criteria|commercial proposals?\s+should\s+include)/i.test(
    line
  );
}

function extractExactBlock(text: string, headingRegex: RegExp, fallbackLength: number): string | null {
  const match = headingRegex.exec(text);
  if (!match) {
    return null;
  }

  const start = match.index;
  const tail = text.slice(start + match[0].length);
  const lines = tail.split(/\r?\n/);
  let consumed = 0;
  for (const line of lines) {
    const increment = line.length + 1;
    if (consumed > 0 && looksLikeMajorHeadingLine(line)) {
      break;
    }
    if (consumed + increment > fallbackLength) {
      consumed = fallbackLength;
      break;
    }
    consumed += increment;
  }

  const end = Math.min(text.length, start + match[0].length + consumed);
  return text.slice(start, end).trim();
}

function extractAllExactBlocks(text: string, headingPatterns: RegExp[], fallbackLength: number): string[] {
  const blocks: string[] = [];
  for (const pattern of headingPatterns) {
    const block = extractExactBlock(text, pattern, fallbackLength);
    if (block && block.trim().length > 0) {
      blocks.push(block.trim());
    }
  }
  return dedupeStrings(blocks);
}

function extractSectionSpans(
  text: string,
  sections: AnalyzeRfpInput["parsedDocument"]["sections"],
  names: string[]
): string[] {
  const spans = sections
    .filter((section) => names.includes(section.name))
    .map((section) => {
      if (
        section.startOffset < 0 ||
        section.endOffset <= section.startOffset ||
        section.endOffset > text.length
      ) {
        return "";
      }
      return text.slice(section.startOffset, section.endOffset).trim();
    })
    .filter(Boolean);
  return dedupeStrings(spans);
}

function buildSectionScopedText(
  text: string,
  sections: AnalyzeRfpInput["parsedDocument"]["sections"],
  names: string[],
  headingPatterns: RegExp[],
  fallbackLength: number
): string {
  const sectionBlocks = extractSectionSpans(text, sections, names);
  const headingBlocks = extractAllExactBlocks(text, headingPatterns, fallbackLength);
  return dedupeStrings([...sectionBlocks, ...headingBlocks]).join("\n\n").trim();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function collectHeadingWindowLines(
  text: string,
  headingPatterns: RegExp[],
  stopPatterns: RegExp[],
  maxLines: number,
  maxChars: number
): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inWindow = false;
  let consumedLines = 0;
  let consumedChars = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) {
      continue;
    }
    const normalizedLine = stripSectionHeadingPrefix(line);

    const startsWindow = headingPatterns.some((pattern) => pattern.test(line) || pattern.test(normalizedLine));
    const stopsWindow = stopPatterns.some((pattern) => pattern.test(line) || pattern.test(normalizedLine));

    if (startsWindow) {
      inWindow = true;
      consumedLines = 0;
      consumedChars = 0;
      out.push(line);
      continue;
    }

    if (!inWindow) {
      continue;
    }

    if (stopsWindow && consumedLines > 0) {
      inWindow = false;
      continue;
    }

    out.push(line);
    consumedLines += 1;
    consumedChars += line.length;
    if (consumedLines >= maxLines || consumedChars >= maxChars) {
      inWindow = false;
    }
  }

  return dedupeStrings(out);
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

  const monthLookup: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12"
  };
  const dayMonthYear = raw.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))\b/i
  );
  if (dayMonthYear?.[1] && dayMonthYear[2] && dayMonthYear[3]) {
    const dd = dayMonthYear[1].padStart(2, "0");
    const mm = monthLookup[dayMonthYear[2].toLowerCase()];
    const yyyy = dayMonthYear[3];
    if (mm) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return null;
}

const DATE_EVENT_HINT_PATTERN =
  /(issued|intent|deadline|question|response|submission|presentation|closing|opening|تاريخ|موعد|آخر موعد|تقديم|استفسار|ردود|عرض)/i;
const DATE_HEADING_CONTEXT_PATTERN =
  /(important dates?|timeline|milestones?|deadlines?|submission schedule|schedule|الجدول الزمني|المواعيد)/i;
const DATE_NON_EVENT_NOISE_PATTERN =
  /(address|street|building|floor|district|p\.?o\.?\s*box|postal|zip|avenue|road|blvd|suite|unit|city|region|حي|شارع|مبنى|طابق|صندوق بريد|prepared by|procurement department)/i;

function extractDates(text: string): Array<{ title: string; date: string; type: string; isCritical: boolean }> {
  const lines = text.split(/\r?\n/);
  const out: Array<{ title: string; date: string; type: string; isCritical: boolean }> = [];
  let inDateContext = false;
  let dateContextCountdown = 0;

  for (const line of lines) {
    const normalizedLine = line.replace(/\s+/g, " ").trim();
    if (!normalizedLine) {
      continue;
    }
    const normalizedHeadingLine = stripSectionHeadingPrefix(normalizedLine);

    if (DATE_HEADING_CONTEXT_PATTERN.test(normalizedLine) || DATE_HEADING_CONTEXT_PATTERN.test(normalizedHeadingLine)) {
      inDateContext = true;
      dateContextCountdown = 18;
    } else if (dateContextCountdown > 0) {
      dateContextCountdown -= 1;
    } else {
      inDateContext = false;
    }

    if (DATE_NON_EVENT_NOISE_PATTERN.test(normalizedLine) || DATE_NON_EVENT_NOISE_PATTERN.test(normalizedHeadingLine)) {
      continue;
    }

    const normalized = normalizeDate(normalizedLine);
    if (!normalized) {
      continue;
    }

    if (!inDateContext && !DATE_EVENT_HINT_PATTERN.test(normalizedLine) && !DATE_EVENT_HINT_PATTERN.test(normalizedHeadingLine)) {
      continue;
    }

    const lower = normalizedLine.toLowerCase();
    const type = lower.includes("question")
      ? "qa_deadline"
      : lower.includes("submission")
        ? "submission_deadline"
        : lower.includes("presentation")
          ? "presentation"
          : "other";

    out.push({
      title: normalizedLine.slice(0, 140),
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
  /proposal submissions?/i,
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
  /^requests?\s+for\s+clarification$/i,
  /^proposal submissions?$/i,
  /^appendix(?:\s*\(\d+\))?$/i,
  /^bill of quantity(?:\s*\(appendix.*\))?$/i,
  /^service agreement$/i,
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
  /^the commercial proposals?\s+should\s+include\s+the\s+following\s+sections?/i,
  /^prepared by\b/i,
  /^procurement department\b/i,
  /^expo\s*2030\s*riyadh\s*company\b/i,
  /^fifa\s*world\s*cup|^expo\s*dubai/i
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
    .replace(/^['’]s\s+/i, "")
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

const PROJECT_WORK_DELIVERABLE_HINTS = [
  /brand strategy|positioning|messaging framework|communication framework/i,
  /campaign strategy|campaign concept|creative direction|launch campaign/i,
  /visual identity|design system|brand guidelines?|key visual/i,
  /content strategy|content pillars?|editorial framework|copy platform/i,
  /market research|consumer research|benchmark(?:ing)?|cultural analysis|local insights?/i,
  /project management plan|implementation plan|activation plan|roadmap/i,
  /استراتيجية العلامة|التموضع|إطار الرسائل|الحملة|الهوية|بحث السوق|تحليل ثقافي|رؤى محلية/
];

const SUBMISSION_REQUIREMENT_HINTS = [
  /technical proposal|commercial proposal|financial proposal/i,
  /submitted?|submission|bidder|vendor/i,
  /\bcv\b|resume|certificate|credentials?|references?|profile/i,
  /encrypted file|password|email|portal|intent to tender|deadline for questions?/i,
  /عرض فني|عرض مالي|تقديم|سيرة|شهادة|مرجع|بوابة/
];

function isSubmissionDeliverableLine(line: string, category: DeliverableCategory): boolean {
  if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line))) {
    return false;
  }
  const normalized = normalizeRequirementLine(line);
  if (!normalized) {
    return false;
  }
  if (GENERIC_DELIVERABLE_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  if (!isConcreteDeliverableLine(normalized) && !looksLikeRequirementStatement(normalized)) {
    return false;
  }

  if (category === "technical") {
    return hasSignal(normalized, TECHNICAL_SUBMISSION_HINTS);
  }
  if (category === "commercial") {
    return hasSignal(normalized, COMMERCIAL_SUBMISSION_HINTS);
  }
  return hasSignal(normalized, STRATEGIC_CREATIVE_SUBMISSION_HINTS);
}

function isProjectWorkDeliverableLine(line: string): boolean {
  const normalized = normalizeRequirementLine(line);
  if (!normalized) {
    return false;
  }
  if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  if (GENERIC_DELIVERABLE_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  const submissionLike = hasSignal(normalized, SUBMISSION_REQUIREMENT_HINTS);
  const projectLike = hasSignal(normalized, PROJECT_WORK_DELIVERABLE_HINTS);
  if (!projectLike) {
    return false;
  }
  if (
    submissionLike &&
    !/(strategy|campaign|creative|brand|design|research|benchmark|insights?|locali[sz]ation|positioning|messaging|استراتيجية|إبداعي|الحملة|الهوية|بحث|رؤى)/i.test(
      normalized
    )
  ) {
    return false;
  }
  return true;
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

    const normalizedHeading = stripSectionHeadingPrefix(trimmed);
    const normalized = normalizeRequirementLine(normalizedHeading);
    const headingHint = inferDeliverableHeadingHint(normalizedHeading);
    const startsSection = DELIVERABLE_SECTION_START_PATTERNS.some(
      (pattern) => pattern.test(trimmed) || pattern.test(normalizedHeading)
    );
    const stopsSection = DELIVERABLE_SECTION_STOP_PATTERNS.some(
      (pattern) => pattern.test(trimmed) || pattern.test(normalizedHeading)
    );

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

    if (inSection && stopsSection && sectionLineCount > 0) {
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
      if (!isProjectWorkDeliverableLine(clean)) {
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
  technical: /(technical proposal|executive summary|methodology|approach|credentials?|team|cv\b|resume|references?|certificate|vendor profile|track record|project management plan|risk management plan|communication and reporting framework|scheduling management plan|issue management plan|عرض فني|منهجية|سيرة|مرجع|شهادة|ملف الشركة|الخبرات)/i,
  commercial: /(commercial proposal|financial proposal|pricing|price|payment terms?|tax|subtotal|grand total|fees?|quotation|budget|encrypted file|password-protected|عرض مالي|مالي|تجاري|الدفع|ضريبة|تكلفة|سعر)/i,
  strategicCreative: /(strategic\s+(proposal|plan|framework|approach)|creative\s+(proposal|brief|concept|direction)|campaign\s+(strategy|concept|plan)|brand\s+(strategy|positioning|messaging|localization)|positioning|messaging framework|استراتيجي|إبداعي|الحملة|التموضع|الرسائل)/i
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
  const normalized = normalizeRequirementLine(line);
  if (!normalized) {
    return null;
  }

  if (
    /project management plan|scheduling management plan|issue management plan|risk management plan|communication and reporting framework|methodology and approach|team composition and cvs?/i.test(
      normalized
    )
  ) {
    return "technical";
  }

  const explicitCommercial =
    /commercial proposal|financial proposal|payment terms?|pricing breakdown|fee schedule|subtotal|grand total|tax|encrypted file|password/i.test(
      normalized
    );
  const explicitTechnical =
    /technical proposal|methodology|approach|executive summary|credentials?|references?|vendor profile|team composition|\bcv\b|certificate|project management plan|risk management plan|communication and reporting framework|scheduling management plan/i.test(
      normalized
    );
  const explicitStrategic =
    /strategic (?:proposal|plan|framework)|creative (?:proposal|brief|direction|concept)|campaign strategy|brand strategy|positioning|messaging framework/i.test(
      normalized
    );

  if (explicitCommercial && !explicitTechnical) {
    return "commercial";
  }
  if (explicitTechnical && !explicitCommercial) {
    return "technical";
  }
  if (explicitStrategic && !explicitCommercial) {
    return "strategicCreative";
  }

  const technicalScore =
    (REQUIREMENT_LINE_PATTERNS.technical.test(normalized) ? 2 : 0) +
    (hasSignal(normalized, TECHNICAL_REQUIREMENT_SIGNALS) ? 2 : 0) +
    (/project management|methodology|approach|team composition|risk management|communication and reporting|scheduling management/i.test(
      normalized
    )
      ? 2
      : 0);
  const commercialScore =
    (REQUIREMENT_LINE_PATTERNS.commercial.test(normalized) ? 2 : 0) +
    (hasSignal(normalized, COMMERCIAL_REQUIREMENT_SIGNALS) ? 2 : 0) +
    (/commercial proposal|financial proposal|pricing|payment terms?|encrypted file|tax|subtotal|grand total/i.test(normalized)
      ? 2
      : 0);
  const strategicScore =
    (REQUIREMENT_LINE_PATTERNS.strategicCreative.test(normalized) ? 2 : 0) +
    (hasSignal(normalized, STRATEGIC_CREATIVE_REQUIREMENT_SIGNALS) ? 2 : 0);

  const best = Math.max(technicalScore, commercialScore, strategicScore);
  if (best <= 0) {
    return null;
  }
  if (technicalScore >= commercialScore && technicalScore >= strategicScore) {
    return "technical";
  }
  if (commercialScore >= strategicScore) {
    return "commercial";
  }
  return "strategicCreative";
}

function inferDeliverableTitle(line: string, category: DeliverableCategory): string {
  if (/project management plan|scheduling management plan|issue management plan/i.test(line)) {
    return "Project Management Plan";
  }
  if (/risk management plan|risk mitigation/i.test(line)) {
    return "Risk Management Plan";
  }
  if (/communication and reporting framework|communication.*reporting/i.test(line)) {
    return "Communication and Reporting Framework";
  }
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
  if (/commercial proposal|financial proposal|pricing|price|tax|subtotal|grand total|fees?|quotation|budget|payment terms?/i.test(line)) {
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

    const candidate: DeliverableRequirementItem = {
      title: cleanTitle,
      description: cleanDescription,
      source,
      evidenceRef: cleanEvidenceRef || undefined
    };

    const existingIndex = grouped[category].findIndex(
      (item) => normalizeDedupeKey(item.title) === normalizedTitle
    );
    if (existingIndex >= 0) {
      const existing = grouped[category][existingIndex];
      const existingScore =
        (existing.source === "verbatim" ? 2 : 0) +
        Math.min(existing.description.length / 80, 3);
      const candidateScore =
        (candidate.source === "verbatim" ? 2 : 0) +
        Math.min(candidate.description.length / 80, 3);
      if (candidateScore > existingScore) {
        grouped[category][existingIndex] = candidate;
      }
      return;
    }

    const key = `${category}|${normalizedTitle}|${normalizedDescription}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    grouped[category].push(candidate);
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

      if (candidateLine.origin !== "evaluation" && !isSubmissionDeliverableLine(line, category)) {
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

      if (
        category === "strategicCreative" &&
        !hasSignal(line, STRATEGIC_CREATIVE_REQUIREMENT_SIGNALS) &&
        !explicitSignal &&
        candidateLine.origin !== "evaluation"
      ) {
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

  return dedupeDeliverableRequirementsGlobal(grouped);
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
      line = heading;
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

function buildExecutiveSummaryFromSource(parsedDocument: AnalyzeRfpInput["parsedDocument"]): string {
  const text = parsedDocument.rawText;
  const scopeSection = bySectionName(text, parsedDocument.sections, ["scope_of_work"]);
  const scopeHeadingBlock = extractExactBlock(
    text,
    /scope\s+of\s+work|statement\s+of\s+work|services\s+required|نطاق\s+العمل/i,
    2200
  );

  const candidate = scopeSection || scopeHeadingBlock || fallbackExecutiveSummarySeed(text);
  const lines = candidate
    .split(/\r?\n|\\r\\n|\\n/)
    .map((line) => normalizeRequirementLine(stripSectionHeadingPrefix(line)))
    .filter(Boolean)
    .filter((line) => line.length >= 12)
    .filter((line) => !SCOPE_NON_WORK_PATTERNS.some((pattern) => pattern.test(line)))
    .filter((line) => !/^(scope of work|overview|key objectives?|program phases?|phase\s+\d+)/i.test(line))
    .slice(0, 7);

  const keyLines = lines.filter((line) =>
    /(seeks?|seeking|requires?|scope|deliver|develop|strategy|campaign|locali[sz]ation|brand|proposal|تطوير|استراتيجية|حملة|العلامة)/i.test(
      line
    )
  );

  const summarySeed = (keyLines.length > 0 ? keyLines : lines).join(" ");
  return normalizeExecutiveSummary(summarySeed || fallbackExecutiveSummarySeed(text));
}

function executiveSummaryQualityScore(summary: string): number {
  const normalized = normalizeRequirementLine(summary);
  if (!normalized) {
    return 0;
  }

  const positiveHits =
    (normalized.match(
      /(brand|strategy|campaign|locali[sz]ation|deliverables?|proposal|requirements?|scope|technical|commercial|creative|استراتيجية|حملة|العلامة|المتطلبات|نطاق)/gi
    ) ?? []).length;
  const genericPenalty =
    (normalized.match(
      /(global event|bring together nations|pressing challenges|catalyst for innovation|extraordinary exposition|intercontinental connectivity)/gi
    ) ?? []).length;
  const sentenceCount = normalized.split(/(?<=[.!?؟])\s+/).filter(Boolean).length;

  return Math.max(0, positiveHits * 2 + Math.min(sentenceCount, 4) - genericPenalty * 3);
}

function chooseExecutiveSummary(
  claudeSummary: string,
  sourceSummary: string,
  fallbackSummary: string
): string {
  const claude = normalizeExecutiveSummary(claudeSummary || "");
  const source = normalizeExecutiveSummary(sourceSummary || "");
  const fallback = normalizeExecutiveSummary(fallbackSummary || "");

  const claudeScore = executiveSummaryQualityScore(claude);
  const sourceScore = executiveSummaryQualityScore(source);
  const fallbackScore = executiveSummaryQualityScore(fallback);
  const claudeLooksGeneric =
    /(global event aiming to bring together|catalyst for innovation|pressing challenges|visionary concept of urban development|integral part of saudi vision)/i.test(
      claude
    );
  const sourceLooksRfpSpecific =
    /(proposal|technical|commercial|submission|deliver|scope|requirement|strategy|campaign|locali[sz]ation|brand)/i.test(
      source
    ) && source.length >= 120;

  if (claudeLooksGeneric && sourceLooksRfpSpecific) {
    return source;
  }

  if (sourceScore >= Math.max(claudeScore + 1, 3)) {
    return source;
  }
  if (claudeScore >= Math.max(sourceScore, fallbackScore, 2)) {
    return claude;
  }
  return source || claude || fallback;
}

function dedupeDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  const byKey = new Map<string, DeliverableItem>();
  const inferredCandidates: DeliverableItem[] = [];
  const keepSignalPattern =
    /(brand strategy|positioning|messaging|campaign|creative|design|identity|guidelines?|content|media|research|benchmark|insights?|roadmap|framework|launch|brand book|visual|strategy|استراتيجية|إبداع|الهوية|الحملة|بحث|رؤى)/i;
  const submissionLikePattern =
    /(proposal submission|technical proposal|commercial proposal|financial proposal|certificate|credentials?|\\bcv\\b|resume|payment terms?|pricing|tax|encrypted|password|vendor profile|عرض فني|عرض مالي|شهادة|سيرة|الدفع|مالي|فني)/i;
  const verbatimDropPatterns = [
    /referred to as.*vendor/i,
    /no clarification.*binding/i,
    /legal validity whatsoever/i,
    /accepts no liability/i,
    /no vendor may add/i,
    /proposal documents will be submitted to/i
  ];

  const inferredKeepPatterns = [
    /brand strategy|positioning|messaging framework|communication framework/i,
    /campaign strategy|creative direction|campaign concept/i,
    /visual identity|design system|brand guidelines?|key visual/i,
    /content strategy|editorial framework|content pillars?/i,
    /market research|benchmark(?:ing)?|cultural analysis|local insights?/i,
    /project management plan|implementation plan|roadmap/i,
    /استراتيجية|إبداع|هوية|الحملة|بحث|رؤى/
  ];

  const inferredDropPatterns = [
    /technical proposal|commercial proposal|financial proposal/i,
    /certificate|credentials?|\bcv\b|resume/i,
    /payment terms?|tax|encrypted|password/i,
    /proposal documents will be submitted/i
  ];

  for (const item of items) {
    const cleaned = item.item.replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.length < 4) {
      continue;
    }

    if (verbatimDropPatterns.some((pattern) => pattern.test(cleaned))) {
      continue;
    }

    if (!keepSignalPattern.test(cleaned) || !isProjectWorkDeliverableLine(cleaned)) {
      continue;
    }
    if (submissionLikePattern.test(cleaned) && !/campaign|strategy|creative|brand|design|research|benchmark|insights?|identity|استراتيجية|إبداع|بحث|هوية/.test(cleaned)) {
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

  pushFromCategory(grouped.strategicCreative);
  pushFromCategory(grouped.technical);
  pushFromCategory(grouped.commercial);

  const inferredDeduped = dedupeDeliverables(inferred);
  if (inferredDeduped.length > 0) {
    return inferredDeduped;
  }

  return dedupeDeliverables([
    {
      item: "Brand Strategy and Positioning Framework",
      source: "inferred"
    },
    {
      item: "Creative Campaign Concept and Launch Plan",
      source: "inferred"
    }
  ]);
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
  /prepared by/i,
  /procurement department/i,
  /expo\s*2030\s*riyadh\s*company/i,
  /table of contents/i,
  /page\s*\|\s*\d+/i,
  /fifa\s*world\s*cup|fifa\s*\d{4}|fifa.*2022|2022.*fifa|qatar\s*2022|qatar.*2022|2022.*qatar|expo\s*dubai|dubai.*2020/i,
  /contact\s+us|www\./i,
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

const SCOPE_KNOWN_PHASE_LABELS =
  /^(?:\d+[\.\)]\s*)?(?:research and analysis\s*\/\s*benchmarks|strategic foundation and alignment|local brand and launch campaign strategy development|local design system|brand book|post-?launch plan|project management)$/i;

const SCOPE_ACTION_VERB_PATTERN =
  /(develop|design|create|build|launch|define|align|deliver|craft|implement|execute|produce|manage|lead|plan|map|research|analyze|optimi[sz]e|monitor|coordinate|supervise|developing|designing|creating|building|إعداد|تطوير|تصميم|تنفيذ|إطلاق|إدارة|تحليل|تنسيق|إشراف|إنتاج)/i;

const SCOPE_DOMAIN_SIGNAL_PATTERN =
  /(brand|branding|campaign|marketing|communication|content|design|creative|media|strategy|research|benchmark|insights?|positioning|messaging|locali[sz]ation|deliverables?|إبداع|تسويق|هوية|استراتيجية|محتوى|تصميم|بحث|تحليل)/i;

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

    let cleaned = fragment
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
    const hasDomainSignal = SCOPE_DOMAIN_SIGNAL_PATTERN.test(cleaned);
    const hasActionVerb = SCOPE_ACTION_VERB_PATTERN.test(cleaned);

    // Drop pure phase labels while keeping concrete action lines that carry a phase prefix.
    if (isPhaseTitle) {
      if (SCOPE_KNOWN_PHASE_LABELS.test(cleaned)) {
        continue;
      }
      if (!hasActionVerb) {
        continue;
      }
      cleaned = cleaned
        .replace(/^(?:\d+[\.\)]\s*)?phase\s*\d+\s*[:\-]\s*/i, "")
        .replace(/^(?:\d+[\.\)]\s*)?program phases?(?:\s*\(.*\))?\s*[:\-]\s*/i, "")
        .trim();
      if (!cleaned || cleaned.length < 8) {
        continue;
      }
    }

    const isMetadataLine =
      /^([A-Z0-9][A-Z0-9\s&/\-]{6,}|[\d\s\-–]{4,})$/.test(cleaned) ||
      (/^[A-Z][A-Za-z\s]{3,40}\s*\|\s*[A-Z]/.test(cleaned));

    if (isMetadataLine && !hasActionVerb) {
      continue;
    }

    if (isNonWork && !SCOPE_ACTION_VERB_PATTERN.test(cleaned)) {
      continue;
    }

    // Drop short category labels; keep concrete action lines.
    const wordCount = cleaned.split(/\s+/).length;
    if (!hasActionVerb && !hasDomainSignal && wordCount <= 6) {
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

  if (workItems.length < 3 && fallbackCandidates.length > 0) {
    for (const candidate of fallbackCandidates) {
      const normalized = normalizeDedupeKey(candidate);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      if (!SCOPE_DOMAIN_SIGNAL_PATTERN.test(candidate) && !SCOPE_ACTION_VERB_PATTERN.test(candidate)) {
        continue;
      }
      seen.add(normalized);
      workItems.push(candidate);
      if (workItems.length >= Math.min(MAX_SCOPE_ITEMS_FOR_ANALYSIS, 12)) {
        break;
      }
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
  const sourceItems = countScopeItems(sourceScope);
  const claudeItems = countScopeItems(claudeScope);

  // Prefer deterministic section-scoped extraction whenever it is reasonably complete.
  if (sourceItems >= 3 && sourceScore >= Math.max(3, claudeScore - 1)) {
    return sourceScope;
  }

  // If model output is sparse and source has any meaningful structure, use source.
  if (claudeItems < 2 && sourceItems >= 2) {
    return sourceScope;
  }

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
    if (clean.length >= 12 && isProjectWorkDeliverableLine(clean)) {
      candidates.push(clean);
    }
  }

  const grouped = [
    ...deliverableRequirements.strategicCreative,
    ...deliverableRequirements.technical
  ];
  for (const item of grouped) {
    const title = normalizeRequirementLine(item.title);
    const description = normalizeRequirementLine(item.description);
    const combined = title && description ? `${title}: ${description}` : title || description;
    if (combined.length >= 14 && isProjectWorkDeliverableLine(combined)) {
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

const EVALUATION_CONTAMINATION_PATTERNS = [
  /terms?\s*&?\s*conditions?/i,
  /confirmation of agreement/i,
  /agreement to execute/i,
  /non[-\s]?disclosure|nda/i,
  /proposal submitted separately in encrypted/i,
  /vendor shall not be responsible/i,
  /prepared by|procurement department/i
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

function looksLikeEvaluationGroupHeading(value: string): boolean {
  const normalized = normalizeRequirementLine(value);
  if (!normalized) {
    return false;
  }
  if (/^evaluation criteria$/i.test(normalized)) {
    return false;
  }
  if (/^(agency credentials|strategic planning|project management)/i.test(normalized)) {
    return true;
  }
  if (/^[A-Z][A-Z0-9\s,&/]{8,140}(?::|$)/.test(normalized)) {
    return true;
  }
  if (/^\d+\.\s+[A-Za-z].{6,140}$/.test(normalized) && !/^(\d+\.\s+evaluation criteria)$/i.test(normalized)) {
    const headingText = normalized.replace(/^\d+\.\s*/, "").trim();
    if (
      /^(then|into|and|or|with|for|to)\b/i.test(headingText) ||
      /(demonstrated|proven|showcase|capability|ability to|on-time|communication|risk mitigation)/i.test(headingText)
    ) {
      return false;
    }
    if (/[.!?؟]/.test(headingText) || headingText.split(/\s+/).length > 11) {
      return false;
    }
    if (
      /(credentials|experience|planning|creativity|management|deliverables|technical|commercial|quality|methodology|governance|team)/i.test(
        headingText
      ) ||
      /^[A-Z][A-Z0-9\s,&/]{8,140}$/.test(headingText)
    ) {
      return true;
    }
    return false;
  }
  return false;
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
    if (
      !cleaned ||
      EVALUATION_HEADING_NOISE.some((pattern) => pattern.test(cleaned)) ||
      EVALUATION_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(cleaned))
    ) {
      continue;
    }

    const genericHeading = /^(\d+\.\s+)?evaluation criteria$/i.test(cleaned);
    if (genericHeading) {
      pushCurrent();
      current = null;
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
      const rawTitle = headingMatch[2] ?? headingMatch[1] ?? cleaned;
      const normalizedTitle = normalizeEvaluationGroupTitle(rawTitle) || "Evaluation Criterion";
      const shouldTreatAsHeading =
        /^evaluation criteria$/i.test(normalizedTitle) === false &&
        (looksLikeEvaluationGroupHeading(cleaned) ||
          looksLikeEvaluationGroupHeading(rawTitle) ||
          parseEvaluationWeight(cleaned) !== null);
      if (shouldTreatAsHeading) {
        pushCurrent();
        current = {
          title: normalizedTitle,
          weight: parseEvaluationWeight(cleaned),
          items: [],
          evidenceRefs: [truncateAtWordBoundary(cleaned, 180)]
        };
        continue;
      }
    }

    const bullet = cleaned.replace(/^•\s*/, "").trim();
    if (bullet.length < 8) {
      continue;
    }

    const bulletHeadingMatch = bullet.match(/^([A-Z][A-Z0-9\s,&/]{6,140})\s*:\s*(.{12,})$/);
    if (bulletHeadingMatch?.[1] && bulletHeadingMatch[2]) {
      pushCurrent();
      current = {
        title: normalizeEvaluationGroupTitle(bulletHeadingMatch[1]) || "Evaluation Criterion",
        weight: parseEvaluationWeight(bullet),
        items: [truncateAtWordBoundary(bulletHeadingMatch[2].trim(), 220)],
        evidenceRefs: [truncateAtWordBoundary(bullet, 180)]
      };
      continue;
    }

    if (looksLikeEvaluationGroupHeading(bullet) && (current == null || /^evaluation criteria$/i.test(current.title))) {
      pushCurrent();
      current = {
        title: normalizeEvaluationGroupTitle(bullet),
        weight: parseEvaluationWeight(bullet),
        items: [],
        evidenceRefs: [truncateAtWordBoundary(bullet, 180)]
      };
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

function postProcessEvaluationGroups(groups: EvaluationCriteriaGroup[]): EvaluationCriteriaGroup[] {
  if (groups.length === 0) {
    return groups;
  }

  const output: EvaluationCriteriaGroup[] = [];
  for (const group of groups) {
    const title = normalizeRequirementLine(group.title);
    const isBrokenHeading =
      /^(then|into|and|or|with|for|to)\b[\s,:-]*/i.test(title) ||
      /^(demonstrated|proven|showcase|capability|ability to|on[-\s]?time|communication|risk mitigation)\b[\s,:-]*/i.test(
        title
      );

    if (isBrokenHeading) {
      const target = output[output.length - 1];
      if (target) {
        target.items.push(...group.items);
        target.evidenceRefs.push(...group.evidenceRefs);
      }
      continue;
    }

    output.push({
      ...group,
      items: group.items.slice(0, 8),
      evidenceRefs: Array.from(new Set(group.evidenceRefs)).slice(0, 8)
    });
  }

  return output.slice(0, 8);
}

function formatEvaluationCriteriaStructured(groups: EvaluationCriteriaGroup[]): string {
  if (groups.length === 0) {
    return "Evaluation criteria not explicitly found.";
  }

  const lines: string[] = [];
  groups.forEach((group, idx) => {
    const suffix = group.weight ? ` (Weight ${group.weight})` : "";
    lines.push(`${idx + 1}. ${group.title}${suffix}`);
    group.items.slice(0, 8).forEach((item) => {
      lines.push(`• ${truncateAtWordBoundary(item, 220)}`);
    });
  });

  return lines.join("\n");
}

function splitEvaluationSentences(line: string): string[] {
  const normalized = line
    .replace(/([.!?؟])([A-Z][A-Z\s&]{6,})/g, "$1 $2")
    .replace(/([.!?؟])([A-Z][a-z]{3,}\s+[A-Z][A-Za-z]{3,})/g, "$1 $2");
  return normalized
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

    if (
      !line ||
      EVALUATION_HEADING_NOISE.some((pattern) => pattern.test(line)) ||
      EVALUATION_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(line))
    ) {
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
      output.push(line);
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
      const groupCellLooksLikeHeading = groupCell ? looksLikeEvaluationGroupHeading(groupCell) : false;

      if (
        groupCell &&
        groupCellLooksLikeHeading &&
        !EVALUATION_HEADING_NOISE.some((pattern) => pattern.test(groupCell)) &&
        !EVALUATION_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(groupCell))
      ) {
        currentGroup = normalizeEvaluationGroupTitle(groupCell);
      }

      const group = currentGroup;
      const detail = detailCell;
      if (!group || !detail) {
        continue;
      }
      if (
        detail.length < 8 ||
        DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(detail)) ||
        EVALUATION_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(detail))
      ) {
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
  if (tableStructured.length >= 2) {
    return {
      formatted: formatEvaluationCriteriaStructured(tableStructured),
      structured: tableStructured
    };
  }

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
    const sourceBonus = candidate.source === "table" ? 2.2 : candidate.source === "section" ? 1.4 : 0;
    const contaminationPenalty = /then,\s*into\s+strategic|confirmation of agreement|terms?\s*&?\s*conditions?/i.test(clean)
      ? 2
      : 0;
    return structure + length + groupBonus + sourceBonus - contaminationPenalty;
  };

  candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  const selected = candidates[0]!;
  return {
    formatted: selected.value,
    structured: selected.structured
  };
}

function buildDeliverablesSourceText(parsedDocument: AnalyzeRfpInput["parsedDocument"]): string {
  const text = parsedDocument.rawText;
  const scoped = buildSectionScopedText(
    text,
    parsedDocument.sections,
    ["submission_requirements", "proposal_submissions"],
    [
      /submission\s+format|submission\s+requirements?|proposal\s+requirements?|how\s+to\s+submit|متطلبات\s+التقديم/i,
      /technical\s+proposals?\s+should\s+include/i,
      /commercial\s+proposals?\s+should\s+include/i,
      /technical\s+proposal\s+submission/i,
      /commercial\s+proposal\s+submission/i,
      /proposal\s+submissions?/i
    ],
    6500
  );
  const headingWindowLines = collectHeadingWindowLines(
    text,
    [
      /^(?:(?:[IVXLCM]+|\d+)\s*[\.\)]?\s*)?(?:submission\s+format|submission\s+requirements?|proposal\s+requirements?|submission\s+instructions?|how\s+to\s+submit|متطلبات\s+التقديم)\s*(?:[:\-–]\s*)?$/i,
      /^(?:(?:[IVXLCM]+|\d+)\s*[\.\)]?\s*)?technical\s+proposals?\s+should\s+include(?:\s+the\s+following\s+sections?)?\s*(?:[:\-–]\s*)?$/i,
      /^(?:(?:[IVXLCM]+|\d+)\s*[\.\)]?\s*)?commercial\s+proposals?\s+should\s+include(?:\s+the\s+following\s+sections?)?\s*(?:[:\-–]\s*)?$/i
    ],
    DELIVERABLE_SECTION_STOP_PATTERNS,
    180,
    14_000
  );
  const scopedLines = scoped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const extractedLines = collectDeliverableSectionLines(text).map((entry) => entry.text);
  let mergedLines = dedupeStrings([...scopedLines, ...headingWindowLines, ...extractedLines]);

  if (mergedLines.length > 0) {
    const clauseExpanded = mergedLines
      .flatMap((line) => splitRequirementClauses(line))
      .map((line) => normalizeRequirementLine(line))
      .filter((line) => line.length >= 8);
    mergedLines = dedupeStrings([...mergedLines, ...clauseExpanded]);
  }

  if (mergedLines.length < 12) {
    const scopedFallbackCorpus = [
      scoped,
      headingWindowLines.join("\n"),
      bySectionName(text, parsedDocument.sections, ["submission_requirements"]) ?? "",
      bySectionName(text, parsedDocument.sections, ["proposal_submissions"]) ?? "",
      extractExactBlock(text, /technical\s+proposals?\s+should\s+include/i, 4_500) ?? "",
      extractExactBlock(text, /commercial\s+proposals?\s+should\s+include/i, 4_500) ?? ""
    ]
      .filter((value) => value.trim().length > 0)
      .join("\n");

    const broadFallbackLines = scopedFallbackCorpus
      .split(/\r?\n/)
      .flatMap((line) => splitRequirementClauses(line))
      .map((line) => normalizeRequirementLine(line))
      .filter((line) => line.length >= 8)
      .filter((line) => !DELIVERABLE_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
      .filter((line) => !DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line)))
      .filter((line) => {
        if (!looksLikeRequirementStatement(line)) {
          return false;
        }
        return (
          hasSignal(line, SUBMISSION_REQUIREMENT_HINTS) ||
          hasSignal(line, TECHNICAL_SUBMISSION_HINTS) ||
          hasSignal(line, COMMERCIAL_SUBMISSION_HINTS) ||
          hasSignal(line, STRATEGIC_CREATIVE_SUBMISSION_HINTS)
        );
      })
      .slice(0, 140);
    mergedLines = dedupeStrings([...mergedLines, ...broadFallbackLines]);
  }

  const merged = mergedLines.join("\n");
  if (scopedLines.length >= 12) {
    return scoped;
  }
  if (headingWindowLines.length >= 12) {
    return merged;
  }
  return merged.trim().length > 0 ? merged : scoped;
}

function buildImportantDatesSourceText(parsedDocument: AnalyzeRfpInput["parsedDocument"]): string {
  const text = parsedDocument.rawText;
  const scoped = buildSectionScopedText(
    text,
    parsedDocument.sections,
    ["important_dates", "requests_for_clarification", "proposal_submissions"],
    [
      /important\s+dates?|timeline|rfp\s+timeline|milestones?|deadlines?|submission\s+schedule|requests?\s+for\s+clarification|proposal\s+submissions?|الجدول\s+الزمني|المواعيد/i
    ],
    5000
  );
  const headingWindowLines = collectHeadingWindowLines(
    text,
    [
      /^(?:(?:[IVXLCM]+|\d+)\s*[\.\)]?\s*)?(?:important\s+dates?|timeline|milestones?|deadlines?|submission\s+schedule|الجدول\s+الزمني|المواعيد)\s*(?:[:\-–]\s*)?$/i
    ],
    [
      /^scope of work$/i,
      /^evaluation criteria$/i,
      /^submission requirements?$/i,
      /^terms?\s*&?\s*conditions?$/i,
      /^نطاق العمل$/i,
      /^معايير التقييم$/i,
      /^متطلبات التقديم$/i
    ],
    120,
    8_000
  );
  const directDateLines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) =>
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(
        line
      )
    )
    .filter((line) =>
      /(issued|deadline|question|response|submission|presentation|closing|opening|تاريخ|موعد|آخر موعد|تقديم|استفسار|ردود)/i.test(
        line
      )
    )
    .slice(0, 60);

  const merged = dedupeStrings([
    ...scoped.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    ...headingWindowLines,
    ...directDateLines
  ]).join("\n");
  return merged.trim().length > 0 ? merged : scoped;
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

function dedupeDeliverableRequirementsGlobal(
  groups: DeliverableRequirements
): DeliverableRequirements {
  const seenTitles = new Set<string>();
  const seenDescriptions = new Set<string>();

  const dedupeCategory = (items: DeliverableRequirementItem[]): DeliverableRequirementItem[] => {
    const output: DeliverableRequirementItem[] = [];
    for (const item of items) {
      const titleKey = normalizeDedupeKey(item.title);
      const descriptionKey = normalizeDedupeKey(item.description);
      const hasSeen =
        (titleKey && seenTitles.has(titleKey)) ||
        (descriptionKey && seenDescriptions.has(descriptionKey));
      if (hasSeen) {
        continue;
      }

      if (titleKey) {
        seenTitles.add(titleKey);
      }
      if (descriptionKey) {
        seenDescriptions.add(descriptionKey);
      }

      output.push(item);
      if (output.length >= MAX_DELIVERABLES_PER_CATEGORY) {
        break;
      }
    }
    return output;
  };

  return {
    technical: dedupeCategory(groups.technical),
    commercial: dedupeCategory(groups.commercial),
    strategicCreative: dedupeCategory(groups.strategicCreative)
  };
}

function dedupeDeliverableItems(items: DeliverableRequirementItem[]): DeliverableRequirementItem[] {
  const byTitle = new Map<string, DeliverableRequirementItem>();
  const seenDescription = new Set<string>();
  for (const item of items) {
    const titleKey = normalizeDedupeKey(item.title);
    const descKey = normalizeDedupeKey(item.description);
    if (!titleKey && !descKey) {
      continue;
    }

    const key = titleKey || descKey;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, item);
      continue;
    }

    const existingScore =
      (existing.source === "verbatim" ? 2 : 0) +
      (existing.evidenceRef ? 1 : 0) +
      Math.min(existing.description.length / 120, 2);
    const currentScore =
      (item.source === "verbatim" ? 2 : 0) +
      (item.evidenceRef ? 1 : 0) +
      Math.min(item.description.length / 120, 2);
    if (currentScore > existingScore) {
      byTitle.set(key, item);
    }
  }

  const out: DeliverableRequirementItem[] = [];
  for (const item of byTitle.values()) {
    const descKey = normalizeDedupeKey(item.description);
    if (descKey && seenDescription.has(descKey)) {
      continue;
    }
    if (descKey) {
      seenDescription.add(descKey);
    }
    out.push(item);
  }
  return out;
}

function dedupeImportantDates(
  dates: Array<{ title: string; date: string; type: string; isCritical: boolean }>
): Array<{ title: string; date: string; type: string; isCritical: boolean }> {
  const byKey = new Map<string, { title: string; date: string; type: string; isCritical: boolean }>();

  const canonicalEventKey = (title: string, type: string): string => {
    const normalized = normalizeDedupeKey(title);
    if (type === "submission_deadline") return "submission_deadline";
    if (type === "qa_deadline") return "qa_deadline";
    if (type === "presentation") return "presentation";
    if (/intent/.test(normalized)) return "intent_to_tender";
    if (/issued|issue/.test(normalized)) return "rfp_issued";
    if (/question/.test(normalized)) return "qa_deadline";
    if (/response/.test(normalized)) return "qa_response";
    if (/submission|proposal/.test(normalized)) return "submission_deadline";
    if (/presentation/.test(normalized)) return "presentation";
    return type || "other";
  };

  for (const date of dates) {
    const cleanTitle = date.title.replace(/\s+/g, " ").trim();
    if (!cleanTitle) {
      continue;
    }

    const key = `${date.date}|${canonicalEventKey(cleanTitle, date.type)}`;
    const candidate = {
      ...date,
      title: cleanTitle
    };
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    const existingScore =
      (existing.isCritical ? 2 : 0) +
      Math.min(existing.title.length / 40, 2);
    const candidateScore =
      (candidate.isCritical ? 2 : 0) +
      Math.min(candidate.title.length / 40, 2);
    if (candidateScore > existingScore) {
      byKey.set(key, candidate);
    }
  }

  return Array.from(byKey.values());
}

function scoreDeliverableCategoryQuality(
  category: DeliverableCategory,
  items: DeliverableRequirementItem[]
): number {
  if (items.length === 0) {
    return 0;
  }

  let score = items.length * 2;
  for (const item of items) {
    const description = normalizeRequirementLine(item.description);
    const title = normalizeRequirementLine(item.title);

    if (item.source === "verbatim") {
      score += 2;
    }
    if (item.evidenceRef && item.evidenceRef.trim().length >= 8) {
      score += 1;
    }
    if (looksLikeRequirementStatement(description)) {
      score += 1;
    }
    if (isSubmissionDeliverableLine(description, category)) {
      score += 1;
    }
    if (DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(description))) {
      score -= 4;
    }
    if (/^(strategic framework|evaluation criteria|technical requirement)$/i.test(title)) {
      score -= 2;
    }
  }

  return score;
}

function scoreDeliverableRequirementsQuality(value: DeliverableRequirements): number {
  return (
    scoreDeliverableCategoryQuality("technical", value.technical) +
    scoreDeliverableCategoryQuality("commercial", value.commercial) +
    scoreDeliverableCategoryQuality("strategicCreative", value.strategicCreative)
  );
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

function mapClaudeToPass1OutputAiFirst(
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
  const sourceScope = buildScopeFromSource(parsedDocument);
  const sourceExecutiveSummary = buildExecutiveSummaryFromSource(parsedDocument);
  const dateSourceText = buildImportantDatesSourceText(parsedDocument) || text;

  const selectedExecutiveSummary = chooseExecutiveSummary(
    claude.projectDescription || "",
    sourceExecutiveSummary,
    fallbackExecutiveSummarySeed(text)
  );

  let scopeOfWork = sanitizeScopeForAnalysis(normalizeStructuredText(claude.scopeOfWork || ""));
  if (countScopeItems(scopeOfWork) < 2) {
    const scopedFallback = sanitizeScopeForAnalysis(normalizeStructuredText(sourceScope));
    if (countScopeItems(scopedFallback) >= 2) {
      scopeOfWork = scopedFallback;
      warnings.push("Scope extraction was reinforced with source section context.");
    } else if (scopeOfWork.trim().length === 0) {
      scopeOfWork = "Scope of work not explicitly found.";
      warnings.push("Scope extraction is sparse and should be manually reviewed.");
    }
  }

  const aiEvaluation = sanitizeEvaluationCriteria(
    normalizeStructuredText(claude.evaluationCriteria || "")
  );
  const fallbackEvaluation = sanitizeEvaluationCriteria(
    normalizeStructuredText(sourceEvaluation.formatted || "Evaluation criteria not explicitly found.")
  );
  const evaluationSeed = aiEvaluation.length >= 40 ? aiEvaluation : fallbackEvaluation;
  if (aiEvaluation.length < 40) {
    warnings.push("Evaluation criteria were supplemented with source context due sparse AI output.");
  }
  const evaluationCriteriaStructured = postProcessEvaluationGroups(
    buildEvaluationCriteriaStructuredFromText(evaluationSeed)
  );
  const evaluationCriteria =
    evaluationCriteriaStructured.length > 0
      ? formatEvaluationCriteriaStructured(evaluationCriteriaStructured)
      : evaluationSeed;

  const rawRequiredDeliverables = dedupeDeliverables(
    claude.requiredDeliverables.map((deliverable) => ({
      item: typeof deliverable === "string" ? deliverable : deliverable.item,
      source: (typeof deliverable === "string" ? "verbatim" : deliverable.source) as "verbatim" | "inferred"
    }))
  );
  const deliverableRequirements = dedupeDeliverableRequirementsGlobal(
    buildDeliverableRequirementsFromClaude(claude)
  );
  const inferredDeliverables = [
    ...deliverableRequirements.technical,
    ...deliverableRequirements.commercial,
    ...deliverableRequirements.strategicCreative
  ].map((item) => ({
    item: truncateAtWordBoundary((item.title || item.description || "").trim(), 140),
    source: item.source ?? "inferred"
  }));
  const requiredDeliverables = rawRequiredDeliverables.length > 0
    ? rawRequiredDeliverables
    : dedupeDeliverables(inferredDeliverables).slice(0, 12);
  if (requiredDeliverables.length === 0) {
    warnings.push("AI did not identify explicit deliverables.");
  }

  const mappedDates = dedupeImportantDates(
    claude.importantDates
      .map((dateItem) => ({
        title: dateItem.title,
        date: dateItem.date,
        type: dateItem.type,
        isCritical: dateItem.type === "submission_deadline" || dateItem.type === "presentation"
      }))
      .filter((item) => item.title.trim().length >= 6 && item.date.trim().length >= 4)
  );
  const fallbackDates = extractDates(dateSourceText).filter(
    (item) => item.date !== "2099-12-31" && item.title.trim().length >= 6
  );
  const importantDates = mappedDates.length > 0 ? mappedDates : dedupeImportantDates(fallbackDates);
  if (importantDates.length === 0) {
    warnings.push("[dates_low_confidence] Important dates were not confidently extracted.");
  }

  const submissionFallback = extractSubmission(text);
  const submissionRequirements = {
    method: claude.submissionRequirements?.method || submissionFallback.method,
    email: claude.submissionRequirements?.email ?? submissionFallback.email,
    physicalAddress: claude.submissionRequirements?.physicalAddress ?? submissionFallback.physicalAddress,
    format: claude.submissionRequirements?.format || submissionFallback.format,
    copies: claude.submissionRequirements?.copies ?? submissionFallback.copies,
    otherRequirements: [] as string[]
  };

  const evidence: Array<{ field: string; page: number; excerpt: string }> = [
    {
      field: "projectDescription",
      page: 1,
      excerpt: selectedExecutiveSummary.slice(0, 200)
    },
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
  ].filter((item) => item.excerpt.trim().length > 0);

  const coverageScore = Math.max(0.4, Math.min(1, coverage.coveragePercent));
  const scopeScore = Math.max(0.45, Math.min(0.95, scopeOfWork.length >= 60 ? 0.9 : 0.6));
  const evaluationScore = Math.max(0.45, Math.min(0.95, evaluationCriteria.length >= 60 ? 0.88 : 0.58));
  const datesScore = importantDates.length > 0 ? 0.85 : 0.52;
  const confidenceScores: Record<string, number> & { overall: number } = {
    clientName: claude.clientName ? 0.93 : 0.52,
    projectName: claude.projectName ? 0.92 : 0.56,
    scopeOfWork: scopeScore,
    evaluationCriteria: evaluationScore,
    dates: datesScore,
    overall: Math.max(
      0.5,
      Math.min(
        0.97,
        0.45 * coverageScore +
          0.2 * scopeScore +
          0.2 * evaluationScore +
          0.15 * datesScore
      )
    )
  };

  const finalClientName =
    claude.clientName || findLineValue(text, ["Client", "Client Name", "Issuer", "العميل"]) || "Unknown Client";
  const finalProjectName =
    claude.projectName || findLineValue(text, ["Project", "Project Name", "RFP", "اسم المشروع"]) || "Untitled Project";

  return {
    clientName: finalClientName,
    clientNameArabic: /[\u0600-\u06FF]/.test(finalClientName) ? finalClientName : null,
    projectName: finalProjectName,
    projectNameOriginal: /[\u0600-\u06FF]/.test(finalProjectName) ? finalProjectName : null,
    projectDescription: normalizeExecutiveSummary(selectedExecutiveSummary),
    scopeOfWork,
    evaluationCriteria,
    evaluationCriteriaStructured,
    requiredDeliverables,
    deliverableRequirements,
    importantDates,
    submissionRequirements,
    warnings,
    evidence,
    confidenceScores
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
  const deliverableSourceText = buildDeliverablesSourceText(parsedDocument) || text;
  const dateSourceText = buildImportantDatesSourceText(parsedDocument) || text;
  const scopeSourceText = buildScopeFromSource(parsedDocument);
  console.log(
    `[Pass1] Section source lines scope=${scopeSourceText.split(/\r?\n/).filter(Boolean).length} ` +
      `deliverables=${deliverableSourceText.split(/\r?\n/).filter(Boolean).length} ` +
      `dates=${dateSourceText.split(/\r?\n/).filter(Boolean).length}`
  );

  const sourceEvaluation = buildEvaluationCriteriaFromSource(parsedDocument);
  if (parsedDocument.tables.length > 0 && sourceEvaluation.structured.length === 0) {
    warnings.push("[criteria_table_missing] Evaluation tables were detected but could not be reliably structured.");
  }
  const claudeEvaluation = sanitizeEvaluationCriteria(
    normalizeStructuredText(claude.evaluationCriteria || "Evaluation criteria not explicitly found.")
  );
  const candidateEvaluation = chooseBestEvaluationCriteria(claudeEvaluation, sourceEvaluation.formatted);
  const claudeStructured = buildEvaluationCriteriaStructuredFromText(claudeEvaluation);
  const candidateStructured = buildEvaluationCriteriaStructuredFromText(candidateEvaluation);
  const scoreStructuredGroups = (groups: EvaluationCriteriaGroup[]): number => {
    if (groups.length === 0) {
      return 0;
    }
    const titleSet = new Set(
      groups
        .map((group) => normalizeDedupeKey(group.title))
        .filter(Boolean)
    );
    const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0);
    return titleSet.size * 5 + itemCount + Math.min(groups.length, 4) * 2;
  };
  const hasReliableSourceStructured = sourceEvaluation.structured.length >= 2;
  const evaluationCriteriaStructuredRaw = hasReliableSourceStructured
    ? sourceEvaluation.structured
    : ([sourceEvaluation.structured, claudeStructured, candidateStructured]
      .sort((a, b) => scoreStructuredGroups(b) - scoreStructuredGroups(a))[0] ?? []);
  const evaluationCriteriaStructured = postProcessEvaluationGroups(evaluationCriteriaStructuredRaw);
  const mergedEvaluation =
    evaluationCriteriaStructured.length > 0
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
      deliverableSourceText,
      mergedEvaluation,
      requiredDeliverables
    )
    : { technical: [], commercial: [], strategicCreative: [] };
  const deliverableContaminationCount = deliverableSourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line))).length;
  if (deliverableContaminationCount > 0) {
    warnings.push(
      `[deliverables_contamination_filtered] Filtered ${deliverableContaminationCount} deliverable-adjacent legal/admin lines.`
    );
  }

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
  const claudeDeliverablesQuality = scoreDeliverableRequirementsQuality(claudeDeliverableRequirements);
  const heuristicDeliverablesQuality = scoreDeliverableRequirementsQuality(heuristicDeliverableRequirements);
  const preferHeuristicDeliverables =
    allowHeuristicDeliverableFallback &&
    heuristicDeliverablesQuality > 0 &&
    (claudeDeliverablesQuality <= 0 || heuristicDeliverablesQuality >= claudeDeliverablesQuality + 2);

  const primaryDeliverables = preferHeuristicDeliverables
    ? heuristicDeliverableRequirements
    : claudeDeliverableRequirements;
  const secondaryDeliverables = preferHeuristicDeliverables
    ? claudeDeliverableRequirements
    : heuristicDeliverableRequirements;

  const mergedDeliverableRequirements: DeliverableRequirements = dedupeDeliverableRequirementsGlobal({
    technical: mergeCategory(primaryDeliverables.technical, secondaryDeliverables.technical, 3),
    commercial: mergeCategory(primaryDeliverables.commercial, secondaryDeliverables.commercial, 2),
    strategicCreative: mergeCategory(primaryDeliverables.strategicCreative, secondaryDeliverables.strategicCreative, 2)
  });
  if (preferHeuristicDeliverables) {
    warnings.push(
      "[deliverables_source_preferred] Source-scoped deliverable extraction was preferred over model-only grouping due higher quality signals."
    );
  }
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
  const rawClaudeScope = normalizeStructuredText(claude.scopeOfWork || "");
  const rawScopeFragmentCount = splitScopeFragments(rawClaudeScope).length;
  const sanitizedClaudeScope = sanitizeScopeForAnalysis(rawClaudeScope);
  const sanitizedScopeItemCount = countScopeItems(sanitizedClaudeScope);
  if (rawScopeFragmentCount > 0 && rawScopeFragmentCount - sanitizedScopeItemCount >= 3) {
    warnings.push(
      `[scope_contamination_filtered] Filtered ${rawScopeFragmentCount - sanitizedScopeItemCount} non-scope fragments from scope text.`
    );
  }
  let selectedScope = chooseBestScopeScopeText(
    sanitizedClaudeScope,
    scopeSourceText
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
  const mappedDates = claude.importantDates
    .map((d) => ({
    title: d.title,
    date: d.date,
    type: d.type,
    isCritical: d.type === "submission_deadline" || d.type === "presentation"
    }))
    .filter((entry) => entry.title.trim().length >= 6 && entry.date.trim().length >= 4);
  const deterministicDates = extractDates(dateSourceText).filter(
    (entry) => entry.date !== "2099-12-31" && entry.title.length >= 6
  );
  const importantDates = dedupeImportantDates([...deterministicDates, ...mappedDates]);
  if (deterministicDates.length === 0) {
    warnings.push("[dates_low_confidence] Important dates were inferred without strong timeline-section support.");
  }

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
    dates: deterministicDates.length > 0 ? 0.9 : importantDates[0]?.date !== "2099-12-31" ? 0.78 : 0.5,
    overall: 0.9
  };
  const sourceExecutiveSummary = buildExecutiveSummaryFromSource(parsedDocument);
  const fallbackExecutiveSummary = fallbackExecutiveSummarySeed(text);
  const selectedExecutiveSummary = chooseExecutiveSummary(
    claude.projectDescription || "",
    sourceExecutiveSummary,
    fallbackExecutiveSummary
  );

  return {
    clientName: claude.clientName || "Unknown Client",
    clientNameArabic: /[\u0600-\u06FF]/.test(claude.clientName) ? claude.clientName : null,
    projectName: claude.projectName || "Untitled Project",
    projectNameOriginal: /[\u0600-\u06FF]/.test(claude.projectName) ? claude.projectName : null,
    projectDescription: selectedExecutiveSummary,
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
  const deliverableSourceText = buildDeliverablesSourceText(input.parsedDocument) || text;
  const dateSourceText = buildImportantDatesSourceText(input.parsedDocument) || text;
  const warnings: string[] = ["AI extraction failed; using deterministic fallback."];

  const clientName =
    findLineValue(text, ["Client", "Client Name", "Issuer", "العميل"]) ??
    "Unknown Client";

  const projectName =
    findLineValue(text, ["Project", "Project Name", "RFP", "اسم المشروع"]) ??
    "Untitled Project";

  const scopeFromSection = bySectionName(text, input.parsedDocument.sections, ["scope_of_work"]);
  const scopeFromHeading = extractExactBlock(text, /scope\s+of\s+work|نطاق\s+العمل/i, 2000);
  const scopeSeed = scopeFromSection ?? scopeFromHeading ?? "Scope of work not explicitly found.";

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

  const requiredDeliverables = extractDeliverables(deliverableSourceText);
  const importantDates = extractDates(dateSourceText);
  const submissionRequirements = extractSubmission(text);
  const dedupedRequiredDeliverables = dedupeDeliverables(requiredDeliverables);
  const deliverableRequirements = buildDeliverableRequirements(
    deliverableSourceText,
    sanitizeEvaluationCriteria(normalizeStructuredText(evaluationCriteria)),
    dedupedRequiredDeliverables
  );
  const deliverableContaminationCount = deliverableSourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => DELIVERABLE_CLAUSE_DROP_PATTERNS.some((pattern) => pattern.test(line))).length;
  if (deliverableContaminationCount > 0) {
    warnings.push(
      `[deliverables_contamination_filtered] Filtered ${deliverableContaminationCount} deliverable-adjacent legal/admin lines.`
    );
  }
  if (importantDates[0]?.date === "2099-12-31") {
    warnings.push("[dates_low_confidence] Important dates were inferred without strong timeline-section support.");
  }
  const canonicalRequiredDeliverables = ensureRequiredDeliverables(
    dedupedRequiredDeliverables,
    deliverableRequirements
  );
  let scopeOfWork = sanitizeScopeForAnalysis(normalizeStructuredText(scopeSeed));
  if (countScopeItems(scopeOfWork) < 2) {
    const synthesized = buildScopeFromDeliverableSignals(
      canonicalRequiredDeliverables,
      deliverableRequirements
    );
    if (countScopeItems(synthesized) >= 2) {
      scopeOfWork = synthesized;
      warnings.push("Scope was reconstructed from deliverable signals due sparse fallback scope extraction.");
    }
  }

  const projectDescription = chooseExecutiveSummary(
    "",
    buildExecutiveSummaryFromSource(input.parsedDocument),
    fallbackExecutiveSummarySeed(text)
  );

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
    scopeOfWork,
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

function shouldUseAiWrapperMode(): boolean {
  if (process.env.RFP_AI_WRAPPER_MODE === "1") {
    return true;
  }
  if (process.env.RFP_AI_WRAPPER_MODE === "0") {
    return false;
  }
  return true;
}

export async function runPass1Extraction(input: AnalyzeRfpInput): Promise<Pass1Output> {
  // Try AI extraction first
  try {
    const extractionResult = await extractWithClaude(input.parsedDocument.rawText);
    if (shouldUseAiWrapperMode()) {
      return mapClaudeToPass1OutputAiFirst(extractionResult, input.parsedDocument);
    }
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
