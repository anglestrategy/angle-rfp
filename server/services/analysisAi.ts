import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import { z, type ZodSchema } from "zod";
import type { AnalysisStageEnvelope } from "@shared/models/analysis";
import { formatSchemaIssues } from "./analysisValidation";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && {
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  }),
});

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }

  throw new Error("No valid JSON found in model response");
}

async function createMessage(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type");
  }

  return {
    text: block.text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      model: "claude-sonnet-4-5",
    },
  };
}

export interface ClaudeJsonStageOptions<T> {
  stageKey: string;
  label: string;
  systemPrompt: string;
  userContent: string;
  schema?: ZodSchema<T>;
  defaultValue: T;
  maxTokens?: number;
}

export interface ClaudeJsonStageResult<T> {
  value: T;
  envelope: AnalysisStageEnvelope;
}

export async function executeClaudeJsonStage<T>({
  stageKey,
  label,
  systemPrompt,
  userContent,
  schema,
  defaultValue,
  maxTokens = 16384,
}: ClaudeJsonStageOptions<T>): Promise<ClaudeJsonStageResult<T>> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let usage: AnalysisStageEnvelope["modelUsage"] = null;

  const run = async () => {
    const response = await createMessage(systemPrompt, userContent, maxTokens);
    usage = response.usage;
    return extractJSON(response.text);
  };

  try {
    const raw = await pRetry(run, { retries: 2, minTimeout: 2000 });
    if (!schema) {
      return {
        value: raw as T,
        envelope: {
          stageKey,
          label,
          status: "complete",
          usedFallback: false,
          degraded: false,
          errorCode: null,
          errorMessage: null,
          elapsedMs: Date.now() - startedMs,
          modelUsage: usage,
          value: raw,
          retryCount: 0,
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    }

    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      return {
        value: parsed.data,
        envelope: {
          stageKey,
          label,
          status: "complete",
          usedFallback: false,
          degraded: false,
          errorCode: null,
          errorMessage: null,
          elapsedMs: Date.now() - startedMs,
          modelUsage: usage,
          value: parsed.data,
          retryCount: 0,
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    }

    let repairUsage: AnalysisStageEnvelope["modelUsage"] = usage;
    try {
      const repairPrompt =
        `The previous response was invalid JSON for the expected schema.\n` +
        `Repair it into valid JSON only.\n` +
        `Schema issues: ${formatSchemaIssues(parsed.error)}\n\n` +
        `Invalid JSON:\n${JSON.stringify(raw, null, 2)}`;
      const repaired = await createMessage(systemPrompt, repairPrompt, maxTokens);
      repairUsage = repaired.usage;
      const repairedRaw = extractJSON(repaired.text);
      const repairedParsed = schema.safeParse(repairedRaw);
      if (repairedParsed.success) {
        return {
          value: repairedParsed.data,
          envelope: {
            stageKey,
            label,
            status: "complete",
            usedFallback: false,
            degraded: false,
            errorCode: null,
            errorMessage: null,
            elapsedMs: Date.now() - startedMs,
            modelUsage: repairUsage,
            value: repairedParsed.data,
            retryCount: 1,
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        };
      }

      return {
        value: defaultValue,
        envelope: {
          stageKey,
          label,
          status: "complete",
          usedFallback: true,
          degraded: true,
          errorCode: "schema_validation_failed",
          errorMessage: formatSchemaIssues(repairedParsed.error),
          elapsedMs: Date.now() - startedMs,
          modelUsage: repairUsage,
          value: defaultValue,
          retryCount: 1,
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    } catch (repairError: any) {
      return {
        value: defaultValue,
        envelope: {
          stageKey,
          label,
          status: "complete",
          usedFallback: true,
          degraded: true,
          errorCode: "schema_repair_failed",
          errorMessage:
            repairError?.message || formatSchemaIssues(parsed.error),
          elapsedMs: Date.now() - startedMs,
          modelUsage: repairUsage,
          value: defaultValue,
          retryCount: 1,
          startedAt,
          finishedAt: new Date().toISOString(),
        },
      };
    }
  } catch (error: any) {
    return {
      value: defaultValue,
      envelope: {
        stageKey,
        label,
        status: "complete",
        usedFallback: true,
        degraded: true,
        errorCode: "model_call_failed",
        errorMessage: error?.message || "Model request failed",
        elapsedMs: Date.now() - startedMs,
        modelUsage: usage,
        value: defaultValue,
        retryCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
    };
  }
}

export function isZodSchema<T>(value: unknown): value is ZodSchema<T> {
  return value instanceof z.ZodType;
}
