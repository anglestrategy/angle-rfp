export interface OcrResult {
  text: string;
  pagesOcred: number;
  warnings: string[];
}

export interface OcrProvider {
  performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult>;
}

interface AzureAnalyzeResultPage {
  lines?: Array<{ content?: string }>;
}

interface AzureAnalyzeResult {
  status?: string;
  analyzeResult?: {
    content?: string;
    pages?: AzureAnalyzeResultPage[];
  };
  error?: {
    message?: string;
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

class AzureDocumentIntelligenceOcrProvider implements OcrProvider {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly submitTimeoutMs: number;
  private readonly pollTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;

  constructor(config: {
    endpoint: string;
    apiKey: string;
    apiVersion: string;
    submitTimeoutMs: number;
    pollTimeoutMs: number;
    pollIntervalMs: number;
    maxPollAttempts: number;
  }) {
    this.endpoint = trimTrailingSlash(config.endpoint);
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion;
    this.submitTimeoutMs = config.submitTimeoutMs;
    this.pollTimeoutMs = config.pollTimeoutMs;
    this.pollIntervalMs = config.pollIntervalMs;
    this.maxPollAttempts = config.maxPollAttempts;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pollResult(operationLocation: string): Promise<AzureAnalyzeResult> {
    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt += 1) {
      const response = await fetch(operationLocation, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey
        },
        signal: withTimeoutSignal(this.pollTimeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Azure OCR status request failed (${response.status})`);
      }

      const payload = (await response.json()) as AzureAnalyzeResult;
      const status = (payload.status || "").toLowerCase();

      if (status === "succeeded") {
        return payload;
      }

      if (status === "failed" || status === "partiallysucceeded") {
        const details = payload.error?.message ? `: ${payload.error.message}` : "";
        throw new Error(`Azure OCR analysis failed${details}`);
      }

      if (attempt < this.maxPollAttempts) {
        await this.sleep(this.pollIntervalMs);
      }
    }

    throw new Error("Azure OCR polling timed out");
  }

  async performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    const analyzeUrl = `${this.endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=${encodeURIComponent(this.apiVersion)}`;

    try {
      const submitResponse = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          "Content-Type": "application/octet-stream"
        },
        body: new Uint8Array(input.fileBytes),
        signal: withTimeoutSignal(this.submitTimeoutMs)
      });

      if (!submitResponse.ok) {
        const details = await submitResponse.text().catch(() => "");
        throw new Error(`Azure OCR submit failed (${submitResponse.status})${details ? `: ${details.slice(0, 300)}` : ""}`);
      }

      const operationLocation =
        submitResponse.headers.get("operation-location") ??
        submitResponse.headers.get("Operation-Location");
      if (!operationLocation) {
        throw new Error("Azure OCR submit response missing operation-location");
      }

      const result = await this.pollResult(operationLocation);
      const content = result.analyzeResult?.content?.trim() ?? "";
      const pageCount = result.analyzeResult?.pages?.length ?? input.pagesHint;

      if (content.length < 20) {
        return {
          text: "",
          pagesOcred: pageCount,
          warnings: [
            `Azure OCR returned limited text for ${input.fileName}; local parser output retained.`
          ]
        };
      }

      return {
        text: content,
        pagesOcred: pageCount,
        warnings: [
          `OCR completed with Azure Document Intelligence for ${input.fileName}.`
        ]
      };
    } catch (error: unknown) {
      return {
        text: "",
        pagesOcred: 0,
        warnings: [`Azure OCR failed for ${input.fileName}: ${errorMessage(error)}`]
      };
    }
  }
}

class NoopOcrProvider implements OcrProvider {
  async performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    const hasGoogleKey = Boolean(process.env.GOOGLE_VISION_API_KEY);
    const warnings = hasGoogleKey
      ? [
          `[ocr_unavailable] GOOGLE_VISION_API_KEY is configured, but production OCR provider is Azure Document Intelligence. Set AZURE_DOCUMENT_INTELLIGENCE_* vars to enable OCR.`
        ]
      : [
          `[ocr_unavailable] OCR fallback requested for ${input.fileName}, but no OCR provider is configured.`
        ];

    return {
      text: "",
      pagesOcred: 0,
      warnings
    };
  }
}

export function createOcrProvider(): OcrProvider {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();
  const apiVersion = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION?.trim() || "2024-11-30";
  const submitTimeoutMs = Number(process.env.OCR_AZURE_SUBMIT_TIMEOUT_MS ?? 45_000);
  const pollTimeoutMs = Number(process.env.OCR_AZURE_POLL_TIMEOUT_MS ?? 15_000);
  const pollIntervalMs = Number(process.env.OCR_AZURE_POLL_INTERVAL_MS ?? 1_500);
  const maxPollAttempts = Number(process.env.OCR_AZURE_MAX_POLL_ATTEMPTS ?? 30);

  if (endpoint && apiKey) {
    return new AzureDocumentIntelligenceOcrProvider({
      endpoint,
      apiKey,
      apiVersion,
      submitTimeoutMs: Number.isFinite(submitTimeoutMs) ? submitTimeoutMs : 45_000,
      pollTimeoutMs: Number.isFinite(pollTimeoutMs) ? pollTimeoutMs : 15_000,
      pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 1_500,
      maxPollAttempts: Number.isFinite(maxPollAttempts) ? Math.max(5, Math.floor(maxPollAttempts)) : 30
    });
  }

  return new NoopOcrProvider();
}
