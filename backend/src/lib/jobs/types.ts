import type { ParsedDocumentV1 } from "@/lib/parsing/parse-document";
import type { ExtractedRfpDataV1 } from "@/lib/extraction/analyze-rfp";
import type { ScopeAnalysisV1 } from "@/lib/scope/analyze-scope";
import type { ClientResearchV1 } from "@/lib/research/research-client";
import type { FinancialScoreV1 } from "@/lib/scoring/calculate-score";

/**
 * Pipeline stages in execution order.
 * Each stage maps 1:1 to an existing lib function.
 */
export const JOB_STAGES = [
  "queued",
  "parsing",
  "extracting",
  "analyzing_scope",
  "researching",
  "scoring",
  "completed",
  "failed"
] as const;

export type JobStage = (typeof JOB_STAGES)[number];

/** Human-readable labels for each stage (used by client progress UI). */
export const STAGE_LABELS: Record<JobStage, string> = {
  queued: "Queued",
  parsing: "Reading Document",
  extracting: "Extracting RFP Data",
  analyzing_scope: "Analyzing Scope",
  researching: "Researching Client",
  scoring: "Calculating Score",
  completed: "Analysis Complete",
  failed: "Analysis Failed"
};

/**
 * Ordered pipeline stages (excludes terminal states).
 * Used to calculate numeric progress (0-1).
 */
const ACTIVE_STAGES: JobStage[] = [
  "parsing",
  "extracting",
  "analyzing_scope",
  "researching",
  "scoring"
];

/** Returns a 0–1 progress value for the given stage. */
export function progressForStage(stage: JobStage): number {
  if (stage === "completed") return 1;
  if (stage === "failed") return 0;
  if (stage === "queued") return 0;
  const index = ACTIVE_STAGES.indexOf(stage);
  if (index === -1) return 0;
  return (index + 1) / (ACTIVE_STAGES.length + 1);
}

/** Intermediate results collected as each stage completes. */
export interface JobStageResults {
  parsedDocument?: ParsedDocumentV1;
  extractedRfp?: ExtractedRfpDataV1;
  scopeAnalysis?: ScopeAnalysisV1;
  clientResearch?: ClientResearchV1;
  financialScore?: FinancialScoreV1;
}

/** A single job in the queue. */
export interface Job {
  jobId: string;
  analysisId: string;
  stage: JobStage;
  stageLabel: string;
  progress: number;
  createdAt: number;
  updatedAt: number;

  /** File metadata (bytes held in memory until parsing completes). */
  file: {
    name: string;
    mimeType: string;
    bytes: Buffer;
  } | null;

  /** Accumulated warnings across all stages. */
  warnings: string[];

  /** Results from each completed stage. */
  results: JobStageResults;

  /** Set when stage === "failed". */
  error: {
    code: string;
    message: string;
    stage: string;
    retryable: boolean;
  } | null;
}

/**
 * The polling response returned by GET /api/jobs/:jobId.
 * Excludes internal fields (file bytes) and only includes
 * results when the job is completed.
 */
export interface JobStatusResponse {
  jobId: string;
  analysisId: string;
  stage: JobStage;
  stageLabel: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
  error: Job["error"];
  results: JobStageResults | null;
}
