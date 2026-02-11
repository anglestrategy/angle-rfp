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

const PROJECT_DESCRIPTION_BEAUTIFY_PROMPT = `You are structuring the top "hero" content for an RFP executive dashboard.

Return JSON only in this format:
{
  "formatted": "markdown",
  "sections": [
    {"type": "heading|subheading|paragraph|bullet_list|numbered_list|highlight|quote", "content": "text", "items": ["..."]}
  ]
}

STRICT RULES:
- Keep this concise and executive-level.
- Do NOT output headings named "Project Overview" or "Project Scope".
- Required structure:
  1) One short paragraph only (no heading) summarizing the engagement.
  2) One subheading exactly: "Key Objective".
  3) One short paragraph OR bullet list (max 3 bullets) for the key objective.
- Do not include phase-by-phase breakdowns.
- Do not include bid administration details.
- No markdown code fences. JSON only.

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
- Keep it concise and decision-oriented.
- Output only core scope items as concise bullets (max 10).
- Do NOT include submission/admin/evaluation/bid-process details.
- Do NOT dump full long phase descriptions.
- Do NOT include section headings such as "Executive Summary" or "Scope of Work".
- If phases appear in source, convert only true in-scope work lines into bullets.
- Preserve meaning, reduce verbosity.
- No markdown code fences. JSON only.

Text to structure:
`;

const NON_SCOPE_PATTERNS = [
  /submission deadline/i,
  /intent to tender/i,
  /deadline for questions/i,
  /responses? to questions?/i,
  /proposal submission/i,
  /special conditions?/i,
  /evaluation criteria/i,
  /terms?\s*&?\s*conditions?/i,
  /commercial proposal/i,
  /certificate/i,
  /\bcv\b|resume/i,
  /proposal format/i,
  /email submission/i,
  /موعد تقديم|آخر موعد|شروط التقديم|معايير التقييم|شروط خاصة/
];

const SCOPE_SECTION_HEADING_NOISE = [
  /^overview$/i,
  /^program phases?.*/i,
  /^timeline$/i,
  /^deliverables$/i,
  /^key objectives?$/i
];

const PROJECT_HEADING_NOISE = [
  /^project overview$/i,
  /^project scope$/i
];

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeBulletItem(item: string): string {
  return item
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\s*(?:[-*•▪‣●]|\d+[.)])\s+/u, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeItems(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const raw of items) {
    const value = normalizeBulletItem(raw);
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
  }

  return output;
}

function isScopeNoiseLine(line: string): boolean {
  const normalized = normalizeBulletItem(line).toLowerCase();
  if (!normalized) {
    return true;
  }
  if (SCOPE_SECTION_HEADING_NOISE.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  if (NON_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  return false;
}

function normalizeProjectDescriptionStructure(result: BeautifiedText): BeautifiedText {
  const normalizedSections = result.sections.filter((section) => {
    if (section.type === "heading") {
      const heading = section.content.trim().toLowerCase();
      if (PROJECT_HEADING_NOISE.some((pattern) => pattern.test(heading))) {
        return false;
      }
    }
    return true;
  });

  const firstParagraph =
    normalizedSections.find((section) => section.type === "paragraph" && section.content.trim().length > 0)?.content.trim() ??
    result.formatted
      .split(/\n+/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !/^#{1,6}\s*/.test(line)) ??
    "";

  const keyObjectiveSection =
    normalizedSections.find((section) => /key objective/i.test(section.content)) ??
    { type: "subheading" as const, content: "Key Objective", items: undefined };

  const keyObjectiveParagraph =
    normalizedSections.find((section) => section.type === "paragraph" && section.content.trim() !== firstParagraph)?.content.trim() ?? "";

  const keyObjectiveBullets = dedupeItems(
    normalizedSections
      .filter((section) => section.type === "bullet_list" || section.type === "numbered_list")
      .flatMap((section) => section.items ?? [])
  ).slice(0, 3);

  const sections: BeautifiedText["sections"] = [];
  if (firstParagraph) {
    sections.push({ type: "paragraph", content: firstParagraph, items: undefined });
  }

  sections.push({
    type: "subheading",
    content: "Key Objective",
    items: undefined
  });

  if (keyObjectiveBullets.length > 0) {
    sections.push({
      type: "bullet_list",
      content: "Key Objective",
      items: keyObjectiveBullets
    });
  } else if (keyObjectiveParagraph) {
    sections.push({
      type: "paragraph",
      content: keyObjectiveParagraph,
      items: undefined
    });
  } else if (keyObjectiveSection.content && !/key objective/i.test(keyObjectiveSection.content)) {
    sections.push({
      type: "paragraph",
      content: keyObjectiveSection.content,
      items: undefined
    });
  }

  const formatted = sections
    .map((section) => {
      if (section.type === "subheading") {
        return `## ${section.content}`;
      }
      if (section.type === "bullet_list" || section.type === "numbered_list") {
        const items = (section.items ?? []).map((item) => `• ${item}`).join("\n");
        return items;
      }
      return section.content;
    })
    .join("\n\n")
    .trim();

  return {
    formatted,
    sections
  };
}

function normalizeScopeStructure(result: BeautifiedText): BeautifiedText {
  const candidateItems = dedupeItems(
    result.sections
      .flatMap((section) => {
        if (section.type === "bullet_list" || section.type === "numbered_list") {
          return section.items ?? [];
        }
        if (section.type === "paragraph") {
          return toLines(section.content);
        }
        return [];
      })
      .filter((line) => !isScopeNoiseLine(line))
  );

  const scopeItems = candidateItems
    .filter((item) => {
      if (!item) {
        return false;
      }
      const normalized = item.toLowerCase();
      return !NON_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized));
    })
    .slice(0, 10);

  const sections: BeautifiedText["sections"] = [];
  sections.push({
    type: "bullet_list",
    content: "Core Scope Items",
    items: scopeItems.length > 0 ? scopeItems : ["Scope items were not clearly segmented from source text."]
  });

  const formatted = (scopeItems.length > 0 ? scopeItems : ["Scope items were not clearly segmented from source text."])
    .map((item) => `• ${item}`)
    .join("\n")
    .trim();

  return {
    formatted,
    sections
  };
}

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
    const prompt =
      fieldName === "Scope of Work"
        ? SCOPE_BEAUTIFY_PROMPT
        : fieldName === "Project Description"
          ? PROJECT_DESCRIPTION_BEAUTIFY_PROMPT
          : BEAUTIFY_PROMPT;
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
    const validated = BeautifiedTextSchema.parse(parsed);

    if (fieldName === "Scope of Work") {
      return normalizeScopeStructure(validated);
    }

    if (fieldName === "Project Description") {
      return normalizeProjectDescriptionStructure(validated);
    }

    return validated;
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
