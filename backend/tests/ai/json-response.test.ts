import { describe, expect, test } from "vitest";
import { parseJsonFromModelText } from "@/lib/ai/json-response";

describe("parseJsonFromModelText", () => {
  test("parses plain JSON object", () => {
    const parsed = parseJsonFromModelText<{ ok: boolean }>('{"ok":true}', {
      context: "unit",
      expectedType: "object"
    });

    expect(parsed.ok).toBe(true);
  });

  test("parses fenced JSON with prefix/suffix text", () => {
    const parsed = parseJsonFromModelText<{ matches: unknown[] }>(
      'Here is the result:\n```json\n{"matches":[{"scopeItem":"x"}]}\n```\nDone.',
      {
        context: "scope",
        expectedType: "object"
      }
    );

    expect(Array.isArray(parsed.matches)).toBe(true);
    expect(parsed.matches.length).toBe(1);
  });

  test("parses embedded JSON object even without fences", () => {
    const parsed = parseJsonFromModelText<{ english: string[]; arabic: string[] }>(
      'Sure. {"english":["q1","q2"],"arabic":["س١"]} thanks',
      {
        context: "queries",
        expectedType: "object"
      }
    );

    expect(parsed.english).toEqual(["q1", "q2"]);
    expect(parsed.arabic).toEqual(["س١"]);
  });

  test("throws a useful error when expected type mismatches", () => {
    expect(() =>
      parseJsonFromModelText("[1,2,3]", {
        context: "type-check",
        expectedType: "object"
      })
    ).toThrow(/expected a JSON object response/i);
  });
});
