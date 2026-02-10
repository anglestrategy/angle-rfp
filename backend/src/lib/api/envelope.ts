import { NextResponse } from "next/server";
import type { ApiError } from "@/lib/api/errors";
import type { RequestContext } from "@/lib/api/request-context";

export const SCHEMA_VERSION = "1.0.0" as const;

export interface ApiEnvelope<TData> {
  requestId: string;
  traceId: string;
  schemaVersion: typeof SCHEMA_VERSION;
  durationMs: number;
  warnings: string[];
  partialResult: boolean;
  data: TData | null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    stage: string;
    details: Record<string, unknown>;
  } | null;
}

function durationFromContext(context: RequestContext): number {
  const elapsed = Date.now() - context.startedAtMs;
  return elapsed < 0 ? 0 : elapsed;
}

export function successEnvelope<TData>(
  context: RequestContext,
  data: TData,
  options?: {
    warnings?: string[];
    partialResult?: boolean;
    status?: number;
  }
): NextResponse<ApiEnvelope<TData>> {
  const body: ApiEnvelope<TData> = {
    requestId: context.requestId,
    traceId: context.traceId,
    schemaVersion: SCHEMA_VERSION,
    durationMs: durationFromContext(context),
    warnings: options?.warnings ?? [],
    partialResult: options?.partialResult ?? false,
    data,
    error: null
  };

  return NextResponse.json(body, {
    status: options?.status ?? 200
  });
}

export function errorEnvelope(
  context: RequestContext,
  error: ApiError,
  options?: {
    warnings?: string[];
    partialResult?: boolean;
  }
): NextResponse<ApiEnvelope<null>> {
  const body: ApiEnvelope<null> = {
    requestId: context.requestId,
    traceId: context.traceId,
    schemaVersion: SCHEMA_VERSION,
    durationMs: durationFromContext(context),
    warnings: options?.warnings ?? [],
    partialResult: options?.partialResult ?? false,
    data: null,
    error: error.shape
  };

  return NextResponse.json(body, {
    status: error.statusCode
  });
}
