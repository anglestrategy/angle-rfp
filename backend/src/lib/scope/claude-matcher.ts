import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { AgencyService } from "@/lib/scope/taxonomy-loader";
import { resolveGoogleApiKey, runWithGeminiFlashModel } from "@/lib/ai/model-resolver";

const AI_MATCH_TIMEOUT_MS = 90_000;

function stripMarkdownCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstBalancedJson(raw: string): string | null {
  const sanitized = stripMarkdownCodeFences(raw);
  const start = sanitized.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < sanitized.length; index += 1) {
    const char = sanitized[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return sanitized.slice(start, index + 1);
      }
      continue;
    }
  }

  return null;
}

function parseJsonObjectLoose(raw: string): Record<string, unknown> | null {
  const candidate = extractFirstBalancedJson(raw);
  if (!candidate) {
    return null;
  }

  const attempts = [
    candidate,
    candidate.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'"),
    candidate.replace(/,\s*([}\]])/g, "$1"),
    candidate
      .replace(/[“”]/g, "\"")
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1")
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try next repair strategy.
    }
  }

  return null;
}

function parseScopeMatchFromText(raw: string): z.infer<typeof ClaudeMatchResponseSchema> | null {
  const parsed = parseJsonObjectLoose(raw);
  if (!parsed) {
    return null;
  }

  const validated = ClaudeMatchResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return null;
  }

  return validated.data;
}

function shouldRetryScopeMatchWithTextMode(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no output generated|validation|schema|json|unexpected end/i.test(message);
}

function normalizeMatchClass(value: unknown): "full" | "partial" | "none" | "uncertain" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "full" || normalized === "partial" || normalized === "none" || normalized === "uncertain") {
    return normalized;
  }
  if (normalized.includes("full")) {
    return "full";
  }
  if (normalized.includes("partial")) {
    return "partial";
  }
  if (normalized.includes("none") || normalized.includes("out")) {
    return "none";
  }
  return "uncertain";
}

function defaultConfidenceForClass(matchClass: "full" | "partial" | "none" | "uncertain"): number {
  if (matchClass === "full") {
    return 0.82;
  }
  if (matchClass === "partial") {
    return 0.63;
  }
  if (matchClass === "none") {
    return 0.66;
  }
  return 0.5;
}

