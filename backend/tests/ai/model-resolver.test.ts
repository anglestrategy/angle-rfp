import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_CLAUDE_HAIKU_MODEL,
  DEFAULT_CLAUDE_SONNET_MODEL,
  getClaudeSonnetModelCandidates,
  normalizeAnthropicError,
  runWithClaudeSonnetModel,
  resolveClaudeHaikuModel,
  resolveClaudeSonnetModel
} from "@/lib/ai/model-resolver";

const originalEnv = { ...process.env };

function clearModelEnv(): void {
  delete process.env.GEMINI_MODEL_FLASH;
  delete process.env.GOOGLE_MODEL_FLASH;
  delete process.env.GOOGLE_GENERATIVE_AI_MODEL;
  delete process.env.CLAUDE_MODEL_SONNET;
  delete process.env.CLAUDE_MODEL_HAIKU;
  delete process.env.CLAUDE_MODEL;
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("model resolver", () => {
  test("uses explicit sonnet override when valid", () => {
    clearModelEnv();
    process.env.CLAUDE_MODEL_SONNET = "gemini-2.5-pro";

    expect(resolveClaudeSonnetModel()).toBe("gemini-2.5-pro");
  });

  test("uses legacy CLAUDE_MODEL for sonnet when explicit override is absent", () => {
    clearModelEnv();
    process.env.CLAUDE_MODEL = "gemini-2.0-flash";

    expect(resolveClaudeSonnetModel()).toBe("gemini-2.0-flash");
  });

  test("rejects invalid sonnet alias and falls back to default", () => {
    clearModelEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.CLAUDE_MODEL_SONNET = "claude-sonnet-4-5-latest";

    expect(resolveClaudeSonnetModel()).toBe(DEFAULT_CLAUDE_SONNET_MODEL);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  test("normalizes prefixed model values to plain Gemini model IDs", () => {
    clearModelEnv();
    process.env.GEMINI_MODEL_FLASH = "models/gemini-2.5-flash";

    expect(resolveClaudeSonnetModel()).toBe("gemini-2.5-flash");
  });

  test("accepts comma-separated model overrides by using the first value", () => {
    clearModelEnv();
    process.env.GEMINI_MODEL_FLASH = "gemini-2.5-flash, gemini-2.0-flash";

    expect(resolveClaudeSonnetModel()).toBe("gemini-2.5-flash");
  });

  test("sanitizes model strings with prefixes and query fragments", () => {
    clearModelEnv();
    process.env.GEMINI_MODEL_FLASH = "model=models/gemini-2.5-flash?alt=sse";

    expect(resolveClaudeSonnetModel()).toBe("gemini-2.5-flash");
  });

  test("rejects invalid haiku alias and falls back to default", () => {
    clearModelEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.CLAUDE_MODEL_HAIKU = "claude-haiku-4-5-latest";

    expect(resolveClaudeHaikuModel()).toBe(DEFAULT_CLAUDE_HAIKU_MODEL);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  test("falls back through model candidates when first model is unavailable", async () => {
    clearModelEnv();
    process.env.GEMINI_MODEL_FLASH = "gemini-2.5-flash";
    const candidates = getClaudeSonnetModelCandidates();
    expect(candidates[0]).toBe("gemini-2.5-flash");

    const firstCandidate = candidates[0];
    const response = await runWithClaudeSonnetModel(async (model) => {
      if (model === firstCandidate) {
        throw {
          status: 404,
          error: {
            type: "not_found_error",
            message: `model: ${firstCandidate}`
          }
        };
      }
      return model;
    });

    expect(response).not.toBe(firstCandidate);
    expect(candidates).toContain(response);
    expect(response).toBeTruthy();
  });
});

describe("normalizeAnthropicError", () => {
  test("rewrites model not found errors with env var guidance", () => {
    const normalized = normalizeAnthropicError(
      {
        status: 404,
        requestID: "req_test_123",
        error: {
          type: "not_found_error",
          message: "model: claude-sonnet-4-5-latest"
        }
      },
      {
        model: "claude-sonnet-4-5-latest",
        envVars: ["CLAUDE_MODEL_SONNET", "CLAUDE_MODEL"]
      }
    );

    expect(normalized.message).toContain("CLAUDE_MODEL_SONNET");
    expect(normalized.message).toContain("CLAUDE_MODEL");
    expect(normalized.message).toContain("req_test_123");
  });
});
