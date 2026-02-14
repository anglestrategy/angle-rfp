import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { reserveUserDailyAnalysis, registerAnalysisUsage } from "@/lib/ops/cost-budget";
import { parseDocumentInput } from "@/lib/parsing/parse-document";
import { parseBearerToken } from "@/lib/security/auth";

// Allows long-running parse requests (OCR/Unstructured) on serverless platforms.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const form = await request.formData();
    const analysisId = String(form.get("analysisId") ?? "").trim();
    const maybeFile = form.get("file");

    if (!analysisId) {
      throw makeError(400, "validation_error", "analysisId is required", "parse-document", {
        retryable: false,
        details: { field: "analysisId" }
      });
    }

    if (!(maybeFile instanceof File)) {
      throw makeError(400, "validation_error", "file is required", "parse-document", {
        retryable: false,
        details: { field: "file" }
      });
    }

    const principal = parseBearerToken(request.headers.get("authorization")) ?? "anonymous";
    reserveUserDailyAnalysis(principal, analysisId);

    const fileBytes = Buffer.from(await maybeFile.arrayBuffer());

    const parsed = await parseDocumentInput({
      analysisId,
      fileName: maybeFile.name,
      mimeType: maybeFile.type,
      fileBytes
    });

    registerAnalysisUsage({
      analysisId,
      ocrPages: parsed.ocrStats?.pagesOcred ?? 0
    });

    return successEnvelope(context, parsed, {
      warnings: parsed.warnings,
      partialResult: parsed.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "parse-document");
    return errorEnvelope(context, normalized);
  }
}
