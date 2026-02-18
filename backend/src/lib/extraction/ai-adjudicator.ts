import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { resolveGoogleApiKey, runWithGeminiFlashModel } from "@/lib/ai/model-resolver";
import type { Pass1Output } from "@/lib/extraction/passes/pass1-extract";

interface ParsedDocumentForAiReview {
  rawText: string;
  primaryLanguage: "arabic" | "english" | "mixed";
  sections: Array<{ name: string; startOffset: number; endOffset: number }>;
  tables: Array<{
    title: string;
    headers: string[];
    rows: string[][];
    pages: number[];
    confidence: number;
  }>;
  warnings?: string[];
  parseConfidence?: number;
}

export interface AiAdjudicationInput {
  analysisId: string;
  parsedDocument: ParsedDocumentForAiReview;
  extracted: Pass1Output;
  deterministicHints: {
    verificationScore: number;
    completenessScore: number;
    warnings: string[];
    redFlags: Array<{
      type: "contractual" | "feasibility" | "process";
      severity: "HIGH" | "MEDIUM" | "LOW";
      title: string;
      description: string;
      sourceText: string;
      recommendation: string;
    }>;
    missingInformation: Array<{ field: string; suggestedQuestion: string }>;
    conflicts: Array<{ field: string; candidates: string[]; resolution: string }>;
  };
}

const QualitySectionScoresSchema = z.object({
  extraction: z.number().min(0).max(1),
  scope: z.number().min(0).max(1),
  evaluation: z.number().min(0).max(1)
});

const AiAdjudicationSchema = z.object({
  verificationScore: z.number().min(0).max(1),
  completenessScore: z.number().min(0).max(1),
  redFlags: z
    .array(
      z.object({
        type: z.enum(["contractual", "feasibility", "process"]),
        severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(320),
        sourceText: z.string().min(1).max(260),
        recommendation: z.string().min(1).max(260)
      })
    )
    .max(8)
    .default([]),
  missingInformation: z
    .array(
      z.object({
        field: z.string().min(1).max(120),
        suggestedQuestion: z.string().min(1).max(320)
      })
    )
    .max(16)
    .default([]),
  conflicts: z
    .array(
      z.object({
        field: z.string().min(1).max(120),
        candidates: z.array(z.string().min(1).max(400)).min(1).max(20),
        resolution: z.string().min(1).max(500)
      })
    )
    .max(12)
    .default([]),
  warnings: z.array(z.string().min(3).max(700)).max(20).default([]),
  qualityFlags: z.array(z.string().min(2).max(64)).max(14).default([]),
  quality: z.object({
    status: z.enum(["pass", "review_required", "blocked"]),
    blockReasons: z.array(z.string().min(3).max(500)).max(12).default([]),
    evidenceDensity: z.number().min(0).max(1),
    sectionScores: QualitySectionScoresSchema
  })
});

export type AiAdjudicationResult = z.infer<typeof AiAdjudicationSchema>;

const AI_ADJUDICATION_TIMEOUT_MS = positiveIntFromEnv(
  process.env.EXTRACTION_AI_ADJUDICATION_TIMEOUT_MS,
  120_000
);
const RAW_HEAD_CHARS = positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_HEAD_CHARS, 32_000);
const RAW_TAIL_CHARS = positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_TAIL_CHARS, 12_000);
const SECTION_SNIPPET_CHARS = positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_SECTION_CHARS, 5_000);
const TABLE_ROW_LIMIT = Math.max(1, Math.min(6, positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_TABLE_ROWS, 4)));
const TABLE_COUNT_LIMIT = Math.max(
  0,
  Math.min(4, positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_TABLE_COUNT, 2))
);

