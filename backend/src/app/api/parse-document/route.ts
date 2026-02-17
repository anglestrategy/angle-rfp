import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { reserveUserDailyAnalysis, registerAnalysisUsage } from "@/lib/ops/cost-budget";
import { parseDocumentInput } from "@/lib/parsing/parse-document";
import { storeParsedDocument } from "@/lib/parsing/parsed-document-store";
import { parseBearerToken } from "@/lib/security/auth";

// Keep parse request bounded to avoid client-side connection resets on long uploads/parses.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);
  const startedAt = Date.now();

  try {
    const form = await request.formData();
    const analysisId = String(form.get("analysisId") ?? "").trim();
    const responseMode = String(form.get("responseMode") ?? "").trim().toLowerCase();
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
    storeParsedDocument(analysisId, parsed);

    registerAnalysisUsage({
      analysisId,
      ocrPages: parsed.ocrStats?.pagesOcred ?? 0
    });

    const durationMs = Date.now() - startedAt;
    console.log(
      `[Parse] analysisId=${analysisId} durationMs=${durationMs} format=${parsed.detectedFormat} ` +
      `confidence=${parsed.parseConfidence.toFixed(3)} source=${parsed.parserProvenance?.join(",") || "unknown"} ` +
      `warnings=${parsed.warnings.length}`
    );

    const payload = responseMode === "reference"
      ? {
          ...parsed,
          // Keep parsed payload persisted server-side for downstream stages, while returning
          // a lightweight response to avoid large transfer latency/timeouts on desktop clients.
          normalizedText: "",
          rawText: "",
          sections: [],
          chunkIndex: [],
          tables: [],
          evidenceMap: []
        }
      : parsed;

    return successEnvelope(context, payload, {
      warnings: parsed.warnings,
      partialResult: parsed.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "parse-document");
    console.error(
      `[Parse] failed traceId=${context.traceId} code=${normalized.shape.code} status=${normalized.statusCode} message=${normalized.shape.message}`
    );
    return errorEnvelope(context, normalized);
  }
}
