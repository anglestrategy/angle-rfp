const INVALID_MODEL_ALIASES = new Set([
  "claude-sonnet-4-5-latest",
  "claude-haiku-4-5-latest"
]);

export const DEFAULT_CLAUDE_SONNET_MODEL = "claude-3-5-sonnet-20241022";
export const DEFAULT_CLAUDE_HAIKU_MODEL = "claude-3-5-haiku-20241022";

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
      event: "invalid_claude_model_override",
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

export function resolveClaudeSonnetModel(): string {
  return resolveModelFromEnv(
    [
      { envVar: "CLAUDE_MODEL_SONNET", value: process.env.CLAUDE_MODEL_SONNET },
      // Backward compatibility: legacy generic model env var maps to sonnet.
      { envVar: "CLAUDE_MODEL", value: process.env.CLAUDE_MODEL }
    ],
    DEFAULT_CLAUDE_SONNET_MODEL
  );
}

export function resolveClaudeHaikuModel(): string {
  return resolveModelFromEnv(
    [{ envVar: "CLAUDE_MODEL_HAIKU", value: process.env.CLAUDE_MODEL_HAIKU }],
    DEFAULT_CLAUDE_HAIKU_MODEL
  );
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

export function normalizeAnthropicError(
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
      `Anthropic model '${context.model}' is not available. Check ${context.envVars.join(", ")}.${requestIdSuffix} Upstream: ${message}`
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(message);
}
