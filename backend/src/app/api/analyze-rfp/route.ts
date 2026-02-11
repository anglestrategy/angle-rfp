import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { analyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { registerAnalysisUsage } from "@/lib/ops/cost-budget";

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    if (!body?.analysisId || !body?.parsedDocument) {
      throw makeError(400, "validation_error", "analysisId and parsedDocument are required", "analyze-rfp", {
        retryable: false
      });
    }

    const extracted = await analyzeRfpInput({
      analysisId: body.analysisId,
      parsedDocument: body.parsedDocument
    });

    const rawTextLength = typeof body.parsedDocument?.rawText === "string" ? body.parsedDocument.rawText.length : 0;
    const estimatedTokens = Math.ceil(rawTextLength / 4) * 5;
    registerAnalysisUsage({
      analysisId: body.analysisId,
      tokens: estimatedTokens
    });

    return successEnvelope(context, extracted, {
      warnings: extracted.warnings,
      partialResult: extracted.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "analyze-rfp");
    return errorEnvelope(context, normalized);
  }
}
