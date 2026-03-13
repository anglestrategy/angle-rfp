import "dotenv/config";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { storage } from "../server/storage";
import {
  baselineSnapshotSchema,
  type BaselineSnapshot,
} from "../shared/models/analysis";
import { createBaselineSnapshotRecord } from "../server/services/analysisShadow";

async function main() {
  const analyses = await storage.getAllAnalyses();
  const completed = analyses.filter(
    (analysis) =>
      analysis.status === "complete" &&
      analysis.documentText &&
      analysis.extractedData,
  );

  const snapshot: BaselineSnapshot = baselineSnapshotSchema.parse({
    generatedAt: new Date().toISOString(),
    criteriaVersion: "shadow-v2",
    analyses: completed.map((analysis) =>
      createBaselineSnapshotRecord({
        analysisId: analysis.id,
        fileName: analysis.fileName,
        createdAt: analysis.createdAt,
        documentText: analysis.documentText || "",
        documentQuality: (analysis.documentQuality as any) || null,
        extractedData: analysis.extractedData,
        scopeAnalysis: (analysis.scopeAnalysis as any) || null,
        clientResearch: (analysis.clientResearch as any) || null,
        financialScore: (analysis.financialScore as any) || null,
        redFlags: Array.isArray(analysis.redFlags) ? analysis.redFlags : [],
        overallScore: analysis.overallScore,
        recommendation: analysis.recommendation,
      }),
    ),
  });

  const outputDir = path.join(process.cwd(), "docs", "baselines");
  await mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "live-analysis-baseline.json");
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2));

  console.log(`Wrote ${snapshot.analyses.length} analyses to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
