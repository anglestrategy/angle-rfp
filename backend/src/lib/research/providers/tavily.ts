import type { ProviderDocument } from "@/lib/research/providers/brave";
import { fetchWithRetry } from "@/lib/ops/retriable-fetch";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function queryTavily(
  query: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderDocument[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return [
      {
        key: "companySize",
        value: "UNKNOWN",
        source: "Tavily (key missing)",
        tier: 3,
        sourceDate: todayIsoDate(),
        category: "financial"
      }
    ];
  }

  const response = await fetchWithRetry({
    url: "https://api.tavily.com/search",
    operationName: "Tavily search",
    fetchFn,
    timeoutMs: 15_000,
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 4_000,
    retryOnStatusCodes: [408, 425, 429, 500, 502, 503, 504],
    buildInit: () => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5
      })
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; content?: string; url?: string }>;
  };

  const items = payload.results ?? [];
  return items.slice(0, 3).map((item) => ({
    key: "marketSignal",
    value: `${item.title ?? ""} ${item.content ?? ""}`.trim(),
    source: item.url ?? "tavily",
    tier: 2,
    sourceDate: todayIsoDate(),
    category: "financial"
  }));
}