const AI_ADJUDICATION_PROMPT = `You are the quality assurance intelligence layer for an RFP analysis dashboard used by a creative/marketing agency. Your job is to validate, verify, and improve the quality assessment of extracted RFP data.

## YOUR ROLE
You receive: (1) the original document source context, (2) extracted fields from deterministic parsing, and (3) deterministic quality hints. You must cross-reference extracted data against the source to produce accurate quality scores.

## DASHBOARD FIELD MAPPING
Each extracted field maps to a dashboard section that agency executives will review:
- projectDescription → Executive Summary card
- scopeOfWork → Scope Analysis section (drives agency capability matching)
- evaluationCriteria → Evaluation Criteria section (drives bid strategy)
- requiredDeliverables + deliverableRequirements → Deliverables section
- importantDates → Timeline/Important Dates section
- submissionRequirements → Submission Requirements section

## FIELD-BY-FIELD VALIDATION RUBRIC

### clientName
- Must be the RFP ISSUER (buyer/client), not a bidder or vendor
- Cross-reference with letterhead, "issued by", procurement department mentions
- Flag if it looks like a vendor name was extracted instead

### projectName
- Should match official project/tender title from cover page or header
- Flag if generic or missing reference numbers that appear in the document

### projectDescription
- Must be a meaningful executive summary (3+ sentences), not a generic stub
- Should explain WHAT the project is and WHY the client is issuing this RFP
- Flag if it just repeats scope items or is a single vague sentence

### scopeOfWork
- Must contain EXECUTION scope items (what the agency will DO)
- Flag if contaminated with submission requirements, legal clauses, or administrative items
- Flag if fewer than 5 scope items for a non-trivial RFP
- Verify items are actually from the Scope of Work section, not from evaluation criteria

### evaluationCriteria
- Must include scoring weights/percentages when present in the document
- Flag if weights don't sum to approximately 100%
- Flag if criteria are missing that are clearly present in the source document
- Verify sub-criteria are captured when specified

### requiredDeliverables
- Must be PROJECT deliverables (agency creates for client), NOT proposal submission docs
- Flag if proposal documents (CVs, certificates) are mixed in
- Flag if fewer than 3 deliverables for a substantive scope

### importantDates
- Dates must be in YYYY-MM-DD format when extractable
- Flag placeholder dates (2099-12-31) — these mean dates weren't found
- Verify submission deadline is captured if mentioned in the document

## SCORING GUIDANCE

### verificationScore (0.0-1.0)
How accurately extracted values match the source document:
- 0.9-1.0: All fields verified against source, minimal discrepancies
- 0.7-0.89: Most fields verified, minor issues
- 0.5-0.69: Several fields unverifiable or have discrepancies
- Below 0.5: Major extraction errors or misattributions

### completenessScore (0.0-1.0)
Presence of decision-critical data for an agency go/no-go decision:
- 0.9-1.0: All critical fields populated with substantive content
- 0.7-0.89: Most fields present, minor gaps
- 0.5-0.69: Notable gaps in important fields
- Below 0.5: Major decision-critical information missing

### quality.status
- "pass": Extraction is coherent, verified, and decision-ready for executives
- "review_required": Mostly usable but has moderate ambiguity or minor data quality issues
- "blocked": Major conflicts, critical sections missing, or extraction errors that would mislead decision-makers

### quality.evidenceDensity (0.0-1.0)
How well the extraction is supported by traceable evidence from the source document.

### quality.sectionScores
- extraction: Overall extraction quality
- scope: How well scope items were identified and separated from noise
- evaluation: How well evaluation criteria and weights were captured

## RED FLAGS
Review existing deterministic red flags. Add any critical risks you identify that were missed:
- Contractual: IP transfer, unlimited liability, punitive penalties, scope creep language
- Feasibility: Timeline vs scope mismatch, capability gaps, volume concerns
- Process: Missing Q&A window, lowest-price evaluation, incumbent signals

## QUALITY FLAGS
Use short snake_case tags. Common flags:
- low_scope_confidence, scope_contaminated, scope_too_sparse
- low_criteria_confidence, criteria_weights_missing, criteria_incomplete
- misplaced_content (submission docs in deliverables, etc.)
- conflicting_dates, dates_placeholder_only
- low_evidence_density, incomplete_extraction
- project_description_shallow, client_name_uncertain

## RULES
1. Do NOT invent information not in the source document
2. If evidence is weak, lower scores — do not give high scores by default
3. Be specific in warnings — say WHAT is wrong and WHERE
4. Conflicts between extracted data and source should be flagged with exact field names
5. Return STRICT JSON matching the schema — no markdown, no commentary
`;

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function normalizeFlag(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return normalized || "review_required";
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value.trim();
  }
  return `${value.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function compactWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function safeSlice(text: string, start: number, end: number): string {
  if (start < 0 || end <= start || start >= text.length) {
    return "";
  }
  const boundedStart = Math.max(0, Math.min(text.length, start));
  const boundedEnd = Math.max(boundedStart, Math.min(text.length, end));
  return text.slice(boundedStart, boundedEnd);
}

function buildSourceContext(parsedDocument: ParsedDocumentForAiReview): Record<string, unknown> {
  const rawText = parsedDocument.rawText ?? "";
  const head = rawText.slice(0, RAW_HEAD_CHARS);
  const tail =
    rawText.length > RAW_HEAD_CHARS
      ? rawText.slice(Math.max(0, rawText.length - RAW_TAIL_CHARS))
      : "";

  const sectionSnippets = parsedDocument.sections
    .map((section) => {
      const excerpt = safeSlice(rawText, section.startOffset, section.endOffset).slice(0, SECTION_SNIPPET_CHARS);
      return {
        name: section.name,
        excerpt: compactWhitespace(excerpt)
      };
    })
    .filter((item) => item.excerpt.length > 0)
    .slice(0, 10);

  const tableSnippets = parsedDocument.tables.slice(0, TABLE_COUNT_LIMIT).map((table) => ({
    title: table.title,
    headers: table.headers.slice(0, 10),
    rows: table.rows.slice(0, TABLE_ROW_LIMIT).map((row) => row.slice(0, 10)),
    pages: table.pages.slice(0, 5),
    confidence: table.confidence
  }));

  return {
    primaryLanguage: parsedDocument.primaryLanguage,
    parseConfidence: parsedDocument.parseConfidence ?? null,
    parseWarnings: parsedDocument.warnings ?? [],
    sections: sectionSnippets,
    tables: tableSnippets,
    rawTextHead: compactWhitespace(head),
    rawTextTail: compactWhitespace(tail)
  };
}

function buildExtractedSnapshot(extracted: Pass1Output): Record<string, unknown> {
  return {
    clientName: extracted.clientName,
    projectName: extracted.projectName,
    projectDescription: extracted.projectDescription,
    scopeOfWork: extracted.scopeOfWork,
    evaluationCriteria: extracted.evaluationCriteria,
    evaluationCriteriaStructured: extracted.evaluationCriteriaStructured,
    requiredDeliverables: extracted.requiredDeliverables,
    deliverableRequirements: extracted.deliverableRequirements,
    importantDates: extracted.importantDates,
    submissionRequirements: extracted.submissionRequirements,
    confidenceScores: extracted.confidenceScores,
    warnings: extracted.warnings
  };
}

function sanitizeDeterministicHints(input: AiAdjudicationInput["deterministicHints"]): AiAdjudicationInput["deterministicHints"] {
  return {
    verificationScore: clamp01(input.verificationScore),
    completenessScore: clamp01(input.completenessScore),
    warnings: dedupeStrings(input.warnings).map((warning) => clipText(warning, 200)).slice(0, 16),
    redFlags: input.redFlags.slice(0, 8).map((flag) => ({
      type: flag.type,
      severity: flag.severity,
      title: clipText(flag.title, 120),
      description: clipText(flag.description, 260),
      sourceText: clipText(flag.sourceText, 220),
      recommendation: clipText(flag.recommendation, 220)
    })),
    missingInformation: input.missingInformation.slice(0, 12).map((item) => ({
      field: clipText(item.field, 80),
      suggestedQuestion: clipText(item.suggestedQuestion, 220)
    })),
    conflicts: input.conflicts.slice(0, 10).map((conflict) => ({
      field: clipText(conflict.field, 80),
      candidates: dedupeStrings(conflict.candidates).map((candidate) => clipText(candidate, 180)).slice(0, 8),
      resolution: clipText(conflict.resolution, 220)
    }))
  };
}

function normalizeResult(result: AiAdjudicationResult): AiAdjudicationResult {
  const normalizedFlags = dedupeStrings(result.qualityFlags.map(normalizeFlag)).slice(0, 14);
  const normalizedWarnings = dedupeStrings(result.warnings.map((warning) => clipText(warning, 220))).slice(0, 14);
  const normalizedBlockReasons = dedupeStrings(result.quality.blockReasons.map((reason) => clipText(reason, 220))).slice(0, 10);
  const normalizedMissingInformation = result.missingInformation.slice(0, 12).map((item) => ({
    field: clipText(item.field, 80),
    suggestedQuestion: clipText(item.suggestedQuestion, 220)
  }));
  const normalizedConflicts = result.conflicts.slice(0, 8).map((conflict) => ({
    field: clipText(conflict.field, 80),
    candidates: dedupeStrings(conflict.candidates.map((candidate) => clipText(candidate, 180))).slice(0, 8),
    resolution: clipText(conflict.resolution, 220)
  }));
  const normalizedRedFlags = result.redFlags.slice(0, 8).map((flag) => ({
    ...flag,
    title: clipText(flag.title, 120),
    description: clipText(flag.description, 320),
    sourceText: clipText(flag.sourceText, 260),
    recommendation: clipText(flag.recommendation, 260)
  }));

  const blocked = result.quality.status === "blocked" || normalizedBlockReasons.length > 0;
  const status: "pass" | "review_required" | "blocked" = blocked ? "blocked" : result.quality.status;

  return {
    ...result,
    redFlags: normalizedRedFlags,
    missingInformation: normalizedMissingInformation,
    conflicts: normalizedConflicts,
    verificationScore: clamp01(result.verificationScore),
    completenessScore: clamp01(result.completenessScore),
    warnings: normalizedWarnings,
    qualityFlags: normalizedFlags,
    quality: {
      status,
      blockReasons: normalizedBlockReasons,
      evidenceDensity: clamp01(result.quality.evidenceDensity),
      sectionScores: {
        extraction: clamp01(result.quality.sectionScores.extraction),
        scope: clamp01(result.quality.sectionScores.scope),
        evaluation: clamp01(result.quality.sectionScores.evaluation)
      }
    }
  };
}

function buildAdjudicationPrompt(payload: {
  analysisId: string;
  sourceContext: Record<string, unknown>;
  extractedSnapshot: Record<string, unknown>;
  deterministicHints: AiAdjudicationInput["deterministicHints"];
}): string {
  return `${AI_ADJUDICATION_PROMPT}

