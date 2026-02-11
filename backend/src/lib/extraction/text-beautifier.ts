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

const BEAUTIFY_PROMPT = `You are a senior editorial design director at a prestigious creative agency. Your job is to transform raw, messy RFP text into beautifully structured, scannable content.

Transform the following text into a clean, hierarchical structure. Think like you're designing a premium editorial layout:

**Guidelines:**
- Create clear visual hierarchy with headings and subheadings
- Break dense paragraphs into digestible chunks
- Convert lists buried in text into proper bullet points
- Highlight key terms, numbers, and deadlines
- Remove redundant words and tighten prose
- Preserve all important information - don't omit details
- Make it scannable - a busy executive should grasp key points in 5 seconds

**Output JSON format:**
{
  "formatted": "A clean markdown version with ## headings, **bold**, bullet points",
  "sections": [
    {
      "type": "heading|subheading|paragraph|bullet_list|numbered_list|highlight|quote",
      "content": "The text content",
      "items": ["for lists only", "array of items"]
    }
  ]
}

Raw text to beautify:
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
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
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
