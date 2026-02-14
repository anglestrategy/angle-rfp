import { fetchWithRetry } from "@/lib/ops/retriable-fetch";

export interface UnstructuredParseResult {
  text: string;
  warnings: string[];
}

interface UnstructuredElement {
  type?: string;
  text?: string;
  metadata?: {
    page_number?: number;
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of lines) {
    const normalized = normalizeWhitespace(line);
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function toBlob(fileBytes: Buffer): Blob {
  return new Blob([new Uint8Array(fileBytes)]);
}

export async function parseWithUnstructured(input: {
  fileBytes: Buffer;
  fileName: string;
  mimeType: string;
  fetchFn?: typeof fetch;
}): Promise<UnstructuredParseResult | null> {
  const apiKey = process.env.UNSTRUCTURED_API_KEY;
  if (!apiKey) {
    return null;
  }

  const endpoint = process.env.UNSTRUCTURED_API_URL?.trim() || "https://api.unstructuredapp.io/general/v0/general";
  const fetchFn = input.fetchFn ?? fetch;

  const timeoutMs = Number(process.env.UNSTRUCTURED_TIMEOUT_MS ?? 45_000);
  const response = await fetchWithRetry({
    url: endpoint,
    operationName: "Unstructured parse",
    fetchFn,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 45_000,
    maxAttempts: 2,
    baseDelayMs: 750,
    maxDelayMs: 4_000,
    retryOnStatusCodes: [408, 425, 429, 500, 502, 503, 504],
    buildInit: () => {
      const formData = new FormData();
      formData.append("files", toBlob(input.fileBytes), input.fileName);
      formData.append("strategy", process.env.UNSTRUCTURED_STRATEGY?.trim() || "hi_res");
      formData.append("skip_infer_table_types", "false");
      formData.append("languages", "eng,ara");

      return {
        method: "POST",
        headers: {
          Accept: "application/json",
          "unstructured-api-key": apiKey
        },
        body: formData
      };
    }
  });

  if (!response.ok) {
    throw new Error(`Unstructured request failed: ${response.status}`);
  }

  const payload = (await response.json()) as UnstructuredElement[];
  const textLines = dedupeLines(payload.map((item) => item.text ?? ""));
  const text = textLines.join("\n");

  if (text.length < 40) {
    return {
      text: "",
      warnings: ["Unstructured parser returned limited text; ignored result."]
    };
  }

  return {
    text,
    warnings: ["Unstructured parser path used for high-fidelity extraction."]
  };
}
