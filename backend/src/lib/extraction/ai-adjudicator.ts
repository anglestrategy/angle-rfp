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
        field: z.string().min(1).max(80),
        suggestedQuestion: z.string().min(1).max(220)
      })
    )
    .max(12)
    .default([]),
  conflicts: z
    .array(
      z.object({
        field: z.string().min(1).max(80),
        candidates: z.array(z.string().min(1).max(180)).min(2).max(8),
        resolution: z.string().min(1).max(220)
      })
    )
    .max(8)
    .default([]),
  warnings: z.array(z.string().min(3).max(220)).max(14).default([]),
  qualityFlags: z.array(z.string().min(2).max(64)).max(14).default([]),
  quality: z.object({
    status: z.enum(["pass", "review_required", "blocked"]),
    blockReasons: z.array(z.string().min(3).max(220)).max(10).default([]),
    evidenceDensity: z.number().min(0).max(1),
    sectionScores: QualitySectionScoresSchema
  })
});

export type AiAdjudicationResult = z.infer<typeof AiAdjudicationSchema>;

const AI_ADJUDICATION_TIMEOUT_MS = positiveIntFromEnv(
  process.env.EXTRACTION_AI_ADJUDICATION_TIMEOUT_MS,
  120_000
);
const RAW_HEAD_CHARS = positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_HEAD_CHARS, 16_000);
const RAW_TAIL_CHARS = positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_TAIL_CHARS, 5_000);
const SECTION_SNIPPET_CHARS = positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_SECTION_CHARS, 2_800);
const TABLE_ROW_LIMIT = Math.max(1, Math.min(6, positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_TABLE_ROWS, 4)));
const TABLE_COUNT_LIMIT = Math.max(
  0,
  Math.min(4, positiveIntFromEnv(process.env.EXTRACTION_AI_ADJUDICATION_TABLE_COUNT, 2))
);

const AI_ADJUDICATION_PROMPT = `You are the intelligence layer for an RFP analysis dashboard.

Your job is to decide whether extracted fields are valid, complete, and placed in the correct dashboard sections.
Do not invent details. If evidence is weak, lower confidence and request review.

Dashboard mapping:
- projectDescription -> Executive Summary
- scopeOfWork -> Scope Analysis
- evaluationCriteria -> Evaluation Criteria
- requiredDeliverables + deliverableRequirements -> Deliverables
- importantDates -> Important Dates
- submissionRequirements -> Submission Requirements

Return STRICT JSON only matching the schema.

Scoring guidance:
- verificationScore: how well extracted values match source context
- completenessScore: presence of decision-critical data
- quality.status:
  - pass: extraction is coherent and decision-ready
  - review_required: mostly usable but has moderate ambiguity
  - blocked: major conflicts or missing critical sections

Quality flags should be short snake_case tags (e.g., low_scope_confidence, conflicting_dates, misplaced_content).
Keep warnings short and actionable.
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

function normalizeResult(result: AiAdjudicationResult): AiAdjudicationResult {
  const normalizedFlags = dedupeStrings(result.qualityFlags.map(normalizeFlag)).slice(0, 14);
  const normalizedWarnings = dedupeStrings(result.warnings).slice(0, 14);
  const normalizedBlockReasons = dedupeStrings(result.quality.blockReasons).slice(0, 10);

  const blocked = result.quality.status === "blocked" || normalizedBlockReasons.length > 0;
  const status: "pass" | "review_required" | "blocked" = blocked ? "blocked" : result.quality.status;

  return {
    ...result,
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
${JSON.stringify(input.deterministicHints)}
`
    })
  );

  if (!result.experimental_output) {
    throw new Error("AI adjudication returned no structured output.");
  }

  return normalizeResult(result.experimental_output);
}
