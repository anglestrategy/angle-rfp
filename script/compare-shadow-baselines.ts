import "dotenv/config";

import { readFile } from "fs/promises";
import path from "path";
import { storage } from "../server/storage";
import {
  baselineSnapshotSchema,
  shadowPromotionCriteria,
  type ShadowComparisonSummary,
} from "../shared/models/analysis";

interface AggregateMetric {
  passed: number;
  total: number;
}

async function main() {
  const baselinePath = path.join(
    process.cwd(),
    "docs",
    "baselines",
    "live-analysis-baseline.json",
  );
  const file = await readFile(baselinePath, "utf8");
  const baseline = baselineSnapshotSchema.parse(JSON.parse(file));

  const analyses = await storage.getAllAnalyses();
  const byId = new Map(analyses.map((analysis) => [analysis.id, analysis]));
  const metricMap = new Map<string, AggregateMetric>(
    shadowPromotionCriteria.map((criterion) => [
      criterion.id,
      { passed: 0, total: 0 },
    ]),
  );

  let completeCount = 0;
  let missingShadowCount = 0;
  let scoreDeltaReviewCount = 0;

  for (const snapshot of baseline.analyses) {
    const analysis = byId.get(snapshot.analysisId);
    if (!analysis || analysis.status !== "complete") continue;
    completeCount++;

    const comparison =
      (analysis.comparisonSummary as ShadowComparisonSummary | null) ??
      ((analysis.shadowOutputs as any)?.comparisonSummary as
        | ShadowComparisonSummary
        | null);

    if (!comparison) {
      missingShadowCount++;
      continue;
    }

    if (Math.abs(comparison.scoreDelta) > 10) {
      scoreDeltaReviewCount++;
    }

    for (const criterion of comparison.criteriaResults) {
      const metric = metricMap.get(criterion.id);
      if (!metric) continue;
      metric.total += 1;
      if (criterion.passed) metric.passed += 1;
    }
  }

  const recommendationMetric = metricMap.get("recommendation_stability");
  const recommendationRate =
    recommendationMetric && recommendationMetric.total > 0
      ? recommendationMetric.passed / recommendationMetric.total
      : 0;

  const summary = {
    generatedAt: new Date().toISOString(),
    baselineCount: baseline.analyses.length,
    completeCount,
    missingShadowCount,
    scoreDeltaReviewCount,
    criteria: Object.fromEntries(
      [...metricMap.entries()].map(([id, metric]) => [
        id,
        {
          passed: metric.passed,
          total: metric.total,
          passRate:
            metric.total > 0 ? Number((metric.passed / metric.total).toFixed(3)) : 0,
        },
      ]),
    ),
    thresholds: {
      recommendationStabilityTarget: 0.9,
      actualRecommendationStability: Number(recommendationRate.toFixed(3)),
    },
    promotionReady:
      missingShadowCount === 0 &&
      recommendationRate >= 0.9 &&
      [...metricMap.entries()].every(([id, metric]) =>
        id === "score_delta" ? true : metric.total > 0 && metric.passed === metric.total,
      ),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
