import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { resolveGoogleApiKey, runWithGeminiFlashModel } from "@/lib/ai/model-resolver";
import type { FactorBreakdownItem } from "@/lib/scoring/factors";

const SCORE_REFINER_TIMEOUT_MS = 90_000;

const FactorLabels = {
  projectScopeMagnitude: "Project Scope Magnitude",
  agencyServicesPercentage: "Agency Services Percentage",
  outputQuantities: "Output Quantities",
  outputTypes: "Output Types",
  companyBrandSize: "Company/Brand Size",
  brandPopularityReach: "Brand Popularity/Reach",
  holdingGroupAffiliation: "Holding Group Affiliation",
  entityType: "Entity Type",
  mediaAdSpendIndicators: "Media/Ad Spend Indicators",
  socialActivityLevel: "Social Activity Level",
  contentTypesPublished: "Content Types Published"
} as const;

type ScoreFactorKey = keyof typeof FactorLabels;

const FactorAssessmentSchema = z.object({
  score: z.number().min(0).max(100),
  identified: z.boolean(),
  evidence: z.array(z.string().min(1).max(220)).max(4).default([])
});

const AiScoreRefinementSchema = z.object({
  factors: z.object({
    projectScopeMagnitude: FactorAssessmentSchema,
    agencyServicesPercentage: FactorAssessmentSchema,
    outputQuantities: FactorAssessmentSchema,
    outputTypes: FactorAssessmentSchema,
    companyBrandSize: FactorAssessmentSchema,
    brandPopularityReach: FactorAssessmentSchema,
    holdingGroupAffiliation: FactorAssessmentSchema,
    entityType: FactorAssessmentSchema,
    mediaAdSpendIndicators: FactorAssessmentSchema,
    socialActivityLevel: FactorAssessmentSchema,
    contentTypesPublished: FactorAssessmentSchema
  }),
  recommendationBand: z.enum(["EXCELLENT", "GOOD", "MODERATE", "LOW"]),
  rationale: z.string().min(16).max(420),
  warnings: z.array(z.string().min(3).max(220)).max(10).default([])
});

type AiScoreRefinementResult = z.infer<typeof AiScoreRefinementSchema>;

interface AiScoreRefinementInput {
  analysisId: string;
  extractedRfp: Record<string, unknown>;
  scopeAnalysis: Record<string, unknown>;
  clientResearch: Record<string, unknown>;
  baselineFactors: FactorBreakdownItem[];
  deterministicWarnings: string[];
}

interface AiScoreRefinementOutput {
  factors: FactorBreakdownItem[];
  recommendationBand: "EXCELLENT" | "GOOD" | "MODERATE" | "LOW";
  rationale: string;
  warnings: string[];
}

function clip(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stripMarkdownCodeFences(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json|JSON|yaml|YAML)?\s*\n?/gm, "");
  cleaned = cleaned.replace(/\n?\s*```\s*$/gm, "");
  cleaned = cleaned.replace(/^[^{\[]*?(?=[{\[])/s, "");
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }
  return cleaned.trim();
}

function extractFirstBalancedJsonObject(raw: string): string | null {
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
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
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
    }
  }

  return null;
}

function appendMissingJsonClosers(input: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      stack.push("}");
      continue;
    }
    if (char === "[") {
      stack.push("]");
      continue;
    }
    if ((char === "}" || char === "]") && stack.length > 0 && stack[stack.length - 1] === char) {
      stack.pop();
    }
  }

  if (stack.length === 0) {
    return input;
  }
  return `${input}${stack.reverse().join("")}`;
}

function normalizeJsonLikeAttempts(base: string): string[] {
  const quoteUnquotedKeys = (input: string): string =>
    input.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, "$1\"$2\"$3");

  const singleToDoubleQuotedStrings = (input: string): string =>
    input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner: string) => `\"${inner.replace(/\"/g, "\\\"")}\"`);

  const cleaned = base.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1");
  const attempts = [
    base,
    cleaned,
    quoteUnquotedKeys(cleaned),
    singleToDoubleQuotedStrings(cleaned),
    appendMissingJsonClosers(cleaned)
  ];

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const attempt of attempts) {
    const normalized = attempt.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function parseObjectFromModelText(raw: string): Record<string, unknown> | null {
  const balancedJson = extractFirstBalancedJsonObject(raw);
  const sanitizedRaw = stripMarkdownCodeFences(raw);
  const firstBraceIndex = sanitizedRaw.indexOf("{");
  const jsonLike = balancedJson ?? (firstBraceIndex >= 0 ? sanitizedRaw.slice(firstBraceIndex).trim() : null);

  if (!jsonLike) {
    return null;
  }

  const attempts = normalizeJsonLikeAttempts(jsonLike);
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // continue
    }
  }

  for (const attempt of attempts) {
    try {
      const parsed = parseYaml(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // continue
    }
  }

  return null;
}

