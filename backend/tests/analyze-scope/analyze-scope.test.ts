import { describe, expect, test } from "vitest";
import { analyzeScopeInput } from "@/lib/scope/analyze-scope";
import { clearTaxonomyCacheForTests, loadAgencyTaxonomy } from "@/lib/scope/taxonomy-loader";

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
    expect(result.matches.some((item) => item.class === "none")).toBe(true);

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
});
