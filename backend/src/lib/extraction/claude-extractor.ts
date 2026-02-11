import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Schema for runtime validation of Claude's response
const ClaudeExtractedFieldsSchema = z.object({
  clientName: z.string().default(""),
  projectName: z.string().default(""),
  projectDescription: z.string().default(""),
  scopeOfWork: z.string().default(""),
  evaluationCriteria: z.string().default(""),
  requiredDeliverables: z.array(z.string()).default([]),
  importantDates: z.array(z.object({
    title: z.string(),
    date: z.string(),
    type: z.enum(["submission_deadline", "qa_deadline", "presentation", "other"]).default("other")
  })).default([]),
  submissionRequirements: z.object({
    method: z.string().default("Unknown"),
    email: z.string().nullable().default(null),
    format: z.string().default("Unspecified"),
    physicalAddress: z.string().nullable().default(null),
    copies: z.number().nullable().default(null)
  }).default({
    method: "Unknown",
    email: null,
    format: "Unspecified",
    physicalAddress: null,
    copies: null
  })
});

export type ClaudeExtractedFields = z.infer<typeof ClaudeExtractedFieldsSchema>;

// Maximum characters to send to Claude API to stay within token limits
// (~25k tokens at ~4 chars/token, with buffer for prompt)
const MAX_INPUT_CHARS = 100_000;

// Default timeout for Claude API requests (60 seconds)
const API_TIMEOUT_MS = 60_000;

const EXTRACTION_PROMPT = `You are an expert at extracting structured data from RFP (Request for Proposal) documents.

Extract the following fields from this RFP document. Return ONLY valid JSON, no markdown or explanations.

{
  "clientName": "The issuing organization's name (the entity requesting proposals)",
  "projectName": "The project or RFP title",
  "projectDescription": "2-3 sentence summary of what the project is about",
  "scopeOfWork": "Full scope section content - the actual work requirements, NOT table of contents entries",
  "evaluationCriteria": "How proposals will be evaluated, including criteria and weights if specified",
  "requiredDeliverables": ["list", "of", "specific", "deliverables"],
  "importantDates": [
    {
      "title": "Description of the deadline",
      "date": "YYYY-MM-DD",
      "type": "submission_deadline|qa_deadline|presentation|other"
    }
  ],
  "submissionRequirements": {
    "method": "Email|Portal|Physical|Email + Physical",
    "email": "email@example.com or null",
    "format": "PDF|Word|Unspecified",
    "physicalAddress": "Physical address if required, or null",
    "copies": "Number of copies required, or null"
  }
}

IMPORTANT EXTRACTION RULES:
1. For clientName: Look for the organization ISSUING the RFP, not contractors/vendors. Common patterns: "Client:", "Issued by:", letterhead, or at the start of the document. For Arabic RFPs, look for "العميل" or organization names.
2. For scopeOfWork: Extract the ACTUAL scope content describing work requirements. NEVER include table of contents entries like "Scope of Work...6". Look for sections describing tasks, responsibilities, and deliverables.
3. For dates: Parse ANY date format to YYYY-MM-DD. Skip addresses that happen to contain numbers.
4. For requiredDeliverables: Look for specific items to submit (proposal documents, CVs, case studies), not generic keywords.
5. Skip page numbers, headers, footers, and navigation text.

RFP Document:
`;

export async function extractWithClaude(rawText: string): Promise<ClaudeExtractedFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({
    apiKey,
    timeout: API_TIMEOUT_MS
  });

  const truncatedText = rawText.slice(0, MAX_INPUT_CHARS);

  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: EXTRACTION_PROMPT + truncatedText
      }
    ]
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  const responseText = textContent.text.trim();

  // Handle potential markdown code blocks in response
  let jsonText = responseText;
  if (responseText.startsWith("```")) {
    const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      jsonText = match[1];
    }
  }

  try {
    const rawParsed = JSON.parse(jsonText);
    // Validate and apply defaults using Zod schema
    const validated = ClaudeExtractedFieldsSchema.parse(rawParsed);
    return validated;
  } catch (parseError) {
    if (parseError instanceof z.ZodError) {
      throw new Error(`Claude response validation failed: ${parseError.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw new Error(`Failed to parse Claude response as JSON: ${parseError}`);
  }
}
