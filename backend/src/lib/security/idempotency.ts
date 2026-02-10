import type { NextRequest } from "next/server";
import { makeError } from "@/lib/api/errors";

export function assertIdempotencyKey(request: NextRequest): string {
  const value = request.headers.get("idempotency-key")?.trim() ?? "";

  if (value.length < 8) {
    throw makeError(400, "validation_error", "Idempotency-Key header is required", "idempotency", {
      retryable: false,
      details: {
        minimumLength: 8
      }
    });
  }

  return value;
}
