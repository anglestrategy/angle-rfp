import { z } from "zod";

export const analysisRunStatusSchema = z.enum([
  "queued",
  "running",
  "complete",
  "failed",
  "manual_review",
  "cancelled",
]);

export type AnalysisRunStatus = z.infer<typeof analysisRunStatusSchema>;

export const analysisStageStatusSchema = z.enum([
  "pending",
  "running",
  "complete",
  "failed",
  "skipped",
]);

export type AnalysisStageStatus = z.infer<typeof analysisStageStatusSchema>;

export const analysisEvidenceSourceKindSchema = z.enum([
  "document",
  "document_inference",
  "document_heuristic",
  "web_research",
  "system",
]);

export const analysisSourceSchema = z.object({
  title: z.string(),
  url: z.string().url().nullable().optional(),
  domain: z.string().nullable().optional(),
  sourceType: z.enum([
    "document_only_inference",
    "web_research",
    "mixed",
    "system",
  ]),
  reliabilityTier: z.enum([
    "unknown",
    "low",
    "medium",
    "high",
    "verified",
  ]),
  publishedAt: z.string().nullable().optional(),
  retrievedAt: z.string(),
  snippet: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export type AnalysisSource = z.infer<typeof analysisSourceSchema>;

export const analysisEvidenceItemSchema = z.object({
  label: z.string().optional(),
  sourceKind: analysisEvidenceSourceKindSchema,
  snippet: z.string(),
  matchedText: z.string().optional(),
  page: z.number().int().positive().nullable().optional(),
  charStart: z.number().int().nonnegative().nullable().optional(),
  charEnd: z.number().int().nonnegative().nullable().optional(),
  clauseReference: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  sourceUrl: z.string().url().optional(),
  sourceTitle: z.string().optional(),
  note: z.string().optional(),
  sourceId: z.number().int().positive().nullable().optional(),
});

export type AnalysisEvidenceItem = z.infer<typeof analysisEvidenceItemSchema>;

export const analysisEvidenceIndexSchema = z.record(
  z.string(),
  z.array(analysisEvidenceItemSchema),
);

export type AnalysisEvidenceIndex = z.infer<typeof analysisEvidenceIndexSchema>;

export const analysisDocumentChunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive().nullable(),
  sectionLabel: z.string().nullable(),
  text: z.string(),
  charStart: z.number().int().nonnegative().nullable(),
  charEnd: z.number().int().nonnegative().nullable(),
  parseMethod: z.enum(["pdf_text", "docx_text", "ocr_fallback", "heuristic"]),
  languageHint: z.string().nullable(),
  meta: z.record(z.any()).default({}),
});

export type AnalysisDocumentChunk = z.infer<typeof analysisDocumentChunkSchema>;

export const analysisDocumentQualitySchema = z.object({
  extractedTextLength: z.number().int().nonnegative(),
  estimatedPageCount: z.number().int().nonnegative(),
  averageCharsPerPage: z.number().nonnegative(),
  parseMethod: z.enum(["pdf_text", "docx_text", "ocr_fallback", "heuristic"]),
  ocrUsed: z.boolean(),
  ocrConfidence: z.number().min(0).max(1).nullable(),
  parseWarnings: z.array(z.string()),
  languageHints: z.array(z.string()).default([]),
});

export type AnalysisDocumentQuality = z.infer<
  typeof analysisDocumentQualitySchema
>;

export const analysisStageEnvelopeSchema = z.object({
  stageKey: z.string(),
  label: z.string(),
  status: analysisStageStatusSchema,
  usedFallback: z.boolean(),
  degraded: z.boolean(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  elapsedMs: z.number().int().nonnegative().nullable(),
  modelUsage: z
    .object({
      inputTokens: z.number().int().nonnegative().nullable().optional(),
      outputTokens: z.number().int().nonnegative().nullable().optional(),
      model: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  value: z.any().nullable().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
});

export type AnalysisStageEnvelope = z.infer<typeof analysisStageEnvelopeSchema>;

export const analysisMetaSchema = z.object({
  liveVersion: z.string().default("live-v1"),
  shadowVersion: z.string().default("shadow-v2"),
  activeRunId: z.number().int().positive().nullable().default(null),
  latestLiveRunId: z.number().int().positive().nullable().default(null),
  latestShadowRunId: z.number().int().positive().nullable().default(null),
  runStatus: analysisRunStatusSchema.nullable().default(null),
  stageKey: z.string().nullable().default(null),
  retryCount: z.number().int().nonnegative().default(0),
  workerMode: z.enum(["inline", "postgres_worker"]).default("inline"),
  workerEnabled: z.boolean().default(false),
  shadowEnabled: z.boolean().default(false),
  evidenceUiEnabled: z.boolean().default(false),
  webResearchEnabled: z.boolean().default(false),
  liveCutoverEnabled: z.boolean().default(false),
  updatedAt: z.string(),
});

export type AnalysisMeta = z.infer<typeof analysisMetaSchema>;

export const shadowRunStatusSchema = z.enum([
  "not_started",
  "running",
  "complete",
  "failed",
  "manual_review",
]);

export type ShadowRunStatus = z.infer<typeof shadowRunStatusSchema>;

export const shadowStageSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["pending", "running", "complete", "failed"]),
  detail: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
});

