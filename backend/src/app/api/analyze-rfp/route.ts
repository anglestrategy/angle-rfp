import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { analyzeRfpInput } from "@/lib/extraction/analyze-rfp";
import { registerAnalysisUsage } from "@/lib/ops/cost-budget";
import { getParsedDocument, storeParsedDocument } from "@/lib/parsing/parsed-document-store";

// Extraction can include high-context model passes; keep an explicit budget.
// Increased to 600s (10 min) to accommodate:
// - Pass 1 extraction: 120s
// - Pass 2-5 analysis: 30s each
// - Beautifier (when enabled): 360s (3x120s parallel calls)
// - Buffer: 60s
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    if (!body?.analysisId) {
      throw makeError(400, "validation_error", "analysisId is required", "analyze-rfp", {
        retryable: false
      });
    }

    const parsedDocument = body.parsedDocument ?? getParsedDocument(body.analysisId);
    if (!parsedDocument) {
      throw makeError(
        400,
        "validation_error",
        "parsedDocument is missing for this analysisId. Parse the document again before extraction.",
        "analyze-rfp",
        {
          retryable: true
        }
      );
    }
    storeParsedDocument(body.analysisId, parsedDocument);

    const extracted = await analyzeRfpInput({
      analysisId: body.analysisId,
      parsedDocument
    });

    const rawTextLength = typeof parsedDocument.rawText === "string" ? parsedDocument.rawText.length : 0;
    // Gemini Flash averages ~0.35 tokens per character on mixed RFP text.
    const estimatedTokens = Math.ceil(rawTextLength * 0.35);
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
