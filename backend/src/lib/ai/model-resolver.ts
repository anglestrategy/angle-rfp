const INVALID_MODEL_ALIASES = new Set([
  "claude-sonnet-4-5-latest",
  "claude-haiku-4-5-latest"
]);

export const DEFAULT_GEMINI_FLASH_MODEL = "gemini-2.5-flash";
// Backward-compatible aliases while legacy names are still referenced.
export const DEFAULT_CLAUDE_SONNET_MODEL = DEFAULT_GEMINI_FLASH_MODEL;
export const DEFAULT_CLAUDE_HAIKU_MODEL = DEFAULT_GEMINI_FLASH_MODEL;

const GEMINI_MODEL_ALLOWLIST = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
]);

const GEMINI_MODEL_ALIAS_MAP: Record<string, string> = {
  "gemini-3-flash": "gemini-2.5-flash",
  "gemini-3.0-flash": "gemini-2.5-flash",
  "gemini3flash": "gemini-2.5-flash",
  "gemini-2.5": "gemini-2.5-flash",
  "gemini-2.5-latest": "gemini-2.5-flash",
  "gemini-2.5-flash-latest": "gemini-2.5-flash",
  "gemini-2.0-flash-latest": "gemini-2.0-flash",
  "gemini-1.5-flash-latest": "gemini-1.5-flash",
  "gemini-flash": "gemini-2.5-flash"
};

const FALLBACK_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro"
];

function getGeminiModelEnvCandidates(): Array<{ envVar: string; value: string | undefined }> {
  return [
    { envVar: "GEMINI_MODEL_FLASH", value: process.env.GEMINI_MODEL_FLASH },
    { envVar: "GOOGLE_MODEL_FLASH", value: process.env.GOOGLE_MODEL_FLASH },
    { envVar: "GOOGLE_GENERATIVE_AI_MODEL", value: process.env.GOOGLE_GENERATIVE_AI_MODEL },
    // Soft backward-compatibility with previous envs if users copied model string there.
    { envVar: "CLAUDE_MODEL_SONNET", value: process.env.CLAUDE_MODEL_SONNET },
    { envVar: "CLAUDE_MODEL_HAIKU", value: process.env.CLAUDE_MODEL_HAIKU },
    { envVar: "CLAUDE_MODEL", value: process.env.CLAUDE_MODEL }
  ];
}

const emittedWarnings = new Set<string>();

export interface GeminiModelResolutionDiagnostics {
  resolvedModel: string;
  sourceEnvVar: string | null;
  candidates: string[];
  warnings: string[];
  apiKeyConfigured: boolean;
}

