import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { successEnvelope } from "@/lib/api/envelope";

export async function GET(request: NextRequest) {
  const context = buildRequestContext(request);

  const payload = {
    apiVersion: "1.0.0",
    schemaVersion: "1.0.0",
    promptVersionSet: "v1",
    build: process.env.VERCEL_GIT_COMMIT_SHA ?? "local"
  };

  return successEnvelope(context, payload);
}
