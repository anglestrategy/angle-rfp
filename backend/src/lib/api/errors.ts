export const ERROR_CODES = [
  "validation_error",
  "auth_failed",
  "rate_limited",
  "timeout",
  "upstream_rate_limited",
  "upstream_unavailable",
  "schema_validation_failed",
  "unsupported_format",
  "file_too_large",
  "partial_result",
  "server_misconfigured",
  "internal_error"
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorShape {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  stage: string;
  details: Record<string, unknown>;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly shape: ApiErrorShape;

  constructor(statusCode: number, shape: ApiErrorShape) {
    super(shape.message);
    this.statusCode = statusCode;
    this.shape = shape;
  }
}

export function makeError(
  statusCode: number,
  code: ErrorCode,
  message: string,
  stage: string,
  options?: {
    retryable?: boolean;
    details?: Record<string, unknown>;
  }
): ApiError {
  return new ApiError(statusCode, {
    code,
    message,
    retryable: options?.retryable ?? false,
    stage,
    details: options?.details ?? {}
  });
}

export function normalizeUnknownError(error: unknown, stage: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return makeError(500, "internal_error", error.message, stage, {
      retryable: true
    });
  }

  return makeError(500, "internal_error", "Unexpected error", stage, {
    retryable: true,
    details: { raw: String(error) }
  });
}
