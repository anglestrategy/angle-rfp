import { describe, expect, test } from "vitest";
import { SCHEMA_VERSION, errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError } from "@/lib/api/errors";

const context = {
  requestId: "req_unit",
  traceId: "trace_unit",
  startedAtMs: Date.now() - 50
};

describe("api envelope", () => {
  test("builds success envelope with required fields", async () => {
    const response = successEnvelope(context, { ok: true });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requestId).toBe("req_unit");
    expect(body.traceId).toBe("trace_unit");
    expect(body.schemaVersion).toBe(SCHEMA_VERSION);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    expect(body.partialResult).toBe(false);
    expect(body.data).toEqual({ ok: true });
    expect(body.error).toBeNull();
  });

  test("builds error envelope with error payload", async () => {
    const err = makeError(401, "auth_failed", "Unauthorized", "auth", { retryable: false });
    const response = errorEnvelope(context, err);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("auth_failed");
    expect(body.error.stage).toBe("auth");
  });
});