function computeWeightedScoreFromFactors(factors: FactorBreakdownItem[]): number {
  const identified = factors.filter((factor) => factor.identified);
  const weightTotal = identified.reduce((sum, factor) => sum + factor.weight, 0);
  if (weightTotal <= 0) {
    return 0;
  }
  const contributionTotal = identified.reduce((sum, factor) => sum + factor.contribution, 0);
  return roundToTwo(contributionTotal / weightTotal);
}

function recommendationBandForScore(score: number): "EXCELLENT" | "GOOD" | "MODERATE" | "LOW" {
  if (score >= 85) {
    return "EXCELLENT";
  }
  if (score >= 70) {
    return "GOOD";
  }
  if (score >= 50) {
    return "MODERATE";
  }
  return "LOW";
}

function blendAiScoreWithBaseline(aiScore: number, baselineScore: number): number {
  const blended = aiScore * 0.65 + baselineScore * 0.35;
  const softMin = Math.max(0, baselineScore - 35);
  const softMax = Math.min(100, baselineScore + 35);
  return roundToTwo(clamp(blended, softMin, softMax));
}

function normalizeAiResult(raw: AiScoreRefinementResult, baselineFactors: FactorBreakdownItem[]): AiScoreRefinementOutput {
  const baselineByLabel = new Map(baselineFactors.map((factor) => [factor.factor, factor]));
  const normalizedWarnings = (raw.warnings ?? [])
    .map((warning) => clip(warning, 220))
    .filter(Boolean)
    .slice(0, 10);

  const resolvedFactors: FactorBreakdownItem[] = (Object.keys(FactorLabels) as ScoreFactorKey[]).map((key) => {
    const label = FactorLabels[key];
    const baseline = baselineByLabel.get(label);
    if (!baseline) {
      throw new Error(`Missing baseline factor '${label}'.`);
    }

    const aiFactor = raw.factors[key];
    const aiScore = clamp(aiFactor.score, 0, 100);
    const baselineScore = clamp(baseline.score, 0, 100);
    const baselineIdentified = Boolean(baseline.identified);
    const aiIdentified = Boolean(aiFactor.identified);
    const identified = baselineIdentified || aiIdentified;
    const score =
      !identified
        ? 0
        : baselineIdentified && aiIdentified
          ? blendAiScoreWithBaseline(aiScore, baselineScore)
          : baselineIdentified
            ? baselineScore
            : roundToTwo(aiScore);
    const evidence = (aiFactor.evidence ?? []).map((entry) => clip(entry, 220)).filter(Boolean).slice(0, 4);

    return {
      factor: label,
      weight: baseline.weight,
      score: roundToTwo(score),
      contribution: identified ? roundToTwo(score * baseline.weight) : 0,
      evidence: evidence.length > 0 ? evidence : baseline.evidence.slice(0, 2),
      status: identified ? "scored" : "insufficient_evidence",
      identified
    };
  });

  const calibratedScore = computeWeightedScoreFromFactors(resolvedFactors);
  const calibratedBand = recommendationBandForScore(calibratedScore);
  if (calibratedBand !== raw.recommendationBand) {
    normalizedWarnings.push(
      `AI recommendation band was recalibrated from ${raw.recommendationBand} to ${calibratedBand} based on factor consistency.`
    );
  }

  return {
    factors: resolvedFactors,
    recommendationBand: calibratedBand,
    rationale: clip(raw.rationale, 420),
    warnings: normalizedWarnings.slice(0, 10)
  };
}

