import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope } from "@/lib/api/envelope";
import { normalizeUnknownError } from "@/lib/api/errors";
import { assertAuthorized, parseBearerToken } from "@/lib/security/auth";
import { assertIdempotencyKey } from "@/lib/security/idempotency";
import { assertWithinRateLimit } from "@/lib/ops/rate-limit";

const POST_ONLY_GUARDED = /^\/api\//;

export function middleware(request: NextRequest): NextResponse {
  if (!POST_ONLY_GUARDED.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.method !== "POST") {
    return NextResponse.next();
  }

  const context = buildRequestContext(request);

  try {
    assertAuthorized(request);
    assertIdempotencyKey(request);
    const principal = parseBearerToken(request.headers.get("authorization")) ?? "anonymous";
    assertWithinRateLimit(`${principal}:${request.nextUrl.pathname}`);
    return NextResponse.next();
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "middleware");
    return errorEnvelope(context, normalized);
  }
}

export const config = {
  matcher: ["/api/:path*"]
};