analysisId: ${payload.analysisId}

SOURCE_CONTEXT_JSON:
${JSON.stringify(payload.sourceContext)}

EXTRACTED_FIELDS_JSON:
${JSON.stringify(payload.extractedSnapshot)}

DETERMINISTIC_HINTS_JSON:
${JSON.stringify(payload.deterministicHints)}
`;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function stripMarkdownCodeFences(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json|JSON|jsonc|yaml|YAML)?\s*\n?/gm, "");
  cleaned = cleaned.replace(/\n?\s*```\s*$/gm, "");
  cleaned = cleaned.replace(/^[^{\[]*?(?=[{\[])/s, "");
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }
  return cleaned.trim();
}

function extractFirstBalancedJsonObject(raw: string): string | null {
  const sanitized = stripMarkdownCodeFences(raw);
  const start = sanitized.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < sanitized.length; index += 1) {
    const char = sanitized[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return sanitized.slice(start, index + 1);
      }
    }
  }

  return null;
}

function appendMissingJsonClosers(input: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      stack.push("}");
      continue;
    }
    if (char === "[") {
      stack.push("]");
      continue;
    }
    if ((char === "}" || char === "]") && stack.length > 0 && stack[stack.length - 1] === char) {
      stack.pop();
    }
  }

  if (stack.length === 0) {
    return input;
  }
  return `${input}${stack.reverse().join("")}`;
}

