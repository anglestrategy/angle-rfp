import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { errorEnvelope, successEnvelope } from "@/lib/api/envelope";
import { makeError, normalizeUnknownError } from "@/lib/api/errors";
import { registerAnalysisUsage } from "@/lib/ops/cost-budget";
import { researchClientInput } from "@/lib/research/research-client";

export async function POST(request: NextRequest) {
  const context = buildRequestContext(request);

  try {
    const body = await request.json();

    if (!body?.analysisId || !body?.clientName || body?.country !== "SA") {
      throw makeError(400, "validation_error", "analysisId, clientName, and country=SA are required", "research-client", {
        retryable: false
      });
    }

    const result = await researchClientInput({
      analysisId: body.analysisId,
      clientName: body.clientName,
      clientNameArabic: body.clientNameArabic,
      country: "SA",
      // Pass RFP context for smarter query generation
      rfpContext: body.rfpContext ? {
        projectName: body.rfpContext.projectName,
        projectDescription: body.rfpContext.projectDescription,
        scopeOfWork: body.rfpContext.scopeOfWork,
        industry: body.rfpContext.industry
      } : undefined
    });

    registerAnalysisUsage({
      analysisId: body.analysisId,
      queries: 5
    });

    return successEnvelope(context, result, {
      warnings: result.warnings,
      partialResult: result.warnings.length > 0
    });
  } catch (error: unknown) {
    const normalized = normalizeUnknownError(error, "research-client");
    return errorEnvelope(context, normalized);
  }
}
