import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AgencyService } from "@/lib/scope/taxonomy-loader";
import { runWithClaudeSonnetModel } from "@/lib/ai/model-resolver";
import { parseJsonFromModelText } from "@/lib/ai/json-response";

const ScopeMatchSchema = z.object({
  scopeItem: z.string(),
  matchedService: z.string().nullable(),
  matchClass: z.enum(["full", "partial", "none"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional().default("")
});

const ClaudeMatchResponseSchema = z.object({
  matches: z.array(ScopeMatchSchema)
});

export interface ClaudeScopeMatch {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none";
  confidence: number;
  reasoning: string;
}

function extractJsonObjectCandidate(text: string): string | null {
  const withoutFence = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return withoutFence.slice(start, end + 1);
}

function repairJsonCandidate(input: string): string {
  return input
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2018|\u2019/g, "'");
}

export async function matchScopeWithClaude(
  scopeItems: string[],
  services: AgencyService[]
): Promise<ClaudeScopeMatch[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({
    apiKey,
    timeout: 120000  // 2 minutes
  });

  // Build the service taxonomy list
  const serviceList = services.map(s => `- ${s.category}: ${s.service}`).join("\n");

const prompt = `You are an expert at matching RFP scope items to agency service capabilities.

## Agency Service Taxonomy
${serviceList}

## Scope Items to Match
${scopeItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}

## Instructions
For each scope item, find the BEST matching service from the agency taxonomy. Use semantic understanding, not just keyword matching.

**Match Classes:**
- "full": The scope item is a core capability the agency offers (e.g., "brand strategy development" matches "Brand strategy")
- "partial": The agency can do part of this or supervise it (e.g., "media buying campaign" matches "Media buying supervision")
- "none": This is genuinely outside agency scope (e.g., "construction work", "legal services")

**Important Matching Guidelines:**
- "brand positioning and narrative" → matches "Brand strategy" (full)
- "campaign strategies" → matches "Campaign strategy" (full)
- "video production" → matches "Video Production Supervision" (partial - agency supervises, doesn't produce)
- "local brand launch campaigns" → matches "Campaign strategy" (full)
- "visual style and imagery" → matches "Main Key Visual Direction" or "Design" services (full)
- "motion graphics assets" → matches "Design adaptations (Animatic)" or motion-related services (full)
- "content calendar" → matches "Content Calendar/Strategy" (full)
- "social media content" → matches "Social Media content" (full)

**IMPORTANT:** If an item is general project management, timeline management, project coordination, deliverable management, or administrative work related to the creative project, classify as "partial" with the closest matching agency capability (often project management or account services), NOT "none". Only use "none" for truly unrelated work like construction, legal services, IT infrastructure, etc.

Be generous with matching - if the scope item is related to marketing, branding, design, content, creative work, or project coordination, there's likely a match.
Keep reasoning extremely short (max 10 words).
Return strictly valid JSON with no markdown fences and no extra text.

Return JSON only:
{
  "matches": [
    {
      "scopeItem": "exact scope item text",
      "matchedService": "Matched Service Name" or null if none,
      "matchClass": "full" | "partial" | "none",
      "confidence": 0.0-1.0
    }
  ]
}`;

  const response = await runWithClaudeSonnetModel((model) =>
    client.messages.create({
      model,
      max_tokens: 2200,
      messages: [{ role: "user", content: prompt }]
    })
  );

  const textContent = response.content.find(block => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  try {
    const parsed = parseJsonFromModelText(textContent.text, {
      context: "Claude scope matching",
      expectedType: "object"
    });
    const validated = ClaudeMatchResponseSchema.parse(parsed);

    return validated.matches.map(m => ({
      scopeItem: m.scopeItem,
      service: m.matchedService || "No direct match",
      class: m.matchClass,
      confidence: m.confidence,
      reasoning: m.reasoning
    }));
  } catch (error) {
    const candidate = extractJsonObjectCandidate(textContent.text);
    if (candidate) {
      try {
        const repaired = repairJsonCandidate(candidate);
        const parsed = JSON.parse(repaired);
        const validated = ClaudeMatchResponseSchema.parse(parsed);
        return validated.matches.map(m => ({
          scopeItem: m.scopeItem,
          service: m.matchedService || "No direct match",
          class: m.matchClass,
          confidence: m.confidence,
          reasoning: m.reasoning
        }));
      } catch {
        // continue to normalized error path below
      }
    }

    if (error instanceof z.ZodError) {
      throw new Error(`Claude match response validation failed: ${error.issues.map(e => e.message).join(", ")}`);
    }
    throw new Error(`Failed to parse Claude match response: ${error}`);
  }
}