function normalizeJsonLikeAttempts(base: string): string[] {
  const quoteUnquotedKeys = (input: string): string =>
    input.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, "$1\"$2\"$3");

  const singleToDoubleQuotedStrings = (input: string): string =>
    input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner: string) => `"${inner.replace(/"/g, "\\\"")}"`);

  const escapeNewlinesInJsonStrings = (input: string): string => {
    let output = "";
    let inString = false;
    let escaped = false;

    for (const char of input) {
      if (inString) {
        if (escaped) {
          output += char;
          escaped = false;
          continue;
        }
        if (char === "\\") {
          output += char;
          escaped = true;
          continue;
        }
        if (char === "\"") {
          output += char;
          inString = false;
          continue;
        }
        if (char === "\n" || char === "\r") {
          output += "\\n";
          continue;
        }
        output += char;
        continue;
      }

      if (char === "\"") {
        inString = true;
      }
      output += char;
    }

    return output;
  };

  const cleaned = base.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1");
  const attempts = [
    base,
    cleaned,
    quoteUnquotedKeys(cleaned),
    singleToDoubleQuotedStrings(cleaned),
    appendMissingJsonClosers(cleaned),
    escapeNewlinesInJsonStrings(cleaned),
    escapeNewlinesInJsonStrings(appendMissingJsonClosers(cleaned))
  ];

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const attempt of attempts) {
    const normalized = attempt.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function parseObjectFromModelText(raw: string): Record<string, unknown> | null {
  const balancedJson = extractFirstBalancedJsonObject(raw);
  const sanitizedRaw = stripMarkdownCodeFences(raw);
  const firstBraceIndex = sanitizedRaw.indexOf("{");
  const jsonLike = balancedJson ?? (firstBraceIndex >= 0 ? sanitizedRaw.slice(firstBraceIndex).trim() : null);

  if (!jsonLike) {
    return null;
  }

  const attempts = normalizeJsonLikeAttempts(jsonLike);
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      const record = toRecord(parsed);
      if (record) {
        return record;
      }
    } catch {
      // continue
    }
  }

  for (const attempt of attempts) {
    try {
      const parsed = parseYaml(attempt);
      const record = toRecord(parsed);
      if (record) {
        return record;
      }
    } catch {
      // continue
    }
  }

  return null;
}

