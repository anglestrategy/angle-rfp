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
  fetchFn: typeof fetch = fetch
): Promise<ProviderDocument[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) {
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

  const response = await fetchFn(url, {
    headers: {
      "X-Subscription-Token": token,
      Accept: "application/json"
    }
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
