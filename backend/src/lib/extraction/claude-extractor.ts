import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import {
  getGeminiModelResolutionDiagnostics,
  resolveGoogleApiKey,
  runWithGeminiFlashModel
} from "@/lib/ai/model-resolver";

function coerceString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function parseCopyCount(value: unknown): number | null {
  const normalized = coerceString(value, "").trim();
  if (!normalized) {
    return null;
  }
  const digits = normalized.match(/\d+/)?.[0];
  if (!digits) {
    return null;
  }
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const LooseDeliverableSchema = z.object({
  item: z.string().nullable().optional(),
  source: z.enum(["verbatim", "inferred"]).optional()
});

const LooseDeliverableRequirementEntrySchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  source: z.enum(["verbatim", "inferred"]).optional()
});

const LooseDeliverableRequirementGroupsSchema = z.object({
  technical: z.array(LooseDeliverableRequirementEntrySchema).default([]),
  commercial: z.array(LooseDeliverableRequirementEntrySchema).default([]),
  strategicCreative: z.array(LooseDeliverableRequirementEntrySchema).default([])
});

const ClaudeWindowFieldsSchema = z.object({
  clientName: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  projectDescription: z.string().nullable().optional(),
  scopeOfWork: z.string().nullable().optional(),
  evaluationCriteria: z.string().nullable().optional(),
  requiredDeliverables: z.array(LooseDeliverableSchema).default([]),
  deliverableRequirements: LooseDeliverableRequirementGroupsSchema.default({
    technical: [],
    commercial: [],
    strategicCreative: []
  }),
  importantDates: z.array(
    z.object({
      title: z.string().nullable().optional(),
      date: z.string().nullable().optional(),
      type: z.enum(["submission_deadline", "qa_deadline", "presentation", "other"]).optional()
    })
  ).default([]),
  submissionRequirements: z.object({
    method: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    format: z.string().nullable().optional(),
    physicalAddress: z.string().nullable().optional(),
    copies: z.string().nullable().optional()
  }).default({})
});

type ClaudeWindowFields = z.infer<typeof ClaudeWindowFieldsSchema>;

export interface ClaudeExtractedFields {
  clientName: string;
  projectName: string;
  projectDescription: string;
  scopeOfWork: string;
  evaluationCriteria: string;
  requiredDeliverables: Array<{ item: string; source: "verbatim" | "inferred" }>;
  deliverableRequirements: {
    technical: Array<{ title: string; description: string; source: "verbatim" | "inferred" }>;
    commercial: Array<{ title: string; description: string; source: "verbatim" | "inferred" }>;
    strategicCreative: Array<{ title: string; description: string; source: "verbatim" | "inferred" }>;
  };
  importantDates: Array<{
    title: string;
    date: string;
    type: "submission_deadline" | "qa_deadline" | "presentation" | "other";
  }>;
  submissionRequirements: {
    method: string;
    email: string | null;
    format: string;
    physicalAddress: string | null;
    copies: number | null;
  };
}

