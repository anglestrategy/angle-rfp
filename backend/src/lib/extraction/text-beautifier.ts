import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runWithClaudeSonnetModel } from "@/lib/ai/model-resolver";
import { parseJsonFromModelText } from "@/lib/ai/json-response";

const BeautifiedTextSchema = z.object({
  formatted: z.string(),
  sections: z.array(z.object({
    type: z.enum(["heading", "subheading", "paragraph", "bullet_list", "numbered_list", "highlight", "quote"]),
    content: z.string(),
    items: z.array(z.string()).optional()
  }))
});

export type BeautifiedText = z.infer<typeof BeautifiedTextSchema>;

export interface BeautifiedFields {
  projectDescription: BeautifiedText;
  scopeOfWork: BeautifiedText;
  evaluationCriteria: BeautifiedText;
}

const BEAUTIFY_PROMPT = `You are a senior editorial designer. Transform the following text into beautifully structured, scannable sections.

**Output JSON format:**
{
  "formatted": "Clean markdown with ## headings and **bold**",
  "sections": [
    {"type": "heading", "content": "Section Title"},
    {"type": "paragraph", "content": "Regular text paragraph"},
    {"type": "bullet_list", "content": "List title", "items": ["Item 1", "Item 2"]},
    {"type": "numbered_list", "content": "Steps", "items": ["Step 1", "Step 2"]},
    {"type": "highlight", "content": "Important: Key deadline or requirement"},
    {"type": "subheading", "content": "Subsection title"}
  ]
}

**Rules:**
- Parse any existing markdown (##, **, •, 1.) into appropriate section types
- Break long paragraphs into digestible chunks
- Use "highlight" SPARINGLY - MAX 2 highlights per field
- Only highlight: critical deadlines, disqualifying requirements, or unusual conditions
- Do NOT highlight standard evaluation criteria percentages - use regular text for these
- Preserve ALL information - don't omit anything
- Each section should be short and scannable (2-3 sentences max for paragraphs)
- Use bullet_list for unordered items, numbered_list for sequential steps

Text to structure:
`;

const SCOPE_BEAUTIFY_PROMPT = `You are editing "Scope of Work" for executive decision-making.

Return JSON only in this format:
{
  "formatted": "markdown",
  "sections": [
    {"type": "heading|subheading|paragraph|bullet_list|numbered_list|highlight|quote", "content": "text", "items": ["..."]}
  ]
}

STRICT RULES:
- Keep it concise and decision-oriented (executive summary style).
- Use this structure only:
  1) Overview (1 short paragraph)
  2) Core Scope Items (max 8 bullets)
  3) Program Phases (High-Level, optional, max 6 bullets, titles only)
- Do NOT include submission/admin/evaluation/bid-process details.
- Do NOT dump full long phase descriptions.
- Preserve meaning, reduce verbosity.
- No markdown code fences. JSON only.

Text to structure:
`;

export async function beautifyText(rawText: string, fieldName: string): Promise<BeautifiedText> {
  if (!rawText || rawText.trim().length < 20) {
    return {
      formatted: rawText || "",
      sections: [{ type: "paragraph", content: rawText || "" }]
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: return as-is with basic structure
    return {
      formatted: rawText,
      sections: [{ type: "paragraph", content: rawText }]
    };
  }

  const client = new Anthropic({
    apiKey,
    timeout: 120000  // 2 minutes
  });

  try {
    const prompt = fieldName === "Scope of Work" ? SCOPE_BEAUTIFY_PROMPT : BEAUTIFY_PROMPT;
    const response = await runWithClaudeSonnetModel((model) =>
      client.messages.create({
        model,
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `${prompt}\n\nField: ${fieldName}\n\n${rawText.slice(0, 8000)}`
        }]
      })
    );

    const textContent = response.content.find(block => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response");
    }

    const parsed = parseJsonFromModelText(textContent.text, {
      context: `Text beautification (${fieldName})`,
      expectedType: "object"
    });
    return BeautifiedTextSchema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Text beautification failed for ${fieldName}:`, message);
    // Fallback: return with basic paragraph structure
    return {
      formatted: rawText,
      sections: [{ type: "paragraph", content: rawText }]
    };
  }
}

export async function beautifyExtractedFields(fields: {
  projectDescription: string;
  scopeOfWork: string;
  evaluationCriteria: string;
}): Promise<BeautifiedFields> {
  // Run beautification in parallel for speed
  const [projectDescription, scopeOfWork, evaluationCriteria] = await Promise.all([
    beautifyText(fields.projectDescription, "Project Description"),
    beautifyText(fields.scopeOfWork, "Scope of Work"),
    beautifyText(fields.evaluationCriteria, "Evaluation Criteria")
  ]);

  return {
    projectDescription,
    scopeOfWork,
    evaluationCriteria
  };
}
