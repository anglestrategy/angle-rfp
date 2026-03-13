import "dotenv/config";

import { storage } from "../server/storage";
import { buildShadowOutputs } from "../server/services/analysisShadow";

function extractRedFlags(analysis: any): any[] {
  const direct = analysis.redFlags;
  if (Array.isArray(direct)) return direct;
  if (Array.isArray(direct?.redFlags)) return direct.redFlags;
  if (Array.isArray(direct?.flags)) return direct.flags;

  const extracted = analysis.extractedData as any;
  const fallback = extracted?.redFlagAnalysis;
  if (Array.isArray(fallback?.redFlags)) return fallback.redFlags;
  if (Array.isArray(fallback?.flags)) return fallback.flags;
  return [];
}

async function main() {
  const analyses = await storage.getAllAnalyses();
  const candidates = analyses.filter(
    (analysis) =>
      analysis.status === "complete" &&
      analysis.documentText &&
      analysis.extractedData,
  );

  console.log(`Found ${candidates.length} completed analyses to backfill.`);

  for (const analysis of candidates) {
    const shadowResult = buildShadowOutputs({
      analysisId: analysis.id,
      fileName: analysis.fileName,
      createdAt: analysis.createdAt,
      documentText: analysis.documentText || "",
      documentQuality: (analysis.documentQuality as any) || null,
      extractedData: analysis.extractedData,
      scopeAnalysis: (analysis.scopeAnalysis as any) || null,
      clientResearch: (analysis.clientResearch as any) || null,
      financialScore: (analysis.financialScore as any) || null,
      redFlags: extractRedFlags(analysis),
      overallScore: analysis.overallScore,
      recommendation: analysis.recommendation,
    });

    await storage.updateAnalysis(analysis.id, {
      shadowRunStatus: shadowResult.shadowRunStatus,
      shadowOutputs: shadowResult.shadowOutputs,
      manualReviewRequired: shadowResult.manualReviewRequired,
      comparisonSummary: shadowResult.comparisonSummary,
    });

    console.log(
      `Backfilled analysis ${analysis.id} (${analysis.fileName}) -> ${shadowResult.shadowRunStatus}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
