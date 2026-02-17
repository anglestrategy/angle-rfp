import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { getAnalyzeJobResult, getAnalyzeJobState } from "@/lib/extraction/analyze-job-store";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const analysisId = request.nextUrl.searchParams.get("analysisId")?.trim() ?? "";
    if (!analysisId) {
      throw makeError(400, "validation_error", "analysisId is required", "analyze-result", {
        retryable: false
      });
    }

    const state = getAnalyzeJobState(analysisId);
    if (!state) {
      throw makeError(404, "validation_error", "No analysis job found", "analyze-result", {
        retryable: false,
        details: { analysisId }
      });
    }

    if (state.status === "failed") {
      throw makeError(
        422,
        "partial_result",
        state.errorMessage || "Analysis failed. Check logs for details.",
        "analyze-result",
        { retryable: true, details: { analysisId } }
      );
    }

    if (state.status !== "succeeded") {
      throw makeError(
        409,
        "timeout",
        "Analysis is still running. Poll /api/analyze/status until completion.",
        "analyze-result",
        { retryable: true, details: { analysisId, status: state.status } }
      );
    }

    const result = getAnalyzeJobResult(analysisId);
    if (!result) {
      throw makeError(
        500,
        "internal_error",
        "Analysis completed but result payload is unavailable.",
        "analyze-result",
        { retryable: true, details: { analysisId } }
      );
    }

    return successEnvelope(context, result, {
      warnings: result.warnings,
      partialResult: result.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "analyze-result");
    return errorEnvelope(context, normalized);
  }
}