function buildPrompt(input: AiScoreRefinementInput): string {
  return `You are a senior new-business strategy director for a marketing agency.

Your job: produce an AI-first financial opportunity scoring assessment for this RFP.

Scoring factors (0-100 each):
1. Project Scope Magnitude
2. Agency Services Percentage
3. Output Quantities
4. Output Types
5. Company/Brand Size
6. Brand Popularity/Reach
7. Holding Group Affiliation
8. Entity Type
9. Media/Ad Spend Indicators
10. Social Activity Level
11. Content Types Published

Rules:
- Use evidence from extracted RFP + scope analysis + research.
- If evidence is missing for a factor, set identified=false and score conservatively.
- Keep rationale executive-grade, concise, and decision-focused.
- Be realistic; avoid inflated optimism.
- Return strict JSON only.

analysisId: ${input.analysisId}

BASELINE_FACTORS_JSON:
${JSON.stringify(input.baselineFactors)}

EXTRACTED_RFP_JSON:
${JSON.stringify(input.extractedRfp)}

SCOPE_ANALYSIS_JSON:
${JSON.stringify(input.scopeAnalysis)}

CLIENT_RESEARCH_JSON:
${JSON.stringify(input.clientResearch)}

DETERMINISTIC_WARNINGS_JSON:
${JSON.stringify(input.deterministicWarnings.slice(0, 10))}
`;
}

export async function runAiScoreRefinement(input: AiScoreRefinementInput): Promise<AiScoreRefinementOutput> {
  const apiKey = resolveGoogleApiKey();
  if (!apiKey) {
    throw new Error(
      "No Gemini API key configured. Set GOOGLE_API_KEY or GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
    );
  }

  const provider = createGoogleGenerativeAI({ apiKey });
  const prompt = buildPrompt(input);

  try {
    const structured = await runWithGeminiFlashModel((model) =>
      generateText({
        model: provider(model),
        temperature: 0,
        abortSignal: AbortSignal.timeout(SCORE_REFINER_TIMEOUT_MS),
        experimental_output: Output.object({
          schema: AiScoreRefinementSchema
        }),
        prompt
      })
    );

    if (structured.experimental_output) {
      return normalizeAiResult(structured.experimental_output, input.baselineFactors);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ScoreAI] Structured scoring refinement failed; retrying text mode: ${clip(message, 220)}`);
  }

  const fallback = await runWithGeminiFlashModel((model) =>
    generateText({
      model: provider(model),
      temperature: 0,
      maxOutputTokens: 8_192,
      abortSignal: AbortSignal.timeout(SCORE_REFINER_TIMEOUT_MS),
      prompt:
        `${prompt}\n\n` +
        "CRITICAL OUTPUT RULES:\n" +
        "- Return ONLY one raw JSON object.\n" +
        "- Do not use markdown code fences.\n" +
        "- No prose outside JSON.\n"
    })
  );

  const parsed = parseObjectFromModelText(fallback.text ?? "");
  if (!parsed) {
    throw new Error("AI score refinement text-mode fallback returned unparsable JSON.");
  }

  const validated = AiScoreRefinementSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("AI score refinement text-mode fallback did not match schema.");
  }

  return normalizeAiResult(validated.data, input.baselineFactors);
}
