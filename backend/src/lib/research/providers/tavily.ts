import type { ProviderDocument } from "@/lib/research/providers/brave";

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

  const response = await fetchFn("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5
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
