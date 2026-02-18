import { ImageAnnotatorClient } from "@google-cloud/vision";

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

function summarizeVisionApiError(status: number, details: string): string {
  const compactDetails = details.replace(/\s+/g, " ").trim();
  const lowered = compactDetails.toLowerCase();

  if (status === 403 && /vision api has not been used|it is disabled|enable.*vision\.googleapis\.com/.test(lowered)) {
    return "Google Vision API is disabled for the configured project. Enable vision.googleapis.com and retry.";
  }

  if (status === 401) {
    return "Google Vision API key is invalid or unauthorized for this project.";
  }

  if (status === 429) {
    return "Google Vision API rate limit exceeded.";
  }

  if (compactDetails.length === 0) {
    return `Google Vision REST request failed (${status}).`;
  }

  return `Google Vision REST request failed (${status}): ${compactDetails.slice(0, 180)}`;
}

function hasGoogleVisionCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.GOOGLE_VISION_API_KEY?.trim()
  );
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function clipWarning(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
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

class GoogleVisionOcrProvider implements OcrProvider {
  private readonly clientMode: "adc_client" | "api_key_rest";
  private readonly fallbackMode: "adc_client" | "api_key_rest" | null;
  private readonly modeWarning: string | null;
  private client: ImageAnnotatorClient | null;
  private readonly apiKey: string | null;
  private readonly hasAdcCredentials: boolean;
  private readonly requestTimeoutMs: number;
  private readonly pdfPageLimit: number;

  constructor() {
    const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim() || null;
    const hasAdcCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
    const authMode = (process.env.GOOGLE_VISION_AUTH_MODE ?? "auto").trim().toLowerCase();
    let clientMode: "adc_client" | "api_key_rest";
    let fallbackMode: "adc_client" | "api_key_rest" | null = null;
    let modeWarning: string | null = null;

    this.apiKey = apiKey;
    this.hasAdcCredentials = hasAdcCredentials;
    this.client = null;

    if (authMode === "api_key") {
      if (apiKey) {
        clientMode = "api_key_rest";
        fallbackMode = hasAdcCredentials ? "adc_client" : null;
      } else if (hasAdcCredentials) {
        clientMode = "adc_client";
        modeWarning =
          "GOOGLE_VISION_AUTH_MODE=api_key is set but GOOGLE_VISION_API_KEY is missing; falling back to ADC.";
      } else {
        clientMode = "api_key_rest";
        modeWarning =
          "GOOGLE_VISION_AUTH_MODE=api_key is set but GOOGLE_VISION_API_KEY is missing.";
      }
    } else if (authMode === "adc") {
      if (hasAdcCredentials) {
        clientMode = "adc_client";
        fallbackMode = apiKey ? "api_key_rest" : null;
      } else if (apiKey) {
        clientMode = "api_key_rest";
        modeWarning =
          "GOOGLE_VISION_AUTH_MODE=adc is set but GOOGLE_APPLICATION_CREDENTIALS is missing; falling back to API key mode.";
      } else {
        clientMode = "adc_client";
        modeWarning =
          "GOOGLE_VISION_AUTH_MODE=adc is set but GOOGLE_APPLICATION_CREDENTIALS is missing.";
      }
    } else if (apiKey) {
      // Prefer API key mode in auto mode to avoid ADC metadata/default-credential churn.
      clientMode = "api_key_rest";
      fallbackMode = hasAdcCredentials ? "adc_client" : null;
    } else {
      clientMode = "adc_client";
    }

    this.clientMode = clientMode;
    this.fallbackMode = fallbackMode;
    this.modeWarning = modeWarning;
    this.requestTimeoutMs = parsePositiveInt(process.env.GOOGLE_VISION_TIMEOUT_MS, 45_000);
    this.pdfPageLimit = Math.max(
      1,
      Math.min(20, parsePositiveInt(process.env.GOOGLE_VISION_PDF_PAGE_LIMIT, 5))
    );
  }

  private getClient(): ImageAnnotatorClient {
    if (!this.client) {
      this.client = new ImageAnnotatorClient();
    }
    return this.client;
  }

  private isPdfInput(input: { fileBytes: Buffer; fileName: string }): boolean {
    const lowerName = input.fileName.toLowerCase();
    const header = input.fileBytes.subarray(0, 4).toString("latin1");
    return lowerName.endsWith(".pdf") || header === "%PDF";
  }

  private async performPdfOcrWithAdcClient(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    const pageCountHint = Math.max(1, input.pagesHint);
    const pagesToProcess = Math.min(pageCountHint, this.pdfPageLimit);
    const pageNumbers = Array.from({ length: pagesToProcess }, (_, index) => index + 1);

    const [result] = await this.getClient().batchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            content: input.fileBytes.toString("base64"),
            mimeType: "application/pdf"
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" as const }],
          pages: pageNumbers
        }
      ]
    });

    const pageResponses = (result.responses?.[0]?.responses ?? []).flatMap((response) => {
      const text = response.fullTextAnnotation?.text?.trim();
      return text ? [text] : [];
    });

    const text = pageResponses.join("\n\n").trim();
    if (!text) {
      return {
        text: "",
        pagesOcred: 0,
        warnings: [
          `Google Vision returned no OCR text for ${input.fileName}.`
        ]
      };
    }

    const warnings: string[] = [
      `OCR completed with Google Cloud Vision for ${input.fileName}.`
    ];
    if (pageCountHint > pagesToProcess) {
      warnings.push(
        `Google Vision processed ${pagesToProcess}/${pageCountHint} pages (configured limit ${this.pdfPageLimit}).`
      );
    }

    return {
      text,
      pagesOcred: pagesToProcess,
      warnings
    };
  }

  private async performImageOcrWithAdcClient(input: {
    fileBytes: Buffer;
    fileName: string;
  }): Promise<OcrResult> {
    const [result] = await this.getClient().documentTextDetection({
      image: { content: input.fileBytes.toString("base64") },
      imageContext: { languageHints: ["en", "ar"] }
    });

    const text = result.fullTextAnnotation?.text?.trim() ?? "";
    if (!text) {
      return {
        text: "",
        pagesOcred: 0,
        warnings: [`Google Vision returned no OCR text for ${input.fileName}.`]
      };
    }

    return {
      text,
      pagesOcred: 1,
      warnings: [`OCR completed with Google Cloud Vision for ${input.fileName}.`]
    };
  }

  private async callVisionApiWithKey(endpoint: "files:annotate" | "images:annotate", body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      throw new Error("GOOGLE_VISION_API_KEY is missing for key-based OCR mode.");
    }

    const url = `https://vision.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: withTimeoutSignal(this.requestTimeoutMs)
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(summarizeVisionApiError(response.status, details));
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private extractPdfTextsFromKeyResponse(payload: Record<string, unknown>): string[] {
    const topLevelResponses = Array.isArray(payload.responses) ? payload.responses : [];
    const fileResponse = (topLevelResponses[0] ?? {}) as Record<string, unknown>;
    const pageResponses = Array.isArray(fileResponse.responses) ? fileResponse.responses : [];

    return pageResponses.flatMap((entry) => {
      const page = entry as Record<string, unknown>;
      const fullTextAnnotation = page.fullTextAnnotation as { text?: string } | undefined;
      const text = fullTextAnnotation?.text?.trim();
      return text ? [text] : [];
    });
  }

  private extractImageTextsFromKeyResponse(payload: Record<string, unknown>): string[] {
    const topLevelResponses = Array.isArray(payload.responses) ? payload.responses : [];
    return topLevelResponses.flatMap((entry) => {
      const responseItem = entry as Record<string, unknown>;
      const fullTextAnnotation = responseItem.fullTextAnnotation as { text?: string } | undefined;
      const text = fullTextAnnotation?.text?.trim();
      return text ? [text] : [];
    });
  }

  private async performPdfOcrWithApiKey(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    const pageCountHint = Math.max(1, input.pagesHint);
    const pagesToProcess = Math.min(pageCountHint, this.pdfPageLimit);
    const pageNumbers = Array.from({ length: pagesToProcess }, (_, index) => index + 1);
    const payload = await this.callVisionApiWithKey("files:annotate", {
      requests: [
        {
          inputConfig: {
            mimeType: "application/pdf",
            content: input.fileBytes.toString("base64")
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: pageNumbers
        }
      ]
    });

    const textSegments = this.extractPdfTextsFromKeyResponse(payload);
    const text = textSegments.join("\n\n").trim();
    if (!text) {
      return {
        text: "",
        pagesOcred: 0,
        warnings: [
          `Google Vision returned no OCR text for ${input.fileName} in API-key mode.`
        ]
      };
    }

    const warnings = [`OCR completed with Google Vision REST API for ${input.fileName}.`];
    if (pageCountHint > pagesToProcess) {
      warnings.push(
        `Google Vision processed ${pagesToProcess}/${pageCountHint} pages (configured limit ${this.pdfPageLimit}).`
      );
    }

    return {
      text,
      pagesOcred: pagesToProcess,
      warnings
    };
  }

  private async performImageOcrWithApiKey(input: {
    fileBytes: Buffer;
    fileName: string;
  }): Promise<OcrResult> {
    const payload = await this.callVisionApiWithKey("images:annotate", {
      requests: [
        {
          image: { content: input.fileBytes.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["en", "ar"] }
        }
      ]
    });

    const textSegments = this.extractImageTextsFromKeyResponse(payload);
    const text = textSegments.join("\n\n").trim();
    if (!text) {
      return {
        text: "",
        pagesOcred: 0,
        warnings: [
          `Google Vision returned no OCR text for ${input.fileName} in API-key mode.`
        ]
      };
    }

    return {
      text,
      pagesOcred: 1,
      warnings: [`OCR completed with Google Vision REST API for ${input.fileName}.`]
    };
  }

  async performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    const attemptedModes: Array<"adc_client" | "api_key_rest"> = [];
    const errors: string[] = [];

    const runMode = async (mode: "adc_client" | "api_key_rest"): Promise<OcrResult> => {
      attemptedModes.push(mode);
      if (mode === "api_key_rest") {
        if (this.isPdfInput(input)) {
          return this.performPdfOcrWithApiKey(input);
        }
        return this.performImageOcrWithApiKey(input);
      }

      if (this.isPdfInput(input)) {
        return this.performPdfOcrWithAdcClient(input);
      }
      return this.performImageOcrWithAdcClient(input);
    };

    const normalizeVisionError = (error: unknown): string => {
      const message = errorMessage(error);
      if (/could not load the default credentials/i.test(message)) {
        return "Google Vision default credentials were not found. Set GOOGLE_APPLICATION_CREDENTIALS or use GOOGLE_VISION_API_KEY.";
      }
      return message;
    };

    try {
      const primary = await runMode(this.clientMode);
      if (this.modeWarning) {
        primary.warnings = [this.modeWarning, ...primary.warnings];
      }
      return primary;
    } catch (error: unknown) {
      errors.push(normalizeVisionError(error));
    }

    if (this.fallbackMode && !attemptedModes.includes(this.fallbackMode)) {
      try {
        const fallback = await runMode(this.fallbackMode);
        const fallbackLabel = this.fallbackMode === "api_key_rest" ? "API key mode" : "ADC mode";
        fallback.warnings = [
          ...(this.modeWarning ? [this.modeWarning] : []),
          `Google Vision OCR recovered via ${fallbackLabel} fallback.`,
          ...fallback.warnings
        ];
        return fallback;
      } catch (error: unknown) {
        errors.push(normalizeVisionError(error));
      }
    }

    const modeHint = (() => {
      if (this.clientMode === "adc_client" && !this.hasAdcCredentials && this.apiKey) {
        return " ADC credentials were unavailable; set GOOGLE_APPLICATION_CREDENTIALS or use GOOGLE_VISION_AUTH_MODE=api_key.";
      }
      if (this.clientMode === "api_key_rest" && !this.apiKey && this.hasAdcCredentials) {
        return " API key was unavailable; set GOOGLE_VISION_API_KEY or use GOOGLE_VISION_AUTH_MODE=adc.";
      }
      return "";
    })();

    return {
      text: "",
      pagesOcred: 0,
      warnings: [
        `Google Vision OCR failed for ${input.fileName}: ${clipWarning(errors.join(" | ") || "Unknown OCR error.", 260)}${modeHint}`
      ]
    };
  }
}

class NoopOcrProvider implements OcrProvider {
  async performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    return {
      text: "",
      pagesOcred: 0,
      warnings: [`[ocr_unavailable] OCR fallback requested for ${input.fileName}, but no OCR provider is configured.`]
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

  if (hasGoogleVisionCredentials()) {
    return new GoogleVisionOcrProvider();
  }

  return new NoopOcrProvider();
}
