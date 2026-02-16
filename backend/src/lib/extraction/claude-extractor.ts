import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { runWithClaudeSonnetModel } from "@/lib/ai/model-resolver";

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

const nullableString = (fallback = "") =>
  z.preprocess((value) => coerceString(value, fallback), z.string());

const nullableOptionalString = () =>
  z.preprocess((value) => {
    const normalized = coerceString(value, "");
    return normalized.length > 0 ? normalized : null;
  }, z.string().nullable());

// Schema for deliverables with source tagging
const DeliverableSchema = z.union([
  // Support both old format (string) and new format (object with source)
  z.string().transform((val) => ({ item: val, source: "verbatim" as const })),
  z.object({
    item: z.string(),
    source: z.enum(["verbatim", "inferred"]).default("verbatim")
  })
]);

const DeliverableRequirementEntrySchema = z.object({
  title: nullableString(""),
  description: nullableString(""),
  source: z.enum(["verbatim", "inferred"]).default("verbatim")
});

const DeliverableRequirementGroupsSchema = z.object({
  technical: z.array(DeliverableRequirementEntrySchema).default([]),
  commercial: z.array(DeliverableRequirementEntrySchema).default([]),
  strategicCreative: z.array(DeliverableRequirementEntrySchema).default([])
});

// Schema for runtime validation of Claude's response
const ClaudeExtractedFieldsSchema = z.object({
  clientName: nullableString(""),
  projectName: nullableString(""),
  projectDescription: nullableString(""),
  scopeOfWork: nullableString(""),
  evaluationCriteria: nullableString(""),
  requiredDeliverables: z.array(DeliverableSchema).default([]),
  deliverableRequirements: DeliverableRequirementGroupsSchema.default({
    technical: [],
    commercial: [],
    strategicCreative: []
  }),
  importantDates: z.array(z.object({
    title: nullableString(""),
    date: nullableString(""),
    type: z.enum(["submission_deadline", "qa_deadline", "presentation", "other"]).default("other")
  })).default([]),
  submissionRequirements: z.object({
    method: nullableString("Unknown"),
    email: nullableOptionalString(),
    format: nullableString("Unspecified"),
    physicalAddress: nullableOptionalString(),
    // Handle both string and number from Claude (it sometimes returns "3" instead of 3)
    copies: z.preprocess((value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.floor(value);
      }
      if (typeof value === "string") {
        const digits = value.match(/\d+/)?.[0];
        if (!digits) {
          return null;
        }
        const parsed = Number.parseInt(digits, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }, z.number().nullable())
  }).default({
    method: "Unknown",
    email: null,
    format: "Unspecified",
    physicalAddress: null,
    copies: null
  })
});

export type ClaudeExtractedFields = z.infer<typeof ClaudeExtractedFieldsSchema>;

// Claude Sonnet 4 has 200K token context = ~570K characters.
// With ~30K for prompts/responses, we can safely send 500K chars (full RFP, no truncation).
// NO artificial limits - send the entire document for complete analysis.
const MAX_INPUT_CHARS = 500_000;

// Default timeout for Claude API requests.
const API_TIMEOUT_MS = 120_000;

function normalizeWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function sectionWindow(rawText: string, pattern: RegExp, maxChars = 9_000): string | null {
  const match = pattern.exec(rawText);
  if (!match || typeof match.index !== "number") {
    return null;
  }

  const start = Math.max(0, match.index - 800);
  const end = Math.min(rawText.length, start + maxChars);
  const window = rawText.slice(start, end).trim();
  return window.length > 120 ? window : null;
}

function buildFocusedExtractionInput(rawText: string): string {
  // SEND THE ENTIRE DOCUMENT - NO SNIPPETS, NO "FOCUSING"
  // Claude Sonnet 4 can handle 500K chars easily, and we need complete context for intelligent analysis.
  // The old "focused" approach extracted only ~60K chars of snippets, causing poor quality.

  const normalized = normalizeWhitespace(rawText);

  // Only truncate if document exceeds Claude's context limit (500K chars)
  if (normalized.length > MAX_INPUT_CHARS) {
    console.warn(`[Extraction] Document exceeds ${MAX_INPUT_CHARS} chars, truncating from ${normalized.length}`);
    return normalized.slice(0, MAX_INPUT_CHARS);
  }

  return normalized;
}

const EXTRACTION_PROMPT = `You are a senior RFP analyst at a creative agency. Your job is to extract and CLEARLY STRUCTURE key information from RFP documents so busy executives can quickly understand what's being asked.

CRITICAL INSTRUCTIONS FOR INTELLIGENT EXTRACTION:
1. READ CAREFULLY: Scope, deliverables, and evaluation criteria are often in middle/end sections - read the entire document
2. INFER INTELLIGENTLY: If information is implied but not explicit, extract it and mark source as "inferred"
3. LOOK EVERYWHERE: Check headers, footers, tables, appendices for requirements
4. BE THOROUGH: Extract ALL deliverables, not just the obvious ones
5. CONTEXT MATTERS: If submission requirements reference other sections, find and extract that content
6. CLIENT IDENTIFICATION: Look for the organization ISSUING the RFP (letterhead, "Issued by:", "Client:", Arabic "العميل")
   - Common mistake: extracting bidder names instead of client name
   - The client is WHO IS ASKING for proposals, not who will submit them

EXTRACTION PRIORITIES (in order of importance):
- Client name and project title (critical for accurate identification)
- Project description and objectives
- Complete scope of work (all phases, all deliverables)
- Evaluation criteria (ALL factors with percentages)
- Timeline and milestones
- Budget constraints and payment terms
- Submission requirements (format, copies, deadline)
- Technical requirements and constraints

If text is truncated, focus on extracting the MOST IMPORTANT sections first (client, scope, evaluation).

Extract the following fields from this RFP document. Return ONLY valid JSON, no markdown or explanations.

{
  "clientName": "The issuing organization's name",
  "projectName": "The project or RFP title",
  "projectDescription": "2-3 sentence executive summary of the project",
  "scopeOfWork": "Core in-scope work items only, concise bullet lines (max 12)",
  "evaluationCriteria": "Well-structured criteria with weights (see format below)",
  "requiredDeliverables": [{"item": "Technical Proposal", "source": "verbatim"}, {"item": "Past Project Portfolio", "source": "inferred"}],
  "deliverableRequirements": {
    "technical": [{"title": "...", "description": "...", "source": "verbatim|inferred"}],
    "commercial": [{"title": "...", "description": "...", "source": "verbatim|inferred"}],
    "strategicCreative": [{"title": "...", "description": "...", "source": "verbatim|inferred"}]
  },
  "importantDates": [{"title": "...", "date": "YYYY-MM-DD", "type": "submission_deadline|qa_deadline|presentation|other"}],
  "submissionRequirements": {"method": "Email|Portal|Physical", "email": "...", "format": "PDF|Word", "physicalAddress": "...", "copies": null}
}

CRITICAL FORMATTING RULES FOR scopeOfWork AND evaluationCriteria:

For scopeOfWork:
- Return only concise work-item bullets.
- Do NOT include headings, phases, timeline tables, or admin text.
- Do NOT include markdown headings such as "## Executive Summary" or "## Scope of Work".
- Each bullet should be one actionable work item (preferably <= 18 words).
- Max 12 bullets.
- Use this exact style:
"• [Core scope item 1]\\n• [Core scope item 2]\\n• [Core scope item 3]"

For evaluationCriteria:
- Use plain text only (no markdown headings, no **bold**, no code fences).
- Prefer a clean numbered format:
"1. [Criteria Name] (XX%)\\n[Short explanation]\\n\\n2. [Criteria Name] (XX%)\\n[Short explanation]\\n\\n3. [Criteria Name] (XX%)\\n[Short explanation]"
- Preserve table group boundaries when criteria comes from a table.

For deliverableRequirements:
- Fill only actual proposal submission requirements (what we need to prepare/submit in the pitch).
- Group items under technical, commercial, strategicCreative.
- Exclude legal boilerplate, definitions, liabilities, and terms/conditions text.
- Exclude generic contract clauses unless they explicitly require a submission artifact.
- Keep each description concise and actionable (one requirement per item).

EXTRACTION RULES:
1. clientName: The organization ISSUING the RFP (not bidders). Look for letterhead, "Client:", "Issued by:", or Arabic "العميل".
2. scopeOfWork: Extract only in-scope delivery requirements. Exclude bid admin details, response mechanics, evaluation rubric text, legal/commercial terms, and timeline milestones.
3. evaluationCriteria: Extract ALL criteria with their weights. Organize by category if multiple exist.
4. requiredDeliverables: Specific items to submit with source tagging:
   - "source": "verbatim" if explicitly stated in RFP (e.g., "Submit technical proposal")
   - "source": "inferred" if derived from evaluation criteria or implied requirements
5. deliverableRequirements:
   - technical: proposal artifacts such as methodology, credentials, team/CVs, references, certificates.
   - commercial: pricing, commercial/financial proposal, payment terms, tax/subtotal/grand-total if requested.
   - strategicCreative: strategic/creative proposal requirements derived from scope/evaluation criteria.
   - NEVER include terms-and-conditions boilerplate or non-submission legal text.
6. importantDates: Parse any date format to YYYY-MM-DD. Skip addresses containing numbers.
7. Skip page numbers, headers, footers, table of contents entries.
8. Do NOT duplicate section headings. Each heading should appear only once in scopeOfWork/evaluationCriteria.
9. Keep scope bullets concise and non-redundant; never output long phase-by-phase prose.
10. Bid/tender response deadlines belong in importantDates, not scopeOfWork.
11. Do NOT repeat the same criterion text under multiple numbered sections.

IMPORTANT: Your output should be READABLE and EXECUTIVE-LEVEL. Prioritize concise decision-useful content, not full document copy.

RFP Document:
`;

export async function extractWithClaude(rawText: string): Promise<ClaudeExtractedFields> {
  const startTime = Date.now();
  console.log(`[Extraction] Starting at ${new Date().toISOString()}, timeout: ${API_TIMEOUT_MS}ms`);
  console.log(`[Extraction] Input size: ${rawText.length} chars (will be focused to max ${MAX_INPUT_CHARS} chars)`);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  const anthropicProvider = createAnthropic({ apiKey });

  const focusedText = buildFocusedExtractionInput(rawText);

  // Log if truncation occurred
  if (focusedText.length < rawText.length) {
    const truncationPercent = ((1 - focusedText.length / rawText.length) * 100).toFixed(1);
    console.warn(`[Extraction] Truncated RFP from ${rawText.length} to ${focusedText.length} chars (${truncationPercent}% removed)`);
  } else {
    console.log(`[Extraction] Using full RFP content (${focusedText.length} chars, no truncation)`);
  }

  // Create abort controller for request-level timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[Extraction] Timeout triggered after ${API_TIMEOUT_MS}ms, aborting request`);
    abortController.abort();
  }, API_TIMEOUT_MS);

  try {
    const result = await runWithClaudeSonnetModel((model) =>
      generateObject({
        model: anthropicProvider(model),
        schema: ClaudeExtractedFieldsSchema,
        temperature: 0,
        maxOutputTokens: 8000,
        abortSignal: abortController.signal,
        prompt: EXTRACTION_PROMPT + focusedText
      })
    );

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.log(`[Extraction] Completed successfully in ${duration}ms`);
    return result.object;
  } catch (parseError) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.error(`[Extraction] Failed after ${duration}ms:`, parseError);

    if (parseError instanceof z.ZodError) {
      throw new Error(`Claude response validation failed: ${parseError.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw new Error(`Claude structured extraction failed: ${parseError}`);
  }
}