function canonicalizeWindowFields(input: ClaudeWindowFields): ClaudeExtractedFields {
  const normalizeEntry = (entry: { title?: string | null; description?: string | null; source?: "verbatim" | "inferred" }) => ({
    title: coerceString(entry.title, ""),
    description: coerceString(entry.description, ""),
    source: entry.source === "inferred" ? "inferred" as const : "verbatim" as const
  });

  const normalizeOptional = (value: unknown): string | null => {
    const normalized = coerceString(value, "").trim();
    return normalized.length > 0 ? normalized : null;
  };

  const normalizeDeliverable = (
    item: { item?: string | null; source?: "verbatim" | "inferred" }
  ): { item: string; source: "verbatim" | "inferred" } => {
    return {
      item: coerceString(item.item, ""),
      source: item.source === "inferred" ? "inferred" : "verbatim"
    };
  };

  return {
    clientName: coerceString(input.clientName, ""),
    projectName: coerceString(input.projectName, ""),
    projectDescription: coerceString(input.projectDescription, ""),
    scopeOfWork: coerceString(input.scopeOfWork, ""),
    evaluationCriteria: coerceString(input.evaluationCriteria, ""),
    requiredDeliverables: (input.requiredDeliverables ?? [])
      .map((entry) => normalizeDeliverable(entry))
      .filter((entry) => entry.item.trim().length > 0),
    deliverableRequirements: {
      technical: (input.deliverableRequirements?.technical ?? [])
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => entry.title.length > 0 || entry.description.length > 0),
      commercial: (input.deliverableRequirements?.commercial ?? [])
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => entry.title.length > 0 || entry.description.length > 0),
      strategicCreative: (input.deliverableRequirements?.strategicCreative ?? [])
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => entry.title.length > 0 || entry.description.length > 0)
    },
    importantDates: (input.importantDates ?? []).map((item) => ({
      title: coerceString(item.title, ""),
      date: coerceString(item.date, ""),
      type: item.type ?? "other"
    })),
    submissionRequirements: {
      method: coerceString(input.submissionRequirements?.method, "Unknown"),
      email: normalizeOptional(input.submissionRequirements?.email),
      format: coerceString(input.submissionRequirements?.format, "Unspecified"),
      physicalAddress: normalizeOptional(input.submissionRequirements?.physicalAddress),
      copies: parseCopyCount(input.submissionRequirements?.copies ?? null)
    }
  };
}

export interface ExtractionCoverage {
  chunksTotal: number;
  chunksAnalyzed: number;
  coveragePercent: number;
  missingSectionTags: string[];
  rawTextChars: number;
  contextChars: number;
}

export interface ClaudeExtractionResult {
  fields: ClaudeExtractedFields;
  coverage: ExtractionCoverage;
}

function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const API_TIMEOUT_MS = positiveIntFromEnv(process.env.EXTRACTION_MODEL_TIMEOUT_MS, 180_000);
const WINDOW_TIMEOUT_MS = positiveIntFromEnv(process.env.EXTRACTION_WINDOW_TIMEOUT_MS, 120_000);
const EXTRACTION_TOTAL_TIMEOUT_MS = positiveIntFromEnv(process.env.EXTRACTION_TOTAL_TIMEOUT_MS, 9 * 60 * 1000);
const WINDOW_CONTEXT_CHARS = positiveIntFromEnv(process.env.EXTRACTION_WINDOW_CONTEXT_CHARS, 180_000);
const WINDOW_CONCURRENCY = Math.max(
  1,
  Math.min(4, positiveIntFromEnv(process.env.EXTRACTION_WINDOW_CONCURRENCY, 2))
);
const WINDOW_MAX_RETRIES = Math.max(0, Math.min(3, positiveIntFromEnv(process.env.EXTRACTION_WINDOW_RETRIES, 1)));
const WINDOW_MAX_SPLIT_DEPTH = Math.max(0, Math.min(3, positiveIntFromEnv(process.env.EXTRACTION_WINDOW_SPLIT_DEPTH, 1)));
const CHUNK_SIZE_CHARS = positiveIntFromEnv(process.env.EXTRACTION_CHUNK_SIZE_CHARS, 12_000);
const CHUNK_OVERLAP_CHARS = Math.min(
  CHUNK_SIZE_CHARS - 1,
  positiveIntFromEnv(process.env.EXTRACTION_CHUNK_OVERLAP_CHARS, 1_200)
);
const PROJECT_DESCRIPTION_MERGE_MAX_CHARS = positiveIntFromEnv(
  process.env.EXTRACTION_PROJECT_DESCRIPTION_MAX_CHARS,
  6_000
);
const SCOPE_MERGE_MAX_CHARS = positiveIntFromEnv(
  process.env.EXTRACTION_SCOPE_MAX_CHARS,
  24_000
);
const EVALUATION_MERGE_MAX_CHARS = positiveIntFromEnv(
  process.env.EXTRACTION_EVALUATION_MAX_CHARS,
  24_000
);
const EXTRACTION_MIN_COVERAGE = (() => {
  const parsed = Number(process.env.EXTRACTION_MIN_COVERAGE ?? "");
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) {
    return parsed;
  }
  return 0.98;
})();
interface DocChunk {
  index: number;
  start: number;
  end: number;
  text: string;
  tags: string[];
}

