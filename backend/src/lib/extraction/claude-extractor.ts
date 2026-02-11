import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runWithClaudeSonnetModel } from "@/lib/ai/model-resolver";

// Schema for deliverables with source tagging
const DeliverableSchema = z.union([
  // Support both old format (string) and new format (object with source)
  z.string().transform((val) => ({ item: val, source: "verbatim" as const })),
  z.object({
    item: z.string(),
    source: z.enum(["verbatim", "inferred"]).default("verbatim")
  })
]);

// Schema for runtime validation of Claude's response
const ClaudeExtractedFieldsSchema = z.object({
  clientName: z.string().default(""),
  projectName: z.string().default(""),
  projectDescription: z.string().default(""),
  scopeOfWork: z.string().default(""),
  evaluationCriteria: z.string().default(""),
  requiredDeliverables: z.array(DeliverableSchema).default([]),
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
    // Handle both string and number from Claude (it sometimes returns "3" instead of 3)
    copies: z.union([z.number(), z.string().transform(v => v ? parseInt(v, 10) : null)]).nullable().default(null)
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

// Default timeout for Claude API requests (3 minutes for large documents)
const API_TIMEOUT_MS = 180_000;

const EXTRACTION_PROMPT = `You are a senior RFP analyst at a creative agency. Your job is to extract and CLEARLY STRUCTURE key information from RFP documents so busy executives can quickly understand what's being asked.

Extract the following fields from this RFP document. Return ONLY valid JSON, no markdown or explanations.

{
  "clientName": "The issuing organization's name",
  "projectName": "The project or RFP title",
  "projectDescription": "2-3 sentence executive summary of the project",
  "scopeOfWork": "Well-structured scope with clear sections (see format below)",
  "evaluationCriteria": "Well-structured criteria with weights (see format below)",
  "requiredDeliverables": [{"item": "Technical Proposal", "source": "verbatim"}, {"item": "Past Project Portfolio", "source": "inferred"}],
  "importantDates": [{"title": "...", "date": "YYYY-MM-DD", "type": "submission_deadline|qa_deadline|presentation|other"}],
  "submissionRequirements": {"method": "Email|Portal|Physical", "email": "...", "format": "PDF|Word", "physicalAddress": "...", "copies": null}
}

CRITICAL FORMATTING RULES FOR scopeOfWork AND evaluationCriteria:

For scopeOfWork, structure it clearly with line breaks:
"## Overview\\n[1-2 sentence summary of what the client needs]\\n\\n## Key Objectives\\n• [Objective 1]\\n• [Objective 2]\\n• [Objective 3]\\n\\n## Deliverables\\n1. [Deliverable 1]\\n2. [Deliverable 2]\\n3. [Deliverable 3]\\n\\n## Timeline\\n[Key timeline information]"

For evaluationCriteria, structure it clearly:
"## Evaluation Criteria\\n\\n**1. [Criteria Name] (XX%)**\\n[What they're looking for]\\n\\n**2. [Criteria Name] (XX%)**\\n[What they're looking for]\\n\\n**3. [Criteria Name] (XX%)**\\n[What they're looking for]"

EXTRACTION RULES:
1. clientName: The organization ISSUING the RFP (not bidders). Look for letterhead, "Client:", "Issued by:", or Arabic "العميل".
2. scopeOfWork: Extract ALL scope requirements but ORGANIZE them clearly. Don't copy raw text walls - structure with headings and bullets. Preserve all important details but make it scannable.
3. evaluationCriteria: Extract ALL criteria with their weights. Organize by category if multiple exist.
4. requiredDeliverables: Specific items to submit with source tagging:
   - "source": "verbatim" if explicitly stated in RFP (e.g., "Submit technical proposal")
   - "source": "inferred" if derived from evaluation criteria or implied requirements
5. importantDates: Parse any date format to YYYY-MM-DD. Skip addresses containing numbers.
6. Skip page numbers, headers, footers, table of contents entries.

IMPORTANT: Your output should be READABLE and SCANNABLE - not raw text walls. Use headings (##), bullets (•), numbered lists (1.), and bold (**) to structure content clearly while preserving ALL important information from the original.

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

  const response = await runWithClaudeSonnetModel((model) =>
    client.messages.create({
      model,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: EXTRACTION_PROMPT + truncatedText
        }
      ]
    })
  );

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
