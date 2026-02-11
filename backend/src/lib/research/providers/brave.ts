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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queryBrave(
  query: string,
  fetchFn: typeof fetch = fetch,
  maxRetries = 3
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

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchFn(url, {
        headers: {
          "X-Subscription-Token": token,
          Accept: "application/json"
        }
      });

      if (response.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`Brave API rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Retry on network errors with exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 500;
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Brave request failed after retries");
}