interface ChunkWindow {
  index: number;
  chunks: DocChunk[];
}

const CRITICAL_TAGS = ["scope", "evaluation", "deliverables", "dates", "submission"];
const TAG_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "scope", pattern: /scope\s+of\s+work|statement\s+of\s+work|scope\s+items|نطاق\s+العمل/iu },
  { tag: "evaluation", pattern: /evaluation\s+criteria|technical\s+evaluation|scoring|weight(?:ed)?|معايير\s+التقييم/iu },
  { tag: "deliverables", pattern: /deliverables?|required\s+submission|proposal\s+requirements?|المخرجات|التسليم/iu },
  { tag: "dates", pattern: /important\s+dates?|timeline|deadline|submission date|موعد|تاريخ/iu },
  { tag: "submission", pattern: /submission\s+format|submission\s+requirements?|طريقة\s+التقديم|portal|email/i },
  { tag: "legal", pattern: /terms?\s*&?\s*conditions?|liability|governing law|indemnif|الشروط/iu }
];

function normalizeWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function detectTags(text: string): string[] {
  const tags = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(text)) {
      tags.add(rule.tag);
    }
  }
  return Array.from(tags);
}

function chunkDocument(rawText: string): DocChunk[] {
  const chunks: DocChunk[] = [];
  let cursor = 0;
  let index = 0;
  const step = Math.max(1, CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS);

  while (cursor < rawText.length) {
    const end = Math.min(rawText.length, cursor + CHUNK_SIZE_CHARS);
    const text = rawText.slice(cursor, end).trim();
    if (text.length > 0) {
      chunks.push({
        index,
        start: cursor,
        end,
        text,
        tags: detectTags(text)
      });
      index += 1;
    }
    if (end >= rawText.length) {
      break;
    }
    cursor += step;
  }

  return chunks;
}

function renderCoverageContext(chunks: DocChunk[], _budgetChars: number): string {
  if (chunks.length === 0) {
    return "";
  }

  return chunks
    .map((chunk) => {
      const tags = chunk.tags.join(",") || "none";
      return `[chunk:${chunk.index} range:${chunk.start}-${chunk.end} tags:${tags}]\n${chunk.text}`;
    })
    .join("\n\n");
}

function buildChunkWindows(chunks: DocChunk[]): ChunkWindow[] {
  if (chunks.length === 0) {
    return [];
  }

  const windows: ChunkWindow[] = [];
  let cursor = 0;
  while (cursor < chunks.length) {
    const windowChunks: DocChunk[] = [];
    let usedChars = 0;
    while (cursor < chunks.length) {
      const next = chunks[cursor];
      const nextCost = next.text.length + 120;
      if (windowChunks.length > 0 && usedChars + nextCost > WINDOW_CONTEXT_CHARS) {
        break;
      }
      windowChunks.push(next);
      usedChars += nextCost;
      cursor += 1;
    }
    if (windowChunks.length === 0) {
      windowChunks.push(chunks[cursor]);
      cursor += 1;
    }
    windows.push({
      index: windows.length,
      chunks: windowChunks
    });
  }

  return windows;
}

function renderWindowContext(window: ChunkWindow): string {
  const coverageContext = renderCoverageContext(window.chunks, WINDOW_CONTEXT_CHARS);
  return ["[window_coverage_context]", coverageContext].join("\n");
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
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

function mergeTextBlocks(values: string[], maxChars: number): string {
  const unique = dedupeStrings(values);
  if (unique.length === 0) {
    return "";
  }
  let merged = unique.join("\n");
  if (merged.length > maxChars) {
    merged = merged.slice(0, maxChars).trim();
  }
  return merged;
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return raw.slice(start, end + 1);
}

function parseWindowFieldsFromText(raw: string): ClaudeWindowFields | null {
  const json = extractFirstJsonObject(raw);
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json);
    const validated = ClaudeWindowFieldsSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }
    return validated.data;
  } catch {
    return null;
  }
}

