import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { exportAnalysis } from "@/lib/export/export-service";

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();
    if (!body?.analysisId || !body?.report || !body?.format) {
      throw makeError(400, "validation_error", "analysisId, report, and format are required", "export", {
        retryable: false
      });
    }

    const result = await exportAnalysis({
      analysisId: body.analysisId,
      report: body.report,
      format: body.format
    });

    return successEnvelope(context, result);
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "export");
    return errorEnvelope(context, normalized);
  }
}
