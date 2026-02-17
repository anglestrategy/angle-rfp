const INVALID_MODEL_ALIASES = new Set([
  "claude-sonnet-4-5-latest",
  "claude-haiku-4-5-latest"
]);

export const DEFAULT_GEMINI_FLASH_MODEL = "gemini-2.5-flash";
// Backward-compatible aliases while legacy names are still referenced.
export const DEFAULT_CLAUDE_SONNET_MODEL = DEFAULT_GEMINI_FLASH_MODEL;
export const DEFAULT_CLAUDE_HAIKU_MODEL = DEFAULT_GEMINI_FLASH_MODEL;

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

function warnInvalidModel(envVar: string, value: string, fallback: string): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "invalid_model_override",
      envVar,
      providedValue: value,
      fallbackModel: fallback
    })
  );
}

function resolveModelFromEnv(
  candidates: Array<{ envVar: string; value: string | undefined }>,
  fallback: string
): string {
  for (const candidate of candidates) {
    const value = normalizedEnvValue(candidate.value);
    if (!value) {
      continue;
    }

    if (INVALID_MODEL_ALIASES.has(value)) {
      warnInvalidModel(candidate.envVar, value, fallback);
      continue;
    }

    return value;
  }

  return fallback;
}

export function resolveGeminiFlashModel(): string {
  return resolveModelFromEnv(
    [
      { envVar: "GEMINI_MODEL_FLASH", value: process.env.GEMINI_MODEL_FLASH },
      { envVar: "GOOGLE_MODEL_FLASH", value: process.env.GOOGLE_MODEL_FLASH },
      { envVar: "GOOGLE_GENERATIVE_AI_MODEL", value: process.env.GOOGLE_GENERATIVE_AI_MODEL },
      // Soft backward-compatibility with previous envs if users copied model string there.
      { envVar: "CLAUDE_MODEL_SONNET", value: process.env.CLAUDE_MODEL_SONNET },
      { envVar: "CLAUDE_MODEL_HAIKU", value: process.env.CLAUDE_MODEL_HAIKU },
      { envVar: "CLAUDE_MODEL", value: process.env.CLAUDE_MODEL }
    ],
    DEFAULT_GEMINI_FLASH_MODEL
  );
}

// Backward-compatible resolver aliases.
export function resolveClaudeSonnetModel(): string {
  return resolveGeminiFlashModel();
}

export function resolveClaudeHaikuModel(): string {
  return resolveGeminiFlashModel();
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

export function getGeminiFlashModelCandidates(): string[] {
  return dedupe([
    resolveGeminiFlashModel(),
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite"
  ]);
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
  return status === 404 && (
    errorType === "not_found_error" ||
    /not_found_error|model:|models?\/|not found/i.test(message)
  );
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
  const looksLikeMissingModel = status === 404 && /not_found_error|model:/i.test(message);

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
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "model_not_found",
            model,
            attempted,
            envVars
          })
        );
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
