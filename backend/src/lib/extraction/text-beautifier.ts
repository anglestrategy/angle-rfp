import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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
    timeout: 30000
  });

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `${BEAUTIFY_PROMPT}\n\nField: ${fieldName}\n\n${rawText.slice(0, 8000)}`
      }]
    });

    const textContent = response.content.find(block => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response");
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```")) {
      const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match?.[1]) {
        jsonText = match[1];
      }
    }

    const parsed = JSON.parse(jsonText);
    return BeautifiedTextSchema.parse(parsed);
  } catch (error) {
    console.error(`Text beautification failed for ${fieldName}:`, error);
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