function normalizeAdjudicationFromLooseObject(
  looseObject: Record<string, unknown>,
  deterministicHints: AiAdjudicationInput["deterministicHints"]
): AiAdjudicationResult | null {
  const hints = sanitizeDeterministicHints(deterministicHints);
  const looseQuality = toRecord(looseObject.quality) ?? {};
  const looseSectionScores = toRecord(looseQuality.sectionScores) ?? {};

  const normalizedWarnings = dedupeStrings([
    ...toArray(looseObject.warnings).map((item) => clipText(compactWhitespace(toString(item)), 220)),
    ...hints.warnings.map((warning) => clipText(compactWhitespace(warning), 220))
  ]).slice(0, 20);

  const normalizedFlags = dedupeStrings(
    toArray(looseObject.qualityFlags)
      .map((item) => normalizeFlag(toString(item)))
      .filter(Boolean)
  ).slice(0, 14);

  const normalizedMissingInformation = toArray(looseObject.missingInformation)
    .map((item) => {
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const field = clipText(compactWhitespace(toString(record.field)), 120);
      const suggestedQuestion = clipText(compactWhitespace(toString(record.suggestedQuestion)), 320);
      if (!field || !suggestedQuestion) {
        return null;
      }
      return { field, suggestedQuestion };
    })
    .filter((item): item is { field: string; suggestedQuestion: string } => Boolean(item))
    .slice(0, 16);

  const normalizedConflicts = toArray(looseObject.conflicts)
    .map((item) => {
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const field = clipText(compactWhitespace(toString(record.field)), 120);
      const resolution = clipText(compactWhitespace(toString(record.resolution)), 500);
      const candidates = dedupeStrings(
        toArray(record.candidates)
          .map((candidate) => clipText(compactWhitespace(toString(candidate)), 400))
          .filter(Boolean)
      )
        .slice(0, 20);
      const fallbackCandidate = field || resolution;
      const normalizedCandidates = candidates.length > 0 ? candidates : fallbackCandidate ? [fallbackCandidate] : [];
      if (!field || !resolution || normalizedCandidates.length === 0) {
        return null;
      }
      return {
        field,
        candidates: normalizedCandidates,
        resolution
      };
    })
    .filter((item): item is { field: string; candidates: string[]; resolution: string } => Boolean(item))
    .slice(0, 12);

  const normalizedRedFlags = toArray(looseObject.redFlags)
    .map((item) => {
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const typeRaw = toString(record.type).toLowerCase();
      const severityRaw = toString(record.severity).toUpperCase();
      const type = typeRaw === "contractual" || typeRaw === "feasibility" || typeRaw === "process" ? typeRaw : null;
      const severity = severityRaw === "HIGH" || severityRaw === "MEDIUM" || severityRaw === "LOW" ? severityRaw : null;
      const title = clipText(compactWhitespace(toString(record.title)), 120);
      const description = clipText(compactWhitespace(toString(record.description)), 320);
      const sourceText = clipText(compactWhitespace(toString(record.sourceText)), 260);
      const recommendation = clipText(compactWhitespace(toString(record.recommendation)), 260);
      if (!type || !severity || !title || !description || !sourceText || !recommendation) {
        return null;
      }
      return { type, severity, title, description, sourceText, recommendation };
    })
    .filter(
      (
        item
      ): item is {
        type: "contractual" | "feasibility" | "process";
        severity: "HIGH" | "MEDIUM" | "LOW";
        title: string;
        description: string;
        sourceText: string;
        recommendation: string;
      } => Boolean(item)
    )
    .slice(0, 8);

  const blockReasons = dedupeStrings(
    toArray(looseQuality.blockReasons)
      .map((item) => clipText(compactWhitespace(toString(item)), 500))
      .filter(Boolean)
  ).slice(0, 12);

  const verificationScore = clamp01(parseNumber(looseObject.verificationScore, hints.verificationScore));
  const completenessScore = clamp01(parseNumber(looseObject.completenessScore, hints.completenessScore));
  const qualityStatusRaw = toString(looseQuality.status).toLowerCase();
  const qualityStatus =
    qualityStatusRaw === "pass" || qualityStatusRaw === "review_required" || qualityStatusRaw === "blocked"
      ? qualityStatusRaw
      : "review_required";

  const qualityCandidate: AiAdjudicationResult = {
    verificationScore,
    completenessScore,
    redFlags: normalizedRedFlags.length > 0 ? normalizedRedFlags : hints.redFlags,
    missingInformation:
      normalizedMissingInformation.length > 0 ? normalizedMissingInformation : hints.missingInformation,
    conflicts: normalizedConflicts.length > 0 ? normalizedConflicts : hints.conflicts,
    warnings: normalizedWarnings,
    qualityFlags: normalizedFlags,
    quality: {
      status: qualityStatus,
      blockReasons,
      evidenceDensity: clamp01(parseNumber(looseQuality.evidenceDensity, verificationScore)),
      sectionScores: {
        extraction: clamp01(parseNumber(looseSectionScores.extraction, verificationScore)),
        scope: clamp01(parseNumber(looseSectionScores.scope, completenessScore)),
        evaluation: clamp01(parseNumber(looseSectionScores.evaluation, completenessScore))
      }
    }
  };

  const validated = AiAdjudicationSchema.safeParse(qualityCandidate);
  if (!validated.success) {
    return null;
  }
  return normalizeResult(validated.data);
}

