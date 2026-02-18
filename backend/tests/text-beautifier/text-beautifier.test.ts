import { describe, expect, test } from "vitest";
import { beautifyText } from "@/lib/extraction/text-beautifier";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("beautifyText project description", () => {
  test("keeps key objective distinct from summary when source is repetitive", async () => {
    const raw =
      "Review and identify key learnings from previous Expo editions as well as current Expo 2030 Riyadh brand and marcom strategy.";

    const result = await beautifyText(raw, "Project Description");
    const sections = result.sections;
    const firstParagraph = sections.find((section) => section.type === "paragraph")?.content ?? "";
    const keyObjectiveIndex = sections.findIndex(
      (section) => section.type === "subheading" && /key objective/i.test(section.content)
    );
    const objectiveSection = keyObjectiveIndex >= 0 ? sections[keyObjectiveIndex + 1] : undefined;
    const objectiveText =
      objectiveSection?.type === "bullet_list" || objectiveSection?.type === "numbered_list"
        ? (objectiveSection.items ?? []).join(" ")
        : objectiveSection?.content ?? "";

    expect(keyObjectiveIndex).toBeGreaterThanOrEqual(0);
    expect(normalize(firstParagraph)).not.toBe("");
    expect(normalize(objectiveText)).not.toBe("");
    expect(normalize(objectiveText)).not.toBe(normalize(firstParagraph));
    expect(normalize(objectiveText)).not.toContain(normalize(firstParagraph));
  });
});
