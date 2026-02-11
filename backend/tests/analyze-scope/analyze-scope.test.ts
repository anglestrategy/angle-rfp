import { describe, expect, test } from "vitest";
import { analyzeScopeInput } from "@/lib/scope/analyze-scope";
import { clearTaxonomyCacheForTests, loadAgencyTaxonomy } from "@/lib/scope/taxonomy-loader";
import { matchScopeItems, splitScopeItems } from "@/lib/scope/matcher";

describe("loadAgencyTaxonomy", () => {
  test("loads canonical service taxonomy from csv", async () => {
    clearTaxonomyCacheForTests();
    const services = await loadAgencyTaxonomy();

    expect(services.length).toBeGreaterThanOrEqual(78);
    expect(services.some((item) => /brand strategy/i.test(item.service))).toBe(true);
  });
});

describe("analyzeScopeInput", () => {
  test("computes full/partial/none matches with deterministic formula", async () => {
    const result = await analyzeScopeInput({
      analysisId: "f7df722f-9968-4c17-980a-fcb53aaf56d1",
      language: "english",
      scopeOfWork: [
        "Brand strategy development",
        "Video Production Supervision",
        "Custom blockchain smart-contract development"
      ].join("\n")
    });

    expect(result.matches.length).toBeGreaterThanOrEqual(3);
    expect(result.matches.some((item) => item.class === "full")).toBe(true);
    expect(result.matches.some((item) => item.class === "partial")).toBe(true);
    expect(result.matches.some((item) => item.class !== "full")).toBe(true);

    const expected = (result.matches.filter((m) => m.class === "full").length +
      0.5 * result.matches.filter((m) => m.class === "partial").length) /
      result.matches.length;

    expect(Math.abs(result.agencyServicePercentage - Math.round(expected * 1000) / 1000)).toBeLessThanOrEqual(0.0001);
    expect(result.outsourcingPercentage).toBeCloseTo(Math.round((1 - result.agencyServicePercentage) * 1000) / 1000, 3);
  });

  test("extracts output quantities and output types", async () => {
    const result = await analyzeScopeInput({
      analysisId: "f7df722f-9968-4c17-980a-fcb53aaf56d1",
      language: "english",
      scopeOfWork: "Create 5 videos, 12 animated posts, 45 static designs, and 20 content pieces"
    });

    expect(result.outputQuantities.videoProduction).toBe(5);
    expect(result.outputQuantities.motionGraphics).toBe(12);
    expect(result.outputQuantities.visualDesign).toBe(45);
    expect(result.outputQuantities.contentOnly).toBe(20);
    expect(result.outputTypes).toContain("videoProduction");
  });

  test("captures xN style quantities and keyword-based output types", async () => {
    const result = await analyzeScopeInput({
      analysisId: "f7df722f-9968-4c17-980a-fcb53aaf56d1",
      language: "english",
      scopeOfWork:
        "Post launch plan includes quarterly reports x8 and performance plans x8. Also produce key visual direction and iconography."
    });

    expect((result.outputQuantities.contentOnly ?? 0) >= 8).toBe(true);
    expect(result.outputTypes).toContain("contentOnly");
    expect(result.outputTypes).toContain("visualDesign");
  });

  test("splitScopeItems removes structural markdown noise and keeps real scope lines", () => {
    const scope = [
      "## Phase 6: Post-Launch Plan",
      "• Strengthen emotional connection and public engagement within local audience",
      "• Develop campaign plans based on performance report outcomes to drive brand equity till end of 2026",
      "## Deliverables",
      "1. Local Brand Strategy",
      "2. Launch Campaign Strategy"
    ].join("\n");

    const items = splitScopeItems(scope);

    expect(items).not.toContain("## Deliverables");
    expect(items.some((item) => /post-launch/i.test(item))).toBe(false);
    expect(items.some((item) => /strengthen emotional connection/i.test(item))).toBe(true);
    expect(items.some((item) => /launch campaign strategy/i.test(item))).toBe(true);
  });

  test("matchScopeItems avoids hard-none for clearly agency-like work statements", async () => {
    clearTaxonomyCacheForTests();
    const taxonomy = await loadAgencyTaxonomy();
    const [match] = matchScopeItems(
      ["Develop campaign plans based on performance report outcomes to drive brand equity till end of 2026"],
      taxonomy
    );

    expect(match).toBeDefined();
    expect(match.class).not.toBe("none");
  });
});