function extractTextFromAiError(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const directText = (error as { text?: unknown }).text;
  if (typeof directText === "string" && directText.trim().length > 0) {
    return directText;
  }

  const responseText = (error as { response?: { text?: unknown } }).response?.text;
  if (typeof responseText === "string" && responseText.trim().length > 0) {
    return responseText;
  }

  const causeText = (error as { cause?: { text?: unknown } }).cause?.text;
  if (typeof causeText === "string" && causeText.trim().length > 0) {
    return causeText;
  }

  return null;
}

export const __aiAdjudicatorTestUtils = {
  parseObjectFromModelText,
  normalizeAdjudicationFromLooseObject,
  extractTextFromAiError
};

export async function runAiAdjudication(input: AiAdjudicationInput): Promise<AiAdjudicationResult> {
  const apiKey = resolveGoogleApiKey();
  if (!apiKey) {
    throw new Error(
      "No Gemini API key configured. Set GOOGLE_API_KEY or GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
    );
  }

  const googleProvider = createGoogleGenerativeAI({ apiKey });
  const sourceContext = buildSourceContext(input.parsedDocument);
  const extractedSnapshot = buildExtractedSnapshot(input.extracted);
  const deterministicHints = sanitizeDeterministicHints(input.deterministicHints);
  const adjudicationPrompt = buildAdjudicationPrompt({
    analysisId: input.analysisId,
    sourceContext,
    extractedSnapshot,
    deterministicHints
  });

  try {
    const result = await runWithGeminiFlashModel((model) =>
      generateText({
        model: googleProvider(model),
        temperature: 0,
        abortSignal: AbortSignal.timeout(AI_ADJUDICATION_TIMEOUT_MS),
        experimental_output: Output.object({
          schema: AiAdjudicationSchema
        }),
        prompt: adjudicationPrompt
      })
    );

    if (!result.experimental_output) {
      throw new Error("AI adjudication returned no structured output.");
    }

    return normalizeResult(result.experimental_output);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const errorText = extractTextFromAiError(error);
    if (errorText) {
      const parsedErrorObject = parseObjectFromModelText(errorText);
      if (parsedErrorObject) {
        const fromErrorText = normalizeAdjudicationFromLooseObject(parsedErrorObject, deterministicHints);
        if (fromErrorText) {
          console.warn("[Adjudication] Recovered from structured-output validation failure via error text.");
          return fromErrorText;
        }
      }
    }

    console.warn(
      `[Adjudication] Structured generation failed; retrying text-mode JSON fallback: ${clipText(message, 260)}`
    );
  }

  const fallbackResponse = await runWithGeminiFlashModel((model) =>
    generateText({
      model: googleProvider(model),
      temperature: 0,
      maxOutputTokens: 8_192,
      abortSignal: AbortSignal.timeout(AI_ADJUDICATION_TIMEOUT_MS),
      prompt:
        `${adjudicationPrompt}\n` +
        "\nCRITICAL OUTPUT RULES:\n" +
        "- Return ONLY one raw JSON object.\n" +
        "- Do not use markdown code fences.\n" +
        "- No prose, notes, or commentary outside JSON.\n" +
        "- Keep strings concise (<= 320 chars unless source quote).\n"
    })
  );

  const fallbackObject = parseObjectFromModelText(fallbackResponse.text ?? "");
  if (!fallbackObject) {
    throw new Error("AI adjudication text-mode fallback returned unparsable JSON.");
  }

  const normalizedFallback = normalizeAdjudicationFromLooseObject(fallbackObject, deterministicHints);
  if (!normalizedFallback) {
    throw new Error("AI adjudication text-mode fallback could not be normalized to schema.");
  }
  return normalizedFallback;
}
