export interface ResearchClaim {
  key: string;
  value: string;
  source: string;
  tier: 1 | 2 | 3 | 4;
  sourceDate: string;
  category: "official" | "financial" | "news" | "social";
}

export interface ResolvedClaim {
  key: string;
  value: string;
  source: string;
  tier: 1 | 2 | 3 | 4;
  sourceDate: string;
  agreementCount: number;
}

function toTime(date: string): number {
  const value = new Date(date).valueOf();
  return Number.isNaN(value) ? 0 : value;
}

export function resolveClaims(claims: ResearchClaim[]): ResolvedClaim[] {
  const grouped = new Map<string, ResearchClaim[]>();

  for (const claim of claims) {
    const key = claim.key;
    const current = grouped.get(key) ?? [];
    current.push(claim);
    grouped.set(key, current);
  }

  const resolved: ResolvedClaim[] = [];

  for (const [key, group] of grouped) {
    const counts = new Map<string, number>();
    for (const claim of group) {
      counts.set(claim.value, (counts.get(claim.value) ?? 0) + 1);
    }

    const sorted = [...group].sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }

      if (counts.get(a.value) !== counts.get(b.value)) {
        return (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0);
      }

      return toTime(b.sourceDate) - toTime(a.sourceDate);
    });

    const winner = sorted[0];
    resolved.push({
      key,
      value: winner.value,
      source: winner.source,
      tier: winner.tier,
      sourceDate: winner.sourceDate,
      agreementCount: counts.get(winner.value) ?? 1
    });
  }

  return resolved;
}
