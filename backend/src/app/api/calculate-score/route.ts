import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { calculateScoreInput } from "@/lib/scoring/calculate-score";

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();
    if (!body?.analysisId || !body?.extractedRfp || !body?.scopeAnalysis || !body?.clientResearch) {
      throw makeError(
        400,
        "validation_error",
        "analysisId, extractedRfp, scopeAnalysis, and clientResearch are required",
        "calculate-score",
        {
          retryable: false
        }
      );
    }

    const result = await calculateScoreInput({
      analysisId: body.analysisId,
      extractedRfp: body.extractedRfp,
      scopeAnalysis: body.scopeAnalysis,
      clientResearch: body.clientResearch
    });

    return successEnvelope(context, result.score, {
      warnings: result.warnings,
      partialResult: result.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "calculate-score");
    return errorEnvelope(context, normalized);
  }
}