export function resolveGoogleApiKey(): string | null {
  const candidates = [
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ];

  for (const candidate of candidates) {
    const normalized = normalizedEnvValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizedEnvValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emitWarning(payload: {
  event: string;
  warningCode: string;
  envVar?: string;
  providedValue?: string;
  resolvedValue?: string;
  fallbackModel?: string;
  message: string;
}): void {
  const key = `${payload.warningCode}|${payload.envVar ?? ""}|${payload.providedValue ?? ""}|${payload.resolvedValue ?? ""}`;
  if (emittedWarnings.has(key)) {
    return;
  }
  emittedWarnings.add(key);
  console.warn(
    JSON.stringify({
      level: "warn",
      ...payload
    })
  );
}

function normalizeGeminiModelValue(rawValue: string): {
  normalized: string | null;
  warning: string | null;
} {
  let value = rawValue.trim().toLowerCase();
  value = value.replace(/^["'`]+|["'`]+$/g, "");
  if (!value) {
    return { normalized: null, warning: "Empty model value after trimming." };
  }

  // If a list was pasted, keep only the first token and warn.
  if (value.includes(",")) {
    value = value.split(",")[0]?.trim() ?? value;
    if (!value) {
      return {
        normalized: null,
        warning: "Model override contained a list but no usable first value."
      };
    }
  }

  if (value.includes("/models/")) {
    value = value.slice(value.lastIndexOf("/models/") + "/models/".length);
  }
  if (value.startsWith("models/")) {
    value = value.slice("models/".length);
  }
  if (value.startsWith("model=") || value.startsWith("model:")) {
    value = value.slice("model=".length).replace(/^:/, "");
  }
  if (value.startsWith("google/")) {
    value = value.slice("google/".length);
  }
  if (value.includes("gemini-")) {
    const inlineModelMatch = value.match(/gemini-[a-z0-9.\-]+/i);
    if (inlineModelMatch?.[0]) {
      value = inlineModelMatch[0].toLowerCase();
    }
  }
  value = value.split("?")[0] ?? value;
  value = value.split(":")[0] ?? value;
  value = value.split(/[|]/)[0] ?? value;
  value = value.replace(/[_\s]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  value = value.replace(/[^a-z0-9.\-]/g, "");

  if (INVALID_MODEL_ALIASES.has(value)) {
    return {
      normalized: null,
      warning: "Deprecated Claude alias is not valid for Gemini extraction."
    };
  }

  const mapped = GEMINI_MODEL_ALIAS_MAP[value] ?? value;
  if (!GEMINI_MODEL_ALLOWLIST.has(mapped)) {
    return {
      normalized: null,
      warning: `Unsupported Gemini model '${value}'.`
    };
  }

  if (mapped !== value) {
    return {
      normalized: mapped,
      warning: `Mapped unsupported alias '${value}' to '${mapped}'.`
    };
  }

  return {
    normalized: mapped,
    warning: null
  };
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

export function getGeminiModelResolutionDiagnostics(): GeminiModelResolutionDiagnostics {
  const warnings: string[] = [];
  let selectedModel: string | null = null;
  let sourceEnvVar: string | null = null;
  const envCandidates = getGeminiModelEnvCandidates();

  for (const candidate of envCandidates) {
    const raw = normalizedEnvValue(candidate.value);
    if (!raw) {
      continue;
    }
    const normalized = normalizeGeminiModelValue(raw);
    if (normalized.warning) {
      warnings.push(`${candidate.envVar}: ${normalized.warning}`);
      emitWarning({
        event: "model_resolution_warning",
        warningCode: "model_invalid_format",
        envVar: candidate.envVar,
        providedValue: raw,
        resolvedValue: normalized.normalized ?? undefined,
        fallbackModel: DEFAULT_GEMINI_FLASH_MODEL,
        message: normalized.warning
      });
    }
    if (!normalized.normalized) {
      continue;
    }
    selectedModel = normalized.normalized;
    sourceEnvVar = candidate.envVar;
    break;
  }

  const resolvedModel = selectedModel ?? DEFAULT_GEMINI_FLASH_MODEL;
  if (!selectedModel) {
    warnings.push(`No valid model override found. Using default '${DEFAULT_GEMINI_FLASH_MODEL}'.`);
  }
  const baseCandidates = dedupe([
    resolvedModel,
    ...FALLBACK_GEMINI_MODELS
  ]).filter((model) => GEMINI_MODEL_ALLOWLIST.has(model));

  if (baseCandidates.length === 0) {
    baseCandidates.push(DEFAULT_GEMINI_FLASH_MODEL);
  }

  // AI SDK Google provider expects plain model IDs (it prefixes models/ internally).
  const candidates = dedupe(baseCandidates);

  return {
    resolvedModel,
    sourceEnvVar,
    candidates,
    warnings,
    apiKeyConfigured: Boolean(resolveGoogleApiKey())
  };
}

export function resolveGeminiFlashModel(): string {
  return getGeminiModelResolutionDiagnostics().resolvedModel;
}

// Backward-compatible resolver aliases.
export function resolveClaudeSonnetModel(): string {
  return resolveGeminiFlashModel();
}

export function resolveClaudeHaikuModel(): string {
  return resolveGeminiFlashModel();
}

export function getGeminiFlashModelCandidates(): string[] {
  return getGeminiModelResolutionDiagnostics().candidates;
}

export function getClaudeSonnetModelCandidates(): string[] {
  return getGeminiFlashModelCandidates();
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const object = asObject(error);
  if (!object) {
    return String(error);
  }

  const directMessage = object.message;
  if (typeof directMessage === "string" && directMessage.length > 0) {
    return directMessage;
  }

  const nestedError = asObject(object.error);
  if (nestedError) {
    const nestedMessage = nestedError.message;
    if (typeof nestedMessage === "string" && nestedMessage.length > 0) {
      return nestedMessage;
    }
  }

  return String(error);
}

function extractStatus(error: unknown): number | null {
  const object = asObject(error);
  if (!object) {
    return null;
  }

  const status = object.status;
  return typeof status === "number" ? status : null;
}

function extractRequestId(error: unknown): string | null {
  const object = asObject(error);
  if (!object) {
    return null;
  }

  const requestId = object.requestID ?? object.request_id;
  return typeof requestId === "string" && requestId.length > 0 ? requestId : null;
}

function extractErrorType(error: unknown): string | null {
  const object = asObject(error);
  if (!object) {
    return null;
  }

  const nestedError = asObject(object.error);
  if (!nestedError) {
    return null;
  }

  const type = nestedError.type;
  return typeof type === "string" ? type : null;
}

function isModelNotFoundError(error: unknown): boolean {
  const status = extractStatus(error);
  const message = extractMessage(error);
  const errorType = extractErrorType(error);
  const modelUnavailableByStatus =
    status === 404 &&
    (
      errorType === "not_found_error" ||
      /not_found_error|model:|models?\/|not found/i.test(message)
    );

  // Google SDK sometimes surfaces unsupported-model errors without a strict 404 status.
  const modelUnavailableByMessage =
    /models?\/.+not found|is not found for api version|not supported for generatecontent|unsupported model|unexpected model name format/i.test(
      message
    );

  return modelUnavailableByStatus || modelUnavailableByMessage;
}

export function normalizeModelError(
  error: unknown,
  context: {
    model: string;
    envVars: string[];
  }
): Error {
  const status = extractStatus(error);
  const message = extractMessage(error);
  const requestId = extractRequestId(error);
  const looksLikeMissingModel =
    (status === 404 && /not_found_error|model:/i.test(message)) ||
    /models?\/.+not found|is not found for api version|not supported for generatecontent|unsupported model|unexpected model name format/i.test(
      message
    );

  if (looksLikeMissingModel) {
    const requestIdSuffix = requestId ? ` request_id=${requestId}.` : "";
    return new Error(
      `AI model '${context.model}' is not available. Check ${context.envVars.join(", ")}.${requestIdSuffix} Upstream: ${message}`
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(message);
}

export function normalizeAnthropicError(
  error: unknown,
  context: {
    model: string;
    envVars: string[];
  }
): Error {
  return normalizeModelError(error, context);
}

async function runWithModelFallback<T>(
  models: string[],
  envVars: string[],
  run: (model: string) => Promise<T>
): Promise<T> {
  const attempted: string[] = [];
  let lastModelNotFoundError: unknown;

  for (const model of models) {
    attempted.push(model);
    try {
      return await run(model);
    } catch (error: unknown) {
      if (isModelNotFoundError(error)) {
        lastModelNotFoundError = error;
        const message = extractMessage(error);
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "model_not_found",
            model,
            attempted,
            envVars,
            reason: message.slice(0, 220)
          })
        );
        console.warn(`[ModelResolver] Candidate model '${model}' unavailable, trying next candidate.`);
        continue;
      }

      throw normalizeModelError(error, {
        model,
        envVars
      });
    }
  }

  const normalized = normalizeModelError(lastModelNotFoundError, {
    model: attempted[attempted.length - 1] ?? "unknown",
    envVars
  });
  throw new Error(
    `${normalized.message} Tried models: ${attempted.join(", ")}.`
  );
}

export async function runWithGeminiFlashModel<T>(run: (model: string) => Promise<T>): Promise<T> {
  return runWithModelFallback(
    getGeminiFlashModelCandidates(),
    ["GEMINI_MODEL_FLASH", "GOOGLE_MODEL_FLASH", "GOOGLE_GENERATIVE_AI_MODEL"],
    run
  );
}

// Backward-compatible wrappers so existing imports keep working while we migrate callsites.
export async function runWithClaudeSonnetModel<T>(run: (model: string) => Promise<T>): Promise<T> {
  return runWithGeminiFlashModel(run);
}

export async function runWithClaudeHaikuModel<T>(run: (model: string) => Promise<T>): Promise<T> {
  return runWithGeminiFlashModel(run);
}
