import type { NextRequest } from "next/server";

export interface RequestContext {
  requestId: string;
  traceId: string;
  startedAtMs: number;
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function normalizeTraceId(value: string | null): string {
  if (!value || value.trim().length === 0) {
    return crypto.randomUUID();
  }

  return value.trim();
}

export function buildRequestContext(request: NextRequest): RequestContext {
  return {
    requestId: randomId("req"),
    traceId: normalizeTraceId(request.headers.get("x-trace-id")),
    startedAtMs: Date.now()
  };
}
