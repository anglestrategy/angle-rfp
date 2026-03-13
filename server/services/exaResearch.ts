interface ExaSearchResult {
  title?: string;
  url?: string;
  publishedDate?: string;
  text?: string;
  author?: string;
}

interface ExaSearchResponse {
  results?: ExaSearchResult[];
}

export interface ExaClientResearchResult {
  sources: Array<{
    title: string;
    url: string;
    retrievedAt: string;
    evidenceTier: "external";
  }>;
  notes: string[];
}

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const BLOCKED_HOST_PATTERNS = [
  /linkedin\.com$/i,
  /facebook\.com$/i,
  /instagram\.com$/i,
  /x\.com$/i,
  /twitter\.com$/i,
  /youtube\.com$/i,
];

function truncate(text: string, max = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function safeHostname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isUsefulHost(hostname: string | null): boolean {
  if (!hostname) return false;
  return !BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

async function searchExa(query: string, numResults = 3): Promise<ExaSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return [];

  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults,
      contents: {
        text: {
          maxCharacters: 1200,
        },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Exa search failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as ExaSearchResponse;
  return Array.isArray(payload.results) ? payload.results : [];
}

export async function performExaClientResearch(input: {
  clientName?: string | null;
  projectTitle?: string | null;
  industry?: string | null;
}): Promise<ExaClientResearchResult> {
  const clientName =
    typeof input.clientName === "string" && input.clientName.trim()
      ? input.clientName.trim()
      : null;
  const projectTitle =
    typeof input.projectTitle === "string" && input.projectTitle.trim()
      ? input.projectTitle.trim()
      : null;
  const industry =
    typeof input.industry === "string" && input.industry.trim()
      ? input.industry.trim()
      : null;

  if (!process.env.EXA_API_KEY || !clientName) {
    return { sources: [], notes: [] };
  }

  const queries = [
    `${clientName} official website`,
    [clientName, industry, projectTitle, "organization profile"]
      .filter(Boolean)
      .join(" "),
  ];

  const retrievedAt = new Date().toISOString();
  const uniqueByUrl = new Map<string, ExaSearchResult>();

  for (const query of queries) {
    const results = await searchExa(query, 3);
    for (const result of results) {
      if (!result.url || !result.title) continue;
      if (!uniqueByUrl.has(result.url)) {
        uniqueByUrl.set(result.url, result);
      }
    }
  }

  const filtered = Array.from(uniqueByUrl.values())
    .filter((result) => isUsefulHost(safeHostname(result.url || "")))
    .slice(0, 5);

  const sources = filtered.map((result) => ({
    title: result.title || "External source",
    url: result.url || "",
    retrievedAt,
    evidenceTier: "external" as const,
  }));

  const notes = filtered.slice(0, 3).map((result, index) => {
    const host = safeHostname(result.url || "");
    const summary = result.text ? truncate(result.text) : "No excerpt available.";
    return `External source ${index + 1}: ${result.title}${host ? ` (${host})` : ""}. ${summary}`;
  });

  return {
    sources,
    notes,
  };
}
