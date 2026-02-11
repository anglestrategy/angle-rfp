import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_CLAUDE_HAIKU_MODEL,
  DEFAULT_CLAUDE_SONNET_MODEL,
  normalizeAnthropicError,
  resolveClaudeHaikuModel,
  resolveClaudeSonnetModel
} from "@/lib/ai/model-resolver";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("model resolver", () => {
  test("uses explicit sonnet override when valid", () => {
    process.env.CLAUDE_MODEL_SONNET = "claude-3-5-sonnet-20241022";

    expect(resolveClaudeSonnetModel()).toBe("claude-3-5-sonnet-20241022");
  });

  test("uses legacy CLAUDE_MODEL for sonnet when explicit override is absent", () => {
    delete process.env.CLAUDE_MODEL_SONNET;
    process.env.CLAUDE_MODEL = "claude-3-5-sonnet-20241022";

    expect(resolveClaudeSonnetModel()).toBe("claude-3-5-sonnet-20241022");
  });

  test("rejects invalid sonnet alias and falls back to default", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.CLAUDE_MODEL_SONNET = "claude-sonnet-4-5-latest";

    expect(resolveClaudeSonnetModel()).toBe(DEFAULT_CLAUDE_SONNET_MODEL);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  test("rejects invalid haiku alias and falls back to default", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.CLAUDE_MODEL_HAIKU = "claude-haiku-4-5-latest";

    expect(resolveClaudeHaikuModel()).toBe(DEFAULT_CLAUDE_HAIKU_MODEL);
    expect(warnSpy).toHaveBeenCalledOnce();
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
