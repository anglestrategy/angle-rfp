export type FreshnessCategory = "official" | "financial" | "news" | "social";

const maxAgeDaysByCategory: Record<FreshnessCategory, number> = {
  official: 730,
  financial: 365,
  news: 365,
  social: 90
};

export function ageInDays(fromIsoDate: string, now: Date = new Date()): number {
  const parsed = new Date(fromIsoDate);
  if (Number.isNaN(parsed.valueOf())) {
    return Number.POSITIVE_INFINITY;
  }

  const ms = now.getTime() - parsed.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function confidenceCapForFreshness(category: FreshnessCategory, sourceDate: string, now: Date = new Date()): number {
  const age = ageInDays(sourceDate, now);
  const maxDays = maxAgeDaysByCategory[category];

  if (age <= maxDays) {
    return 1;
  }

  if (age <= maxDays * 1.5) {
    return 0.75;
  }

  return 0.6;
}
