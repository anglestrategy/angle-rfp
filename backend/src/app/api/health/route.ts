import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { successEnvelope } from "@/lib/api/envelope";

export async function GET(request: NextRequest) {
  const context = buildRequestContext(request);

  const payload = {
    status: "ok",
    service: "angle-rfp-backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  };

  return successEnvelope(context, payload);
}
