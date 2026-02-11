import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { analyzeScopeInput } from "@/lib/scope/analyze-scope";

// Extend timeout for Claude API calls (Pro plan required for >10s)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    if (!body?.analysisId || !body?.scopeOfWork || !body?.language) {
      throw makeError(400, "validation_error", "analysisId, scopeOfWork, and language are required", "analyze-scope", {
        retryable: false
      });
    }

    const result = await analyzeScopeInput({
      analysisId: body.analysisId,
      scopeOfWork: body.scopeOfWork,
      language: body.language
    });

    return successEnvelope(context, result, {
      warnings: result.warnings,
      partialResult: result.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "analyze-scope");
    return errorEnvelope(context, normalized);
  }
}
