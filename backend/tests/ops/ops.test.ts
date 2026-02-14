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
import { fetchWithRetry } from "@/lib/ops/retriable-fetch";

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
    // Build without embedding contiguous secret-looking literals in the repo.
    const claudeKey = "sk" + "-ant-" + "1234567890" + "abcdef";
    const braveKey = "B" + "SA" + "_test_" + "token_" + "1234567890";
    const message = `Email user@example.com token Bearer abc.def.ghi phone +966 55 123 4567 claude ${claudeKey} brave ${braveKey}`;
    const redacted = redactLogText(message);
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).not.toContain("abc.def.ghi");
    expect(redacted).not.toContain("sk-ant-");
    expect(redacted).not.toContain(claudeKey);
    expect(redacted).not.toContain(braveKey);
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

describe("retriable fetch", () => {
  test("retries on retryable HTTP status and eventually succeeds", async () => {
    const responses = [429, 503, 200];
    let callCount = 0;
    const fetchFn: typeof fetch = async () => {
      const status = responses[Math.min(callCount, responses.length - 1)] ?? 500;
      callCount += 1;
      return new Response(JSON.stringify({ ok: status === 200 }), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    };

    const response = await fetchWithRetry({
      url: "https://example.com/test",
      operationName: "retry-status-test",
      fetchFn,
      timeoutMs: 1_000,
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
      jitterRatio: 0,
      buildInit: () => ({ method: "GET" })
    });

    expect(callCount).toBe(3);
    expect(response.status).toBe(200);
  });

  test("throws after max attempts on network-style errors", async () => {
    let callCount = 0;
    const fetchFn: typeof fetch = async () => {
      callCount += 1;
      throw new TypeError("fetch failed");
    };

    await expect(
      fetchWithRetry({
        url: "https://example.com/unavailable",
        operationName: "network-failure-test",
        fetchFn,
        timeoutMs: 1_000,
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 2,
        jitterRatio: 0,
        buildInit: () => ({ method: "GET" })
      })
    ).rejects.toThrow(/failed after 3 attempts/i);

    expect(callCount).toBe(3);
  });

  test("does not retry non-retryable status codes", async () => {
    let callCount = 0;
    const fetchFn: typeof fetch = async () => {
      callCount += 1;
      return new Response(JSON.stringify({ error: "bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    };

    const response = await fetchWithRetry({
      url: "https://example.com/bad-request",
      operationName: "non-retryable-status-test",
      fetchFn,
      timeoutMs: 1_000,
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
      jitterRatio: 0,
      buildInit: () => ({ method: "GET" })
    });

    expect(callCount).toBe(1);
    expect(response.status).toBe(400);
  });
});