export type ShadowStage = z.infer<typeof shadowStageSchema>;

export const shadowValidationIssueSchema = z.object({
  path: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  message: z.string(),
});

export type ShadowValidationIssue = z.infer<typeof shadowValidationIssueSchema>;

export const shadowComparisonCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

export type ShadowComparisonCriterion = z.infer<
  typeof shadowComparisonCriterionSchema
>;

export const shadowScoreFactorSchema = z.object({
  name: z.string(),
  weight: z.number(),
  score: z.number(),
  confidence: z.number().min(0).max(1),
  status: z.enum(["scored", "capped", "insufficient_evidence"]),
  rationale: z.string(),
  evidence: z.array(analysisEvidenceItemSchema).default([]),
});

export type ShadowScoreFactor = z.infer<typeof shadowScoreFactorSchema>;

export const shadowScorecardSchema = z.object({
  fitScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  recommendation: z.enum([
    "Pursue",
    "Pursue with conditions",
    "Borderline",
    "Pass",
    "Manual review",
  ]),
  drivers: z.array(z.string()),
  blockers: z.array(z.string()),
  factorBreakdown: z.array(shadowScoreFactorSchema),
});

export type ShadowScorecard = z.infer<typeof shadowScorecardSchema>;

export const shadowComparisonSummarySchema = z.object({
  generatedAt: z.string(),
  parityStatus: z.enum(["pass", "review", "fail"]),
  scoreDelta: z.number(),
  recommendationChanged: z.boolean(),
  liveRecommendation: z.string().nullable(),
  shadowRecommendation: z.string().nullable(),
  fieldPresence: z.object({
    clientName: z.boolean(),
    projectTitle: z.boolean(),
    deliverables: z.boolean(),
    dates: z.boolean(),
    submissionRequirements: z.boolean(),
    contractTerms: z.boolean(),
  }),
  liveCounts: z.object({
    deliverables: z.number(),
    dates: z.number(),
    highSeverityRisks: z.number(),
    clarificationQuestions: z.number(),
    scopeMatchPct: z.number(),
  }),
  criteriaResults: z.array(shadowComparisonCriterionSchema),
  notes: z.array(z.string()),
});

export type ShadowComparisonSummary = z.infer<
  typeof shadowComparisonSummarySchema
>;

export const shadowClientResearchMetaSchema = z.object({
  sourceType: z.enum([
    "document_only_inference",
    "web_research",
    "mixed",
  ]),
  externalResearchAvailable: z.boolean(),
  sourceCount: z.number().int().nonnegative(),
  averageConfidence: z.number().min(0).max(1).nullable(),
  notes: z.array(z.string()),
});

export type ShadowClientResearchMeta = z.infer<
  typeof shadowClientResearchMetaSchema
>;

export const shadowLiveSnapshotSchema = z.object({
  analysisId: z.number(),
  fileName: z.string(),
  createdAt: z.string(),
  overallScore: z.number().nullable(),
  recommendation: z.string().nullable(),
  fieldPresence: z.object({
    clientName: z.boolean(),
    projectTitle: z.boolean(),
    deliverables: z.boolean(),
    dates: z.boolean(),
    submissionRequirements: z.boolean(),
    contractTerms: z.boolean(),
  }),
  counts: z.object({
    deliverables: z.number(),
    dates: z.number(),
    highSeverityRisks: z.number(),
    clarificationQuestions: z.number(),
    scopeMatchPct: z.number(),
  }),
});

export type ShadowLiveSnapshot = z.infer<typeof shadowLiveSnapshotSchema>;

export const shadowOutputsSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  liveSnapshot: shadowLiveSnapshotSchema,
  documentQuality: analysisDocumentQualitySchema.nullable().optional(),
  stages: z.array(shadowStageSchema),
  validation: z.object({
    valid: z.boolean(),
    issues: z.array(shadowValidationIssueSchema),
  }),
  evidenceIndex: analysisEvidenceIndexSchema,
  sources: z.array(analysisSourceSchema).default([]),
  clientResearchMeta: shadowClientResearchMetaSchema,
  scorecard: shadowScorecardSchema,
  comparisonSummary: shadowComparisonSummarySchema,
});

export type ShadowOutputs = z.infer<typeof shadowOutputsSchema>;

export const baselineSnapshotSchema = z.object({
  generatedAt: z.string(),
  criteriaVersion: z.string(),
  analyses: z.array(shadowLiveSnapshotSchema),
});

export type BaselineSnapshot = z.infer<typeof baselineSnapshotSchema>;

export const shadowPromotionCriteria = [
  {
    id: "high_value_fields",
    label: "High-value fields preserved",
    description:
      "Client, title, deliverables, dates, submission requirements, and contract terms must remain present.",
  },
  {
    id: "high_severity_risks",
    label: "High-severity risks preserved",
    description:
      "The shadow pipeline must not drop high-severity live risks without an explicit review note.",
  },
  {
    id: "score_delta",
    label: "Score delta within 10 points",
    description:
      "Any larger live-to-shadow score change requires a comparison note before promotion.",
  },
  {
    id: "recommendation_stability",
    label: "Recommendation remains stable",
    description:
      "Live recommendation changes should be rare and always traceable to evidence quality.",
  },
] as const;
