import { describe, expect, test } from "vitest";
import { assertWithinRateLimit, resetRateLimiter } from "@/lib/ops/rate-limit";
import { InMemoryCircuitBreaker } from "@/lib/ops/circuit-breaker";
import {
  getBudgetSnapshot,
  registerAnalysisUsage,
  reserveUserDailyAnalysis,
  resetBudgetTracking
} from "@/lib/ops/cost-budget";
import { redactLogMetadata, redactLogText } from "@/lib/ops/log-redaction";

describe("rate limiter", () => {
  test("enforces bucket capacity and refill", () => {
    resetRateLimiter();
    const opts = {
      capacity: 2,
      refillPerSecond: 1
    };

    assertWithinRateLimit("user:/api/test", opts, 0);
    assertWithinRateLimit("user:/api/test", opts, 0);
    expect(() => assertWithinRateLimit("user:/api/test", opts, 0)).toThrow("Rate limit exceeded");
    expect(() => assertWithinRateLimit("user:/api/test", opts, 2_000)).not.toThrow();
  });
});

describe("circuit breaker", () => {
  test("opens on threshold and closes after half-open successes", () => {
    const breaker = new InMemoryCircuitBreaker({
      failureThreshold: 2,
      failureWindowMs: 5_000,
      openStateMs: 50,
      halfOpenSuccessesToClose: 2
    });

    expect(breaker.canExecute(0)).toBe(true);
    breaker.onFailure(1);
    breaker.onFailure(2);
    expect(breaker.getSnapshot().state).toBe("open");
    expect(breaker.canExecute(20)).toBe(false);
    expect(breaker.canExecute(70)).toBe(true);
    expect(breaker.getSnapshot().state).toBe("half_open");

    breaker.onSuccess();
    expect(breaker.getSnapshot().state).toBe("half_open");
    breaker.onSuccess();
    expect(breaker.getSnapshot().state).toBe("closed");
  });
});

describe("cost budget", () => {
  test("enforces daily quota and analysis budgets", () => {
    resetBudgetTracking();
    const date = new Date("2026-02-10T10:00:00Z");

    for (let i = 0; i < 20; i += 1) {
      reserveUserDailyAnalysis("u1", `analysis-${i}`, date);
    }
    expect(() => reserveUserDailyAnalysis("u1", "analysis-21", date)).toThrow("Daily analysis quota exceeded");

    registerAnalysisUsage({ analysisId: "budget-1", tokens: 200_000, ocrPages: 100, queries: 20 });
    const snapshot = getBudgetSnapshot("budget-1");
    expect(snapshot.tokens).toBe(200_000);
    expect(snapshot.ocrPages).toBe(100);
    expect(snapshot.queries).toBe(20);

    expect(() => registerAnalysisUsage({ analysisId: "budget-1", tokens: 25_000 })).toThrow(
      "Analysis token budget exceeded"
    );
  });
});

describe("log redaction", () => {
  test("redacts secrets and PII", () => {
    const message = "Email user@example.com token Bearer abc.def.ghi phone +966 55 123 4567";
    const redacted = redactLogText(message);
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).not.toContain("abc.def.ghi");
    expect(redacted).toContain("[REDACTED]");

    const metadata = redactLogMetadata({
      token: "secret",
      nested: {
        email: "person@site.com"
      }
    }) as Record<string, unknown>;

    expect(metadata.token).toBe("[REDACTED]");
    expect((metadata.nested as Record<string, unknown>).email).toBe("[REDACTED]");
  });
});
