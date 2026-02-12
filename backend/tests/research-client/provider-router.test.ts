import { describe, expect, test } from "vitest";
import {
  clearProviderHealthForTests,
  getProviderHealthScore,
  rankProviders,
  recordProviderOutcome
} from "@/lib/research/provider-router";

describe("provider-router", () => {
  test("ranks providers by health score from recent outcomes", () => {
    clearProviderHealthForTests();

    for (let i = 0; i < 8; i += 1) {
      recordProviderOutcome("tavily", { ok: true, latencyMs: 600, rateLimited: false });
      recordProviderOutcome("exa", { ok: true, latencyMs: 700, rateLimited: false });
      recordProviderOutcome("brave", { ok: false, latencyMs: 2200, rateLimited: true, statusCode: 429 });
    }

    const ranked = rankProviders(["tavily", "exa", "brave"]);
    expect(ranked[0]).toBe("tavily");
    expect(ranked[ranked.length - 1]).toBe("brave");
    expect(getProviderHealthScore("brave").rateLimitRate).toBeGreaterThan(0);
  });
});