function parseLineModeMatches(
  raw: string,
  scopeItems: string[]
): z.infer<typeof ClaudeMatchResponseSchema> | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^```/.test(line))
    .filter((line) => !/^\s*index\s*\|/i.test(line))
    .filter((line) => !/^\s*format\s*:/i.test(line));

  if (lines.length === 0) {
    return null;
  }

  const parsedByIndex = new Map<number, z.infer<typeof ScopeMatchSchema>>();
  for (const line of lines) {
    const normalized = line.replace(/^[\-\*\u2022]\s*/, "").trim();
    const separator = normalized.includes("||") ? "||" : normalized.includes("|") ? "|" : null;
    if (!separator) {
      continue;
    }

    const parts = normalized.split(separator).map((part) => part.trim());
    if (parts.length < 4) {
      continue;
    }

    const indexValue = Number.parseInt(parts[0] ?? "", 10);
    if (!Number.isFinite(indexValue) || indexValue < 1 || indexValue > scopeItems.length) {
      continue;
    }

    const matchClass = normalizeMatchClass(parts[2]);
    const confidence = toConfidence(parts[3] ?? defaultConfidenceForClass(matchClass));
    const reasoning = parts.slice(4).join(" | ").trim();
    const matchedServiceRaw = (parts[1] ?? "").trim();
    const matchedService =
      !matchedServiceRaw ||
      /^(null|none|n\/a|unknown|no match)$/i.test(matchedServiceRaw)
        ? null
        : matchedServiceRaw;

    const candidate = ScopeMatchSchema.parse({
      scopeItem: scopeItems[indexValue - 1],
      matchedService,
      matchClass,
      confidence,
      reasoning
    });

    const existing = parsedByIndex.get(indexValue);
    if (!existing || candidate.confidence > existing.confidence) {
      parsedByIndex.set(indexValue, candidate);
    }
  }

  if (parsedByIndex.size === 0) {
    return null;
  }

  const matches: z.infer<typeof ScopeMatchSchema>[] = scopeItems.map((scopeItem, idx) => {
    const index = idx + 1;
    const existing = parsedByIndex.get(index);
    if (existing) {
      return existing;
    }
    return ScopeMatchSchema.parse({
      scopeItem,
      matchedService: null,
      matchClass: "uncertain",
      confidence: 0.5,
      reasoning: "Line-mode fallback returned no entry for this item."
    });
  });

  return { matches };
}

function toConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, parsed));
    }
  }
  return 0.5;
}

const ScopeMatchSchema = z.object({
  scopeItem: z.string(),
  matchedService: z.string().nullable(),
  matchClass: z.enum(["full", "partial", "none", "uncertain"]),
  confidence: z.preprocess((value) => toConfidence(value), z.number()),
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
  const apiKey = resolveGoogleApiKey();

  if (!apiKey) {
    throw new Error(
      "No Gemini API key configured. Set GOOGLE_API_KEY or GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
    );
  }
  const googleProvider = createGoogleGenerativeAI({ apiKey });

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

**Strategy Research is CORE Agency Work:**
Creative agencies perform strategy research to inform brand and campaign development:
- Cultural analysis and local market understanding → "full" match to Research & Discovery services
- Competitive benchmarking and analysis → "full" match to Research & Discovery services
- Consumer insights and behavioral research → "full" match to Research & Discovery services
- Audience research and profiling → "full" match to Research & Discovery services
- Brand audits and positioning research → "full" match to Research & Discovery services

Only classify as "none" for work agencies typically DON'T do:
- Large-scale quantitative field research (surveys, panels) requiring specialized firms
- Media buying and placement execution
- PR/earned media distribution
- Technical development/IT engineering
- Legal/compliance services

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

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), AI_MATCH_TIMEOUT_MS);

  try {
    let validated: z.infer<typeof ClaudeMatchResponseSchema>;
    try {
      const result = await runWithGeminiFlashModel((model) =>
        generateText({
          model: googleProvider(model),
          output: Output.object({
            schema: ClaudeMatchResponseSchema
          }),
          temperature: 0,
          maxOutputTokens: 4096,
          abortSignal: abortController.signal,
          prompt
        })
      );
      validated = ClaudeMatchResponseSchema.parse(result.output);
    } catch (error) {
      if (!shouldRetryScopeMatchWithTextMode(error)) {
        throw error;
      }

      const textResult = await runWithGeminiFlashModel((model) =>
        generateText({
          model: googleProvider(model),
          temperature: 0,
          maxOutputTokens: 4096,
          abortSignal: abortController.signal,
          prompt:
            `${prompt}\n\n` +
            "STRICT OUTPUT RULES:\n" +
            "- Return exactly one JSON object.\n" +
            "- No markdown fences, no commentary.\n" +
            "- Do not omit the matches array."
        })
      );
      const parsed = parseScopeMatchFromText(textResult.text ?? "");
      if (!parsed) {
        const lineModeResult = await runWithGeminiFlashModel((model) =>
          generateText({
            model: googleProvider(model),
            temperature: 0,
            maxOutputTokens: 4096,
            abortSignal: abortController.signal,
            prompt:
              `Classify each scope item with this strict line format only:\n` +
              `index||matchedService||matchClass||confidence||reasoning\n` +
              `Allowed matchClass: full|partial|none|uncertain\n` +
              `Output one line per scope item, in order, no markdown.\n\n` +
              `Agency service taxonomy:\n${serviceList}\n\n` +
              `Scope items:\n${scopeItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}`
          })
        );
        const lineParsed = parseLineModeMatches(lineModeResult.text ?? "", scopeItems);
        if (!lineParsed) {
          throw new Error("AI scope matching fallback parse failed (json + line modes).");
        }
        console.warn("[ScopeMatch] Recovered using line-mode fallback.");
        validated = lineParsed;
        return validated.matches.map(m => ({
          scopeItem: m.scopeItem,
          service: m.matchedService || "No direct match",
          class: m.matchClass,
          confidence: m.confidence,
          reasoning: m.reasoning
        }));
      }
      console.warn("[ScopeMatch] Recovered using text-mode JSON fallback.");
      validated = parsed;
    }

    return validated.matches.map(m => ({
      scopeItem: m.scopeItem,
      service: m.matchedService || "No direct match",
      class: m.matchClass,
      confidence: m.confidence,
      reasoning: m.reasoning
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`AI match response validation failed: ${error.issues.map(e => e.message).join(", ")}`);
    }
    throw new Error(`AI scope matching failed: ${error}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
