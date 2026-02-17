import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { getParsedDocument, storeParsedDocument } from "@/lib/parsing/parsed-document-store";
import { startAnalyzeJob } from "@/lib/extraction/analyze-job-store";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();
    const analysisId = String(body?.analysisId ?? "").trim();
    if (!analysisId) {
      throw makeError(400, "validation_error", "analysisId is required", "analyze-start", {
        retryable: false
      });
    }

    const parsedDocument = body?.parsedDocument ?? getParsedDocument(analysisId);
    if (!parsedDocument) {
      throw makeError(
        400,
        "validation_error",
        "parsedDocument is missing for this analysisId. Parse the document again before extraction.",
        "analyze-start",
        { retryable: true }
      );
    }

    // Ensure the latest parsed payload is available for subsequent stages.
    storeParsedDocument(analysisId, parsedDocument);

    const job = startAnalyzeJob({
      analysisId,
      parsedDocument
    });

    return successEnvelope(context, job);
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "analyze-start");
    return errorEnvelope(context, normalized);
  }
}

