import { describe, expect, test } from "vitest";
import { confidenceCapForFreshness } from "@/lib/research/freshness";
import { researchClientInput, buildBilingualQueries } from "@/lib/research/research-client";
import { resolveClaims } from "@/lib/research/trust-resolver";

describe("buildBilingualQueries", () => {
  test("builds english and arabic query sets", () => {
    const queries = buildBilingualQueries({
      analysisId: "id",
      clientName: "Saudi Aramco",
      clientNameArabic: "أرامكو السعودية",
      country: "SA"
    });

    expect(queries.english.length).toBe(3);
    expect(queries.arabic.length).toBe(3);
    expect(queries.arabic[0]).toContain("أرامكو");
  });
});

describe("trust resolver", () => {
  test("prefers tier-1 claims over lower tiers on conflict", () => {
    const resolved = resolveClaims([
      {
        key: "entityType",
        value: "public_company",
        source: "Tadawul",
        tier: 1,
        sourceDate: "2026-02-10",
        category: "official"
      },
      {
        key: "entityType",
        value: "private_company",
        source: "Blog",
        tier: 4,
        sourceDate: "2026-02-11",
        category: "news"
      }
    ]);

    expect(resolved[0].value).toBe("public_company");
    expect(resolved[0].tier).toBe(1);
  });
});

describe("freshness", () => {
  test("caps confidence for stale sources", () => {
    const cap = confidenceCapForFreshness("social", "2024-01-01", new Date("2026-02-10"));
    expect(cap).toBeLessThanOrEqual(0.6);
  });
});

describe("researchClientInput", () => {
  test("returns partial result warnings when provider outages occur", async () => {
    const result = await researchClientInput(
      {
        analysisId: "2d887df7-8114-4f67-ac44-ed9902eb77b6",
        clientName: "Saudi Aramco",
        clientNameArabic: "أرامكو السعودية",
        country: "SA"
      },
      {
        brave: async () => {
          throw new Error("brave outage");
        },
        tavily: async () => [
          {
            key: "marketSignal",
            value: "Enterprise campaigns continue",
            source: "Tavily",
            tier: 2,
            sourceDate: "2026-02-10",
            category: "financial"
          }
        ],
        firecrawl: async () => [
          {
            key: "officialSignal",
            value: "Registered public entity",
            source: "Wathq",
            tier: 1,
            sourceDate: "2026-02-10",
            category: "official"
          }
        ]
      }
    );

    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