export async function withHardTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000;
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, safeTimeout);

    operation
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function mergeDeliverables(
  results: ClaudeExtractedFields[]
): ClaudeExtractedFields["requiredDeliverables"] {
  const merged = new Map<string, { item: string; source: "verbatim" | "inferred" }>();

  for (const result of results) {
    for (const entry of result.requiredDeliverables) {
      const item = normalizeWhitespace(entry.item);
      if (!item) {
        continue;
      }
      const key = item.toLowerCase();
      const existing = merged.get(key);
      if (!existing || (existing.source === "inferred" && entry.source === "verbatim")) {
        merged.set(key, { item, source: entry.source });
      }
    }
  }

  return Array.from(merged.values());
}

function mergeDeliverableRequirementGroup(
  groups: Array<ClaudeExtractedFields["deliverableRequirements"]>,
  key: keyof ClaudeExtractedFields["deliverableRequirements"]
): ClaudeExtractedFields["deliverableRequirements"][typeof key] {
  const deduped = new Map<string, { title: string; description: string; source: "verbatim" | "inferred" }>();
  for (const group of groups) {
    for (const item of group[key]) {
      const title = normalizeWhitespace(item.title);
      const description = normalizeWhitespace(item.description);
      if (!title && !description) {
        continue;
      }
      const dedupeKey = `${title.toLowerCase()}|${description.toLowerCase()}`;
      const existing = deduped.get(dedupeKey);
      if (!existing || (existing.source === "inferred" && item.source === "verbatim")) {
        deduped.set(dedupeKey, {
          title,
          description,
          source: item.source
        });
      }
    }
  }
  return Array.from(deduped.values());
}

function mergeImportantDates(results: ClaudeExtractedFields[]): ClaudeExtractedFields["importantDates"] {
  const deduped = new Map<string, ClaudeExtractedFields["importantDates"][number]>();
  for (const result of results) {
    for (const item of result.importantDates) {
      const title = normalizeWhitespace(item.title);
      const date = normalizeWhitespace(item.date);
      if (!title && !date) {
        continue;
      }
      const dedupeKey = `${title.toLowerCase()}|${date}|${item.type}`;
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, {
          title,
          date,
          type: item.type
        });
      }
    }
  }
  return Array.from(deduped.values());
}

function pickSubmissionRequirements(results: ClaudeExtractedFields[]): ClaudeExtractedFields["submissionRequirements"] {
  for (const result of results) {
    const candidate = result.submissionRequirements;
    const hasSignal =
      normalizeWhitespace(candidate.method) !== "" ||
      normalizeWhitespace(candidate.format) !== "" ||
      normalizeWhitespace(candidate.email ?? "") !== "";
    if (hasSignal) {
      return candidate;
    }
  }
  return {
    method: "Unknown",
    email: null,
    format: "Unspecified",
    physicalAddress: null,
    copies: null
  };
}

function mergeWindowResults(results: ClaudeExtractedFields[]): ClaudeExtractedFields {
  const projectDescriptions = results.map((r) => r.projectDescription);
  const scopeBlocks = results.map((r) => r.scopeOfWork);
  const evaluationBlocks = results.map((r) => r.evaluationCriteria);

  const firstNonEmpty = (values: string[]): string =>
    dedupeStrings(values).find((value) => value.length > 0) ?? "";

  const deliverableRequirementGroups = results.map((result) => result.deliverableRequirements);

  return {
    clientName: firstNonEmpty(results.map((r) => r.clientName)),
    projectName: firstNonEmpty(results.map((r) => r.projectName)),
    projectDescription: mergeTextBlocks(projectDescriptions, PROJECT_DESCRIPTION_MERGE_MAX_CHARS),
    scopeOfWork: mergeTextBlocks(scopeBlocks, SCOPE_MERGE_MAX_CHARS),
    evaluationCriteria: mergeTextBlocks(evaluationBlocks, EVALUATION_MERGE_MAX_CHARS),
    requiredDeliverables: mergeDeliverables(results),
    deliverableRequirements: {
      technical: mergeDeliverableRequirementGroup(deliverableRequirementGroups, "technical"),
      commercial: mergeDeliverableRequirementGroup(deliverableRequirementGroups, "commercial"),
      strategicCreative: mergeDeliverableRequirementGroup(deliverableRequirementGroups, "strategicCreative")
    },
    importantDates: mergeImportantDates(results),
    submissionRequirements: pickSubmissionRequirements(results)
  };
}

