import type { NextRequest } from "next/server";
import { buildRequestContext } from "@/lib/api/request-context";
import { successEnvelope } from "@/lib/api/envelope";
import { getGeminiModelResolutionDiagnostics } from "@/lib/ai/model-resolver";

export async function GET(request: NextRequest) {
  const context = buildRequestContext(request);
  const modelDiagnostics = getGeminiModelResolutionDiagnostics();

  const payload = {
    status: "ok",
    service: "angle-rfp-backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    ai: {
      provider: "google-gemini",
      apiKeyConfigured: modelDiagnostics.apiKeyConfigured,
      resolvedModel: modelDiagnostics.resolvedModel,
      modelSourceEnvVar: modelDiagnostics.sourceEnvVar,
      candidateModels: modelDiagnostics.candidates,
      providerReachable: modelDiagnostics.apiKeyConfigured && modelDiagnostics.candidates.length > 0,
      warnings: modelDiagnostics.warnings
    }
  };

  return successEnvelope(context, payload);
}
