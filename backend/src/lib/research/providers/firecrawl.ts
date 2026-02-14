import type { ProviderDocument } from "@/lib/research/providers/brave";
import { fetchWithRetry } from "@/lib/ops/retriable-fetch";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function queryFirecrawl(
  url: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderDocument[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return [
      {
        key: "officialSignal",
        value: "UNAVAILABLE",
        source: "Firecrawl (key missing)",
        tier: 3,
        sourceDate: todayIsoDate(),
        category: "official"
      }
    ];
  }

  const response = await fetchWithRetry({
    url: "https://api.firecrawl.dev/v1/scrape",
    operationName: "Firecrawl scrape",
    fetchFn,
    timeoutMs: 20_000,
    maxAttempts: 2,
    baseDelayMs: 800,
    maxDelayMs: 5_000,
    retryOnStatusCodes: [408, 425, 429, 500, 502, 503, 504],
    buildInit: () => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ url })
    })
  });

  if (!response.ok) {
    throw new Error(`Firecrawl request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { markdown?: string; metadata?: { sourceURL?: string } };
  };

  return [
    {
      key: "officialSignal",
      value: payload.data?.markdown?.slice(0, 200) ?? "",
      source: payload.data?.metadata?.sourceURL ?? url,
      tier: 1,
      sourceDate: todayIsoDate(),
      category: "official"
    }
  ];
}
