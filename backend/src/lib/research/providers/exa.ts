import type { ProviderDocument } from "@/lib/research/providers/brave";
import { fetchWithRetry } from "@/lib/ops/retriable-fetch";

interface ExaSearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    text?: string;
    highlights?: string[];
    publishedDate?: string;
  }>;
}

type ExaResultItem = NonNullable<ExaSearchResponse["results"]>[number];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDateOrToday(value: string | undefined): string {
  if (!value) {
    return todayIsoDate();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return todayIsoDate();
  }

  return parsed.toISOString().slice(0, 10);
}

function buildValue(item: ExaResultItem): string {
  const highlights = (item.highlights ?? []).join(" ").trim();
  const text = (item.text ?? "").slice(0, 600).trim();
  return `${item.title ?? ""} ${highlights || text}`.replace(/\s+/g, " ").trim();
}

export async function queryExa(
  query: string,
  fetchFn: typeof fetch = fetch
): Promise<ProviderDocument[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return [
      {
        key: "marketSignal",
        value: "UNKNOWN",
        source: "Exa (key missing)",
        tier: 3,
        sourceDate: todayIsoDate(),
        category: "news"
      }
    ];
  }

  const response = await fetchWithRetry({
    url: "https://api.exa.ai/search",
    operationName: "Exa search",
    fetchFn,
    timeoutMs: 15_000,
    maxAttempts: 3,
    baseDelayMs: 600,
    maxDelayMs: 4_000,
    retryOnStatusCodes: [408, 425, 429, 500, 502, 503, 504],
    buildInit: () => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        contents: {
          text: true,
          highlights: {
            numSentences: 2
          }
        }
      })
    })
  });

  if (!response.ok) {
    throw new Error(`Exa request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ExaSearchResponse;
  const results = payload.results ?? [];

  return results
    .slice(0, 3)
    .map((item) => ({
      key: "marketSignal",
      value: buildValue(item),
      source: item.url ?? "exa",
      tier: 2 as const,
      sourceDate: toIsoDateOrToday(item.publishedDate),
      category: "news" as const
    }))
    .filter((item) => item.value.length > 0);
}
