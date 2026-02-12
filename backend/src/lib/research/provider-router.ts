export type RoutedProviderName = "tavily" | "exa" | "brave" | "firecrawl";

interface ProviderSample {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  rateLimited: boolean;
  at: number;
}

interface ProviderHealthState {
  samples: ProviderSample[];
}

export interface ProviderHealthScore {
  provider: RoutedProviderName;
  successRate: number;
  p95LatencyMs: number;
  rateLimitRate: number;
  errorRate: number;
  healthScore: number;
}

const MAX_SAMPLES = 40;

const state: Record<RoutedProviderName, ProviderHealthState> = {
  tavily: { samples: [] },
  exa: { samples: [] },
  brave: { samples: [] },
  firecrawl: { samples: [] }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? 0;
}

export function recordProviderOutcome(
  provider: RoutedProviderName,
  sample: Omit<ProviderSample, "at">
): void {
  const target = state[provider];
  target.samples.push({
    ...sample,
    at: Date.now()
  });

  if (target.samples.length > MAX_SAMPLES) {
    target.samples.splice(0, target.samples.length - MAX_SAMPLES);
  }
}

export function getProviderHealthScore(provider: RoutedProviderName): ProviderHealthScore {
  const samples = state[provider].samples;

  if (samples.length === 0) {
    return {
      provider,
      successRate: 0.8,
      p95LatencyMs: 1000,
      rateLimitRate: 0,
      errorRate: 0,
      healthScore: 80
    };
  }

  const successes = samples.filter((sample) => sample.ok).length;
  const failures = samples.length - successes;
  const rateLimited = samples.filter((sample) => sample.rateLimited).length;
  const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);

  const successRate = successes / samples.length;
  const errorRate = failures / samples.length;
  const rateLimitRate = rateLimited / samples.length;
  const p95LatencyMs = quantile(latencies, 0.95);

  // Health score prioritizes reliability, then latency stability.
  const healthScore = clamp(
    100 * successRate -
      45 * rateLimitRate -
      30 * errorRate -
      20 * clamp(p95LatencyMs / 4000, 0, 1),
    0,
    100
  );

  return {
    provider,
    successRate,
    p95LatencyMs,
    rateLimitRate,
    errorRate,
    healthScore
  };
}

export function rankProviders(providers: RoutedProviderName[]): RoutedProviderName[] {
  return [...providers].sort((a, b) => getProviderHealthScore(b).healthScore - getProviderHealthScore(a).healthScore);
}

export function clearProviderHealthForTests(): void {
  (Object.keys(state) as RoutedProviderName[]).forEach((provider) => {
    state[provider].samples = [];
  });
}
