import { fetchWithRetry } from "@/lib/ops/retriable-fetch";

export interface ProviderDocument {
  key: string;
  value: string;
  source: string;
  tier: 1 | 2 | 3 | 4;
  sourceDate: string;
  category: "official" | "financial" | "news" | "social";
}

interface BraveApiResponse {
  web?: {
    results?: Array<{
      title: string;
      description?: string;
      url: string;
    }>;
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function queryBrave(
  query: string,
  fetchFn: typeof fetch = fetch,
  maxRetries = 4
): Promise<ProviderDocument[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) {
    console.warn("BRAVE_SEARCH_API_KEY is not configured - search functionality degraded");
    return [
      {
        key: "marketingBudgetIndicator",
        value: "UNKNOWN",
        source: "Brave (key missing)",
        tier: 3,
        sourceDate: todayIsoDate(),
        category: "news"
      }
    ];
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");

  const response = await fetchWithRetry({
    url,
    operationName: "Brave search",
    fetchFn,
    timeoutMs: 15_000,
    maxAttempts: Math.max(1, maxRetries),
    baseDelayMs: 1_000,
    maxDelayMs: 8_000,
    retryOnStatusCodes: [408, 425, 429, 500, 502, 503, 504],
    buildInit: () => ({
      headers: {
        "X-Subscription-Token": token,
        Accept: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Brave request failed: ${response.status}`);
  }

  const payload = (await response.json()) as BraveApiResponse;
  const docs = payload.web?.results ?? [];

  return docs.slice(0, 3).map((doc) => ({
    key: "newsSignal",
    value: `${doc.title} ${doc.description ?? ""}`.trim(),
    source: doc.url,
    tier: 2,
    sourceDate: todayIsoDate(),
    category: "news"
  }));
}
