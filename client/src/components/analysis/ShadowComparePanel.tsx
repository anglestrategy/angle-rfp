import { Card, CardContent } from "@/components/ui/card";
import type {
  AnalysisDocumentQuality,
  AnalysisMeta,
  ShadowComparisonSummary,
  ShadowOutputs,
  ShadowRunStatus,
} from "@shared/models/analysis";

interface ShadowComparePanelProps {
  shadowRunStatus?: ShadowRunStatus | string | null;
  manualReviewRequired?: boolean | null;
  comparisonSummary?: ShadowComparisonSummary | null;
  shadowOutputs?: ShadowOutputs | null;
  analysisMeta?: AnalysisMeta | null;
  documentQuality?: AnalysisDocumentQuality | null;
  reviewReasons?: string[] | null;
  liveStages?: Array<Record<string, any>>;
  shadowStages?: Array<Record<string, any>>;
  liveScore: number;
  liveRecommendation: string;
}

function statusClasses(status: string | null | undefined): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "complete" || normalized === "pass") {
    return "bg-emerald-500/10 text-emerald-600";
  }
  if (normalized === "manual_review" || normalized === "review") {
    return "bg-amber-500/10 text-amber-600";
  }
  if (normalized === "failed" || normalized === "fail") {
    return "bg-red-500/10 text-red-500";
  }
  return "bg-foreground/[0.06] text-muted-foreground";
}

