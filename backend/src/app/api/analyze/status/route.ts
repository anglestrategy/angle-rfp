import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { getAnalyzeJobState } from "@/lib/extraction/analyze-job-store";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const analysisId = request.nextUrl.searchParams.get("analysisId")?.trim() ?? "";
    if (!analysisId) {
      throw makeError(400, "validation_error", "analysisId is required", "analyze-status", {
        retryable: false
      });
    }

    const job = getAnalyzeJobState(analysisId);
    if (!job) {
      throw makeError(404, "validation_error", "No active analysis job found", "analyze-status", {
        retryable: false,
        details: { analysisId }
      });
    }

    return successEnvelope(context, job);
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "analyze-status");
    return errorEnvelope(context, normalized);
  }
}