const EXTRACTION_PROMPT = `You are a senior RFP analyst at a creative agency. Extract decision-useful structured data.

You are given a coverage-annotated document context with chunk markers. Read ALL chunks, especially priority chunks.
Return ONLY valid JSON matching the requested schema.

RULES:
1. clientName must be the RFP issuer (not bidders/vendors).
2. scopeOfWork must include only actual execution scope items, concise bullets.
3. evaluationCriteria must be clean, grouped, no markdown artifacts.
4. Return only strict JSON that matches schema exactly (no nulls for required strings).
5. requiredDeliverables must contain PROJECT DELIVERABLES - what the agency will CREATE for the client:
   - Strategic documents (brand strategy, positioning, messaging frameworks)
   - Creative outputs (campaigns, concepts, key visuals, brand identity)
   - Design assets (templates, guidelines, adaptations)
   - Content/production (videos, photography, copy, content calendars)

   DO NOT include PROPOSAL SUBMISSION requirements (CVs, certificates, technical proposals,
   compliance docs, commercial proposals). These belong in deliverableRequirements.

   Focus on the Scope of Work section. List 5-8 MAJOR deliverables for executive scanning.
   REQUIRED FORMAT for each item:
   { "item": "deliverable text", "source": "verbatim" | "inferred" }

6. deliverableRequirements categorizes what the PROPOSAL must include (for bid preparation):
   - technical: methodology, team CVs, certifications, credentials
   - commercial: pricing, payment terms, financial docs
   - strategicCreative: sample work, case studies, creative approach
   Exclude legal boilerplate and generic terms/conditions.
7. importantDates should include critical deadlines in YYYY-MM-DD where possible.
8. Keep text executive-grade, concise, and non-duplicative.
9. submissionRequirements.copies must be a string (for example "2", "Two copies") or null.

Context:
`;

