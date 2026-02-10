function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

interface RedFlagLike {
  severity?: string;
}

export function computeRedFlagPenalty(redFlags: RedFlagLike[] | undefined): number {
  const normalized = (redFlags ?? []).map((flag) => (flag.severity ?? "").toUpperCase());

  const highCount = normalized.filter((severity) => severity === "HIGH").length;
  const mediumCount = normalized.filter((severity) => severity === "MEDIUM").length;
  const lowCount = normalized.filter((severity) => severity === "LOW").length;

  const highPenalty = Math.min(highCount * 8, 24);
  const mediumPenalty = Math.min(mediumCount * 3, 12);
  const lowPenalty = Math.min(lowCount, 5);

  return roundToTwo(highPenalty + mediumPenalty + lowPenalty);
}

export function computeCompletenessPenalty(completenessScore: number | undefined): number {
  const bounded = clamp(completenessScore ?? 0, 0, 1);
  return roundToTwo((1 - bounded) * 10);
}