export function ShadowComparePanel({
  shadowRunStatus,
  manualReviewRequired,
  comparisonSummary,
  shadowOutputs,
  analysisMeta,
  documentQuality,
  reviewReasons,
  liveStages,
  shadowStages,
  liveScore,
  liveRecommendation,
}: ShadowComparePanelProps) {
  if (!comparisonSummary && !shadowOutputs) return null;

  const shadowScore = shadowOutputs?.scorecard?.fitScore ?? null;
  const confidenceScore = shadowOutputs?.scorecard?.confidenceScore ?? null;
  const shadowRecommendation =
    shadowOutputs?.scorecard?.recommendation ||
    comparisonSummary?.shadowRecommendation ||
    "N/A";
  const criteria = comparisonSummary?.criteriaResults || [];
  const notes = comparisonSummary?.notes || [];
  const stageTimeline =
    (Array.isArray(shadowStages) && shadowStages.length > 0
      ? shadowStages
      : shadowOutputs?.stages) ||
    (Array.isArray(liveStages) ? liveStages : []);
  const evidenceBuckets = Object.keys(shadowOutputs?.evidenceIndex || {}).length;
  const evidenceItems = Object.values(shadowOutputs?.evidenceIndex || {}).flat();
  const sources = shadowOutputs?.sources || [];
  const reasons = reviewReasons || [];

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="panel-heading">Shadow Compare</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] ${statusClasses(shadowRunStatus)}`}>
              {shadowRunStatus || "not_started"}
            </span>
            {comparisonSummary?.parityStatus && (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] ${statusClasses(comparisonSummary.parityStatus)}`}>
                parity {comparisonSummary.parityStatus}
              </span>
            )}
            {manualReviewRequired && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] bg-amber-500/10 text-amber-600">
                manual review
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="rounded-xl border border-foreground/8 px-3 py-2">
            <p className="swiss-data-label">Live Result</p>
            <p className="text-sm font-semibold mt-1">
              {liveScore}/100 · {liveRecommendation}
            </p>
          </div>
          <div className="rounded-xl border border-foreground/8 px-3 py-2">
            <p className="swiss-data-label">Shadow Result</p>
            <p className="text-sm font-semibold mt-1">
              {shadowScore != null ? `${shadowScore}/100` : "—"} · {shadowRecommendation}
            </p>
          </div>
          <div className="rounded-xl border border-foreground/8 px-3 py-2">
            <p className="swiss-data-label">Confidence</p>
            <p className="text-sm font-semibold mt-1">
              {confidenceScore != null ? `${confidenceScore}/100` : "—"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="rounded-xl border border-foreground/8 px-3 py-2">
            <p className="swiss-data-label">Run State</p>
            <p className="text-sm font-semibold mt-1">
              {analysisMeta?.runStatus || "—"}
            </p>
            {analysisMeta?.stageKey && (
              <p className="text-xs text-muted-foreground mt-1">
                stage: {analysisMeta.stageKey}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-foreground/8 px-3 py-2">
            <p className="swiss-data-label">Document Quality</p>
            <p className="text-sm font-semibold mt-1">
              {documentQuality
                ? `${documentQuality.extractedTextLength.toLocaleString()} chars`
                : "—"}
            </p>
            {documentQuality && (
              <p className="text-xs text-muted-foreground mt-1">
                {documentQuality.parseMethod} · {Math.round(documentQuality.averageCharsPerPage)} chars/page
              </p>
            )}
          </div>
          <div className="rounded-xl border border-foreground/8 px-3 py-2">
            <p className="swiss-data-label">Evidence</p>
            <p className="text-sm font-semibold mt-1">
              {evidenceBuckets} buckets · {sources.length} sources
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {evidenceItems.length} evidence items indexed
            </p>
          </div>
        </div>

        {criteria.length > 0 && (
          <div className="space-y-2">
            {criteria.map((criterion) => (
              <div
                key={criterion.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-foreground/8 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{criterion.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {criterion.detail}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] ${criterion.passed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
                >
                  {criterion.passed ? "pass" : "review"}
                </span>
              </div>
            ))}
          </div>
        )}

        {stageTimeline.length > 0 && (
          <div className="mt-3 rounded-xl border border-foreground/8 bg-foreground/[0.02] px-3 py-2">
            <p className="swiss-data-label mb-2">Stage Timeline</p>
            <div className="space-y-2">
              {stageTimeline.map((stage: any, index: number) => (
                <div
                  key={`${stage.stage_key || stage.key || stage.label}-${index}`}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {stage.label || stage.key || stage.stage_key}
                    </p>
                    {(stage.detail || stage.error_message || stage.errorMessage) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stage.detail || stage.error_message || stage.errorMessage}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.08em] ${statusClasses(stage.status)}`}>
                    {stage.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {documentQuality?.parseWarnings?.length ? (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="swiss-data-label mb-1">Parse Warnings</p>
            <div className="space-y-1">
              {documentQuality.parseWarnings.map((warning, index) => (
                <p key={index} className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {reasons.length > 0 && (
          <div className="mt-3 rounded-xl border border-foreground/8 bg-foreground/[0.02] px-3 py-2">
            <p className="swiss-data-label mb-1">Review Reasons</p>
            <div className="space-y-1">
              {reasons.map((reason, index) => (
                <p key={index} className="text-xs text-muted-foreground leading-relaxed">
                  {reason}
                </p>
              ))}
            </div>
          </div>
        )}

        {evidenceItems.length > 0 && (
          <details className="mt-3 rounded-xl border border-foreground/8 bg-foreground/[0.02] px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Evidence Drawer
            </summary>
            <div className="space-y-2 mt-3">
              {evidenceItems.slice(0, 8).map((item, index) => (
                <div key={`${item.label || item.matchedText || index}-${index}`} className="rounded-lg border border-foreground/8 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{item.label || item.matchedText || "Evidence"}</p>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.page ? `p.${item.page}` : item.sourceKind}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {item.snippet}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}

        {notes.length > 0 && (
          <div className="mt-3 rounded-xl border border-foreground/8 bg-foreground/[0.02] px-3 py-2">
            <p className="swiss-data-label mb-1">Notes</p>
            <div className="space-y-1">
              {notes.map((note, index) => (
                <p key={index} className="text-xs text-muted-foreground leading-relaxed">
                  {note}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