export async function extractWithClaude(rawText: string): Promise<ClaudeExtractionResult> {
  const startTime = Date.now();
  console.log(`[Extraction] Starting at ${new Date().toISOString()}, timeout: ${API_TIMEOUT_MS}ms`);
  const modelDiagnostics = getGeminiModelResolutionDiagnostics();
  console.log(
    `[Extraction] Model candidates: ${modelDiagnostics.candidates.join(", ")} (resolved=${modelDiagnostics.resolvedModel}${
      modelDiagnostics.sourceEnvVar ? ` via ${modelDiagnostics.sourceEnvVar}` : ""
    })`
  );
  if (modelDiagnostics.warnings.length > 0) {
    console.warn(`[Extraction] Model resolution warnings: ${modelDiagnostics.warnings.join(" | ")}`);
  }

  const apiKey = resolveGoogleApiKey();
  if (!apiKey) {
    throw new Error(
      "No Gemini API key configured. Set GOOGLE_API_KEY or GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
    );
  }
  const googleProvider = createGoogleGenerativeAI({ apiKey });
  const normalized = normalizeWhitespace(rawText);
  const chunks = chunkDocument(normalized);
  const windows = buildChunkWindows(chunks);
  const windowContexts = windows.map((window) => renderWindowContext(window));
  const criticalTagUniverse = new Set(chunks.flatMap((chunk) => chunk.tags));

  if (windows.length === 0) {
    throw new Error("No extractable content available after normalization.");
  }

  console.log(
    `[Extraction] Planned ${windows.length} windows across ${chunks.length} total chunks (` +
      `full-document AI coverage, raw chars=${normalized.length})`
  );

  const successfulResults: ClaudeExtractedFields[] = [];
  const analyzedChunkIndexes = new Set<number>();
  const failedWindows: Array<{ index: number; message: string }> = [];
  const activeControllers = new Set<AbortController>();
  const deadlineAt = startTime + EXTRACTION_TOTAL_TIMEOUT_MS;
  let windowCursor = 0;
  let stopRequested = false;

  function ensureWithinDeadline(): void {
    if (Date.now() <= deadlineAt) {
      return;
    }
    stopRequested = true;
    for (const controller of activeControllers) {
      controller.abort();
    }
    throw new Error(
      `AI extraction exceeded total budget (${Math.round(EXTRACTION_TOTAL_TIMEOUT_MS / 1000)}s).`
    );
  }

  async function executeWindowAttempt(window: ChunkWindow, context: string): Promise<ClaudeExtractedFields> {
    const abortController = new AbortController();
    activeControllers.add(abortController);
    const timeoutId = setTimeout(() => abortController.abort(), WINDOW_TIMEOUT_MS);
    try {
      const basePrompt =
        `${EXTRACTION_PROMPT}\n` +
        `You are processing window ${window.index + 1} of ${windows.length}. ` +
        "Extract only information explicitly present in this window. " +
        "If a field is not present in this window, leave it empty.\n\n" +
        context;

      try {
        const result = await withHardTimeout(
          runWithGeminiFlashModel((model) =>
            generateText({
              model: googleProvider(model),
              output: Output.object({
                schema: ClaudeWindowFieldsSchema
              }),
              temperature: 0,
              maxOutputTokens: 5200,
              abortSignal: abortController.signal,
              prompt: basePrompt
            })
          ),
          WINDOW_TIMEOUT_MS + 5_000,
          `Extraction window ${window.index + 1} timed out after ${Math.round((WINDOW_TIMEOUT_MS + 5_000) / 1000)}s`
        );
        return canonicalizeWindowFields(result.output!);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryWithTextMode =
          /no output generated|validation|schema|json/i.test(message);
        if (!retryWithTextMode) {
          throw error;
        }

        const textResult = await withHardTimeout(
          runWithGeminiFlashModel((model) =>
            generateText({
              model: googleProvider(model),
              temperature: 0,
              maxOutputTokens: 5200,
              abortSignal: abortController.signal,
              prompt:
                `${basePrompt}\n\n` +
                "Return only JSON matching the required schema. No markdown, no comments."
            })
          ),
          WINDOW_TIMEOUT_MS + 5_000,
          `Extraction window ${window.index + 1} text-mode fallback timed out`
        );
        const parsed = parseWindowFieldsFromText(textResult.text ?? "");
        if (!parsed) {
          throw new Error(
            `Structured fallback parse failed for window ${window.index + 1}: could not parse JSON payload.`
          );
        }
        console.warn(
          `[Extraction] Window ${window.index} recovered via text-mode JSON fallback`
        );
        return canonicalizeWindowFields(parsed);
      }
    } finally {
      clearTimeout(timeoutId);
      activeControllers.delete(abortController);
    }
  }

  async function processWindow(window: ChunkWindow, depth = 0): Promise<void> {
    ensureWithinDeadline();
    const context = renderWindowContext(window);
    const chunkTags = window.chunks.flatMap((c) => c.tags);
    let lastError: unknown;

    for (let attempt = 0; attempt <= WINDOW_MAX_RETRIES; attempt += 1) {
      ensureWithinDeadline();
      try {
        const normalized = await executeWindowAttempt(window, context);
        successfulResults.push(normalized);
        for (const chunk of window.chunks) {
          analyzedChunkIndexes.add(chunk.index);
        }
        console.log(
          `[Extraction] Window ${window.index} succeeded (depth=${depth}, chunks=${window.chunks.length}, tags=${chunkTags.join(",")})`
        );
        return;
      } catch (error) {
        lastError = error;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(
          `[Extraction] Window ${window.index} attempt ${attempt + 1} failed: ${errorMsg.slice(0, 150)}`
        );
        const retryable = attempt < WINDOW_MAX_RETRIES;
        if (retryable) {
          const backoffMs = Math.min(2000, 400 * (attempt + 1));
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }
    }

    if (depth < WINDOW_MAX_SPLIT_DEPTH && window.chunks.length > 1) {
      console.log(
        `[Extraction] Splitting window ${window.index} (${window.chunks.length} chunks) at depth ${depth}`
      );
      const midpoint = Math.ceil(window.chunks.length / 2);
      const left: ChunkWindow = {
        index: window.index,
        chunks: window.chunks.slice(0, midpoint)
      };
      const right: ChunkWindow = {
        index: window.index,
        chunks: window.chunks.slice(midpoint)
      };

      await processWindow(left, depth + 1);
      await processWindow(right, depth + 1);
      return;
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    console.error(
      `[Extraction] Window ${window.index} permanently failed (depth=${depth}, tags=${chunkTags.join(",")}): ${message.slice(0, 200)}`
    );
    failedWindows.push({ index: window.index, message });
  }

  async function worker(): Promise<void> {
    while (!stopRequested && windowCursor < windows.length) {
      ensureWithinDeadline();
      const currentIndex = windowCursor;
      windowCursor += 1;
      const window = windows[currentIndex];
      try {
        await processWindow(window);
      } catch (error) {
        stopRequested = true;
        const message = error instanceof Error ? error.message : String(error);
        failedWindows.push({ index: window.index, message });
      }
    }
  }

  const workers: Promise<void>[] = [];
  const effectiveConcurrency = Math.max(1, Math.min(WINDOW_CONCURRENCY, windows.length));
  for (let i = 0; i < effectiveConcurrency; i += 1) {
    workers.push(worker());
  }
  await Promise.allSettled(workers);

  if (successfulResults.length === 0) {
    const reason = failedWindows[0]?.message ?? "unknown extraction failure";
    throw new Error(`AI structured extraction failed across all windows: ${reason}`);
  }

  const mergedFields = mergeWindowResults(successfulResults);
  const analyzedTags = new Set<string>();
  for (const chunk of chunks) {
    if (analyzedChunkIndexes.has(chunk.index)) {
      for (const tag of chunk.tags) {
        analyzedTags.add(tag);
      }
    }
  }

  const missingSectionTags = CRITICAL_TAGS.filter(
    (tag) => criticalTagUniverse.has(tag) && !analyzedTags.has(tag)
  );
  const coveragePercent = chunks.length === 0 ? 0 : analyzedChunkIndexes.size / chunks.length;

  // Log diagnostic info for failures
  if (failedWindows.length > 0) {
    console.error(
      `[Extraction] ${failedWindows.length} windows failed:`,
      failedWindows.map((w) => ({ index: w.index, error: w.message.slice(0, 200) }))
    );
  }

  if (missingSectionTags.length > 0) {
    // Find which chunks have the missing tags
    const chunksWithMissingTags = chunks
      .filter((c) => missingSectionTags.some((tag) => c.tags.includes(tag)))
      .map((c) => ({ index: c.index, tags: c.tags, analyzed: analyzedChunkIndexes.has(c.index) }));
    console.error(
      `[Extraction] Critical sections not covered: ${missingSectionTags.join(", ")}`,
      { chunksWithMissingTags, analyzedCount: analyzedChunkIndexes.size, totalChunks: chunks.length }
    );
    throw new Error(
      `AI extraction did not cover critical sections: ${missingSectionTags.join(", ")}.`
    );
  }
  if (coveragePercent < EXTRACTION_MIN_COVERAGE) {
    throw new Error(
      `AI extraction coverage below threshold (${Math.round(coveragePercent * 100)}% < ${Math.round(
        EXTRACTION_MIN_COVERAGE * 100
      )}%).`
    );
  }

  const duration = Date.now() - startTime;
  console.log(
    `[Extraction] Completed in ${duration}ms, windows_ok=${successfulResults.length}/${windows.length}, coverage=${Math.round(
      coveragePercent * 100
    )}%`
  );

  return {
    fields: mergedFields,
    coverage: {
      chunksTotal: chunks.length,
      chunksAnalyzed: analyzedChunkIndexes.size,
      coveragePercent,
      missingSectionTags,
      rawTextChars: normalized.length,
      contextChars: windowContexts.reduce((sum, context) => sum + context.length, 0)
    }
  };
}
