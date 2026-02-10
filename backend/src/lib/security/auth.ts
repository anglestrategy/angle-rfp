import type { NextRequest } from "next/server";
import { makeError } from "@/lib/api/errors";

function getConfiguredTokens(): string[] {
  const raw = process.env.BACKEND_APP_TOKENS ?? "dev-angle-rfp-token";

  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export function assertAuthorized(request: NextRequest): void {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw makeError(401, "auth_failed", "Missing or invalid Authorization header", "auth", {
      retryable: false,
      details: {
        expected: "Authorization: Bearer <token>"
      }
    });
  }

  const configured = getConfiguredTokens();
  if (!configured.includes(token)) {
    throw makeError(401, "auth_failed", "Unauthorized token", "auth", {
      retryable: false,
      details: {
        tokenLength: token.length
      }
    });
  }
}
