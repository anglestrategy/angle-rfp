import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { AgencyService } from "@/lib/scope/taxonomy-loader";
import { runWithClaudeSonnetModel } from "@/lib/ai/model-resolver";

const ScopeMatchSchema = z.object({
  scopeItem: z.string(),
  matchedService: z.string().nullable(),
  matchClass: z.enum(["full", "partial", "none", "uncertain"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional().default("")
});

const ClaudeMatchResponseSchema = z.object({
  matches: z.array(ScopeMatchSchema)
});

export interface ClaudeScopeMatch {
  scopeItem: string;
  service: string;
  class: "full" | "partial" | "none" | "uncertain";
  confidence: number;
  reasoning: string;
}

export async function matchScopeWithClaude(
  scopeItems: string[],
  services: AgencyService[]
): Promise<ClaudeScopeMatch[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  const anthropicProvider = createAnthropic({ apiKey });

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
- "uncertain": The item is agency-adjacent but you cannot confidently map to one service
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

Be generous with matching - if the scope item is related to marketing, branding, design, content, creative work, or project coordination, there's likely a match. Use "uncertain" instead of "none" when ambiguous.
Keep reasoning extremely short (max 10 words).
Return strictly valid JSON with no markdown fences and no extra text.

Return JSON only:
{
  "matches": [
    {
      "scopeItem": "exact scope item text",
      "matchedService": "Matched Service Name" or null if none,
      "matchClass": "full" | "partial" | "none" | "uncertain",
      "confidence": 0.0-1.0
    }
  ]
}`;

  try {
    const result = await runWithClaudeSonnetModel((model) =>
      generateObject({
        model: anthropicProvider(model),
        schema: ClaudeMatchResponseSchema,
        temperature: 0,
        maxOutputTokens: 2200,
        timeout: { totalMs: 120_000 },
        prompt
      })
    );
    const validated = ClaudeMatchResponseSchema.parse(result.object);

    return validated.matches.map(m => ({
      scopeItem: m.scopeItem,
      service: m.matchedService || "No direct match",
      class: m.matchClass,
      confidence: m.confidence,
      reasoning: m.reasoning
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Claude match response validation failed: ${error.issues.map(e => e.message).join(", ")}`);
    }
    throw new Error(`Claude scope matching failed: ${error}`);
  }
}
