import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
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

  const result = await runWithGeminiFlashModel((model) =>
    generateText({
      model: googleProvider(model),
      temperature: 0,
      abortSignal: AbortSignal.timeout(AI_ADJUDICATION_TIMEOUT_MS),
      experimental_output: Output.object({
        schema: AiAdjudicationSchema
      }),
      prompt: `${AI_ADJUDICATION_PROMPT}

analysisId: ${input.analysisId}

SOURCE_CONTEXT_JSON:
${JSON.stringify(sourceContext)}

EXTRACTED_FIELDS_JSON:
${JSON.stringify(extractedSnapshot)}

DETERMINISTIC_HINTS_JSON:
${JSON.stringify(deterministicHints)}
`
    })
  );

  if (!result.experimental_output) {
    throw new Error("AI adjudication returned no structured output.");
  }

  return normalizeResult(result.experimental_output);
}
