import { describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { assertAuthorized, parseBearerToken } from "@/lib/security/auth";
import { assertIdempotencyKey } from "@/lib/security/idempotency";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://example.com/api/test", {
    method: "POST",
    headers
  });
}

describe("auth parsing", () => {
  test("extracts bearer token", () => {
    expect(parseBearerToken("Bearer abc")).toBe("abc");
    expect(parseBearerToken("bearer xyz")).toBe("xyz");
    expect(parseBearerToken("Token abc")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  test("assertAuthorized accepts configured token", () => {
    vi.stubEnv("BACKEND_APP_TOKENS", "token-1,token-2");
    expect(() => assertAuthorized(makeRequest({ authorization: "Bearer token-2" }))).not.toThrow();
    vi.unstubAllEnvs();
  });

  test("assertAuthorized rejects missing token", () => {
    expect(() => assertAuthorized(makeRequest({}))).toThrowError(/Authorization/);
  });

  test("assertAuthorized rejects bad token", () => {
    vi.stubEnv("BACKEND_APP_TOKENS", "token-1");
    expect(() => assertAuthorized(makeRequest({ authorization: "Bearer wrong" }))).toThrowError(/Unauthorized/);
    vi.unstubAllEnvs();
  });
});

describe("idempotency", () => {
  test("accepts valid idempotency key", () => {
    const key = assertIdempotencyKey(makeRequest({ "idempotency-key": "abc12345" }));
    expect(key).toBe("abc12345");
  });

  test("rejects short idempotency key", () => {
    expect(() => assertIdempotencyKey(makeRequest({ "idempotency-key": "short" }))).toThrowError(/Idempotency-Key/);
  });
});
