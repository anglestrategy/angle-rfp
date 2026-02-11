import { afterEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/version/route";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("version route", () => {
  test("prefers Render commit when Vercel commit is not set", async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.RENDER_GIT_COMMIT = "render-sha-123";

    const request = new NextRequest("http://localhost/api/version");
    const response = await GET(request);
    const payload = await response.json();

    expect(payload.data.build).toBe("render-sha-123");
  });
});
