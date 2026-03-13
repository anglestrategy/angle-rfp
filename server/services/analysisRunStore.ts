import { pool } from "../db";
import { storage } from "../storage";
import type {
  AnalysisDocumentChunk,
  AnalysisDocumentQuality,
  AnalysisEvidenceItem,
  AnalysisMeta,
  AnalysisSource,
  AnalysisStageEnvelope,
  AnalysisRunStatus,
} from "@shared/models/analysis";
import { analysisMetaSchema } from "@shared/models/analysis";

export interface StageDefinition {
  key: string;
  label: string;
  order: number;
}

const PIPELINE_STAGES: Record<string, StageDefinition[]> = {
  "live-v1": [
    { key: "parse_document", label: "Parse document", order: 1 },
    { key: "core_extraction", label: "Core extraction", order: 2 },
    { key: "verification", label: "Verification", order: 3 },
    { key: "risk_analysis", label: "Risk analysis", order: 4 },
    { key: "completeness", label: "Completeness review", order: 5 },
    { key: "scope_matching", label: "Scope matching", order: 6 },
    { key: "client_research", label: "Client research", order: 7 },
    { key: "financial_scoring", label: "Financial scoring", order: 8 },
  ],
  "shadow-v2": [
    { key: "document_model", label: "Document model", order: 1 },
    { key: "evidence_index", label: "Evidence index", order: 2 },
    { key: "shadow_scorecard", label: "Shadow scorecard", order: 3 },
    { key: "comparison", label: "Comparison", order: 4 },
  ],
};

function getPipelineStages(pipelineVersion: string): StageDefinition[] {
  return PIPELINE_STAGES[pipelineVersion] || [];
}

function toJsonb<T>(value: T | null | undefined): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

async function loadAnalysisMeta(analysisId: number): Promise<AnalysisMeta> {
  const analysis = await storage.getAnalysis(analysisId);
  const parsed = analysisMetaSchema.safeParse(analysis?.analysisMeta || {
    updatedAt: new Date().toISOString(),
  });

  if (parsed.success) return parsed.data;

  return analysisMetaSchema.parse({
    updatedAt: new Date().toISOString(),
    activeRunId: null,
    latestLiveRunId: null,
    latestShadowRunId: null,
    runStatus: null,
  });
}

export async function updateAnalysisMeta(
  analysisId: number,
  patch: Partial<AnalysisMeta>,
) {
  const current = await loadAnalysisMeta(analysisId);
  const sanitizedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
  const next = analysisMetaSchema.parse({
    ...current,
    ...sanitizedPatch,
    updatedAt: new Date().toISOString(),
  });

  await storage.updateAnalysis(analysisId, {
    analysisMeta: next,
  });

  return next;
}

export async function createAnalysisRun(input: {
  analysisId: number;
  pipelineVersion: string;
  trigger?: string;
  maxRetries?: number;
  meta?: Record<string, unknown>;
}) {
  const result = await pool.query(
    `
      INSERT INTO analysis_runs (
        analysis_id,
        pipeline_version,
        trigger,
        max_retries,
        meta
      )
      VALUES ($1, $2, COALESCE($3, 'upload'), COALESCE($4, 2), $5)
      RETURNING *
    `,
    [
      input.analysisId,
      input.pipelineVersion,
      input.trigger ?? "upload",
      input.maxRetries ?? 2,
      toJsonb(input.meta ?? {}),
    ],
  );

  const run = result.rows[0];
  const stages = getPipelineStages(input.pipelineVersion);
  for (const stage of stages) {
    await pool.query(
      `
        INSERT INTO analysis_stage_runs (
          run_id,
          analysis_id,
          stage_key,
          label,
          stage_order,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'pending')
      `,
      [run.id, input.analysisId, stage.key, stage.label, stage.order],
    );
  }

  const metaPatch: Partial<AnalysisMeta> = {
    activeRunId: run.id,
    runStatus: "queued",
    stageKey: null,
    retryCount: run.retry_count ?? 0,
  };

  if (input.pipelineVersion === "live-v1") {
    metaPatch.latestLiveRunId = run.id;
  } else if (input.pipelineVersion === "shadow-v2") {
    metaPatch.latestShadowRunId = run.id;
  }

  await updateAnalysisMeta(input.analysisId, metaPatch);
  return run;
}

export async function persistAnalysisPayload(input: {
  analysisId: number;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) {
  await pool.query(`DELETE FROM analysis_payloads WHERE analysis_id = $1`, [
    input.analysisId,
  ]);

  await pool.query(
    `
      INSERT INTO analysis_payloads (
        analysis_id,
        file_name,
        mime_type,
        file_content_base64
      )
      VALUES ($1, $2, $3, $4)
    `,
    [
      input.analysisId,
      input.fileName,
      input.mimeType,
      input.fileBuffer.toString("base64"),
    ],
  );
}

export async function loadAnalysisPayload(analysisId: number) {
  const result = await pool.query(
    `
      SELECT *
      FROM analysis_payloads
      WHERE analysis_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [analysisId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...row,
    fileBuffer: Buffer.from(row.file_content_base64, "base64"),
  };
}

export async function markRunStarted(runId: number, analysisId: number, stageKey?: string | null) {
  const result = await pool.query(
    `
      UPDATE analysis_runs
      SET
        status = 'running',
        current_stage_key = $2,
        started_at = COALESCE(started_at, now()),
        last_heartbeat_at = now(),
        attempt_count = attempt_count + 1
      WHERE id = $1
      RETURNING *
    `,
    [runId, stageKey ?? null],
  );

  await updateAnalysisMeta(analysisId, {
    activeRunId: runId,
    runStatus: "running",
    stageKey: stageKey ?? null,
    retryCount: result.rows[0]?.retry_count ?? 0,
  });

  return result.rows[0];
}

export async function heartbeatRun(runId: number) {
  await pool.query(
    `
      UPDATE analysis_runs
      SET last_heartbeat_at = now()
      WHERE id = $1
    `,
    [runId],
  );
}

export async function markRunStage(
  runId: number,
  analysisId: number,
  envelope: AnalysisStageEnvelope,
) {
  await pool.query(
    `
      UPDATE analysis_stage_runs
      SET
        status = $4,
        retry_count = $5,
        used_fallback = $6,
        degraded = $7,
        error_code = $8,
        error_message = $9,
        elapsed_ms = $10,
        model_usage = $11,
        result_envelope = $12,
        started_at = COALESCE($13::timestamp, started_at),
        finished_at = COALESCE($14::timestamp, finished_at)
      WHERE run_id = $1 AND analysis_id = $2 AND stage_key = $3
    `,
    [
      runId,
      analysisId,
      envelope.stageKey,
      envelope.status,
      envelope.retryCount ?? 0,
      envelope.usedFallback,
      envelope.degraded,
      envelope.errorCode,
      envelope.errorMessage,
      envelope.elapsedMs,
      toJsonb(envelope.modelUsage ?? null),
      toJsonb(envelope),
      envelope.startedAt ?? null,
      envelope.finishedAt ?? null,
    ],
  );

  await pool.query(
    `
      UPDATE analysis_runs
      SET
        current_stage_key = $2,
        degraded = degraded OR $3,
        used_fallback = used_fallback OR $4,
        last_heartbeat_at = now()
      WHERE id = $1
    `,
    [runId, envelope.stageKey, envelope.degraded, envelope.usedFallback],
  );

  await updateAnalysisMeta(analysisId, {
    activeRunId: runId,
    runStatus: "running",
    stageKey: envelope.stageKey,
  });
}

export async function markRunFinished(input: {
  runId: number;
  analysisId: number;
  status: AnalysisRunStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  degraded?: boolean;
  usedFallback?: boolean;
  documentQuality?: AnalysisDocumentQuality | null;
  reviewReasons?: string[];
}) {
  const result = await pool.query(
    `
      UPDATE analysis_runs
      SET
        status = $2,
        error_code = $3,
        error_message = $4,
        degraded = COALESCE($5, degraded),
        used_fallback = COALESCE($6, used_fallback),
        document_quality = COALESCE($7, document_quality),
        review_reasons = COALESCE($8, review_reasons),
        finished_at = now(),
        last_heartbeat_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [
      input.runId,
      input.status,
      input.errorCode ?? null,
      input.errorMessage ?? null,
      input.degraded ?? null,
      input.usedFallback ?? null,
      toJsonb(input.documentQuality ?? null),
      toJsonb(input.reviewReasons ?? null),
    ],
  );

  await updateAnalysisMeta(input.analysisId, {
    activeRunId: null,
    runStatus: input.status,
    stageKey: null,
    retryCount: result.rows[0]?.retry_count ?? 0,
  });

  return result.rows[0];
}

export async function incrementRunRetry(runId: number) {
  const result = await pool.query(
    `
      UPDATE analysis_runs
      SET retry_count = retry_count + 1, last_heartbeat_at = now()
      WHERE id = $1
      RETURNING retry_count
    `,
    [runId],
  );

  return result.rows[0]?.retry_count ?? 0;
}

export async function requeueRun(input: {
  runId: number;
  analysisId: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const result = await pool.query(
    `
      UPDATE analysis_runs
      SET
        status = 'queued',
        current_stage_key = NULL,
        error_code = $2,
        error_message = $3,
        last_heartbeat_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [input.runId, input.errorCode ?? null, input.errorMessage ?? null],
  );

  await updateAnalysisMeta(input.analysisId, {
    activeRunId: input.runId,
    runStatus: "queued",
    stageKey: null,
    retryCount: result.rows[0]?.retry_count ?? 0,
  });

  return result.rows[0];
}

export async function persistDocumentModel(
  analysisId: number,
  runId: number,
  documentQuality: AnalysisDocumentQuality,
  chunks: AnalysisDocumentChunk[],
) {
  await pool.query(`DELETE FROM analysis_chunks WHERE run_id = $1`, [runId]);

  for (const chunk of chunks) {
    await pool.query(
      `
        INSERT INTO analysis_chunks (
          analysis_id,
          run_id,
          chunk_index,
          page_number,
          section_label,
          text,
          char_start,
          char_end,
          parse_method,
          language_hint,
          meta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        analysisId,
        runId,
        chunk.chunkIndex,
        chunk.pageNumber,
        chunk.sectionLabel,
        chunk.text,
        chunk.charStart,
        chunk.charEnd,
        chunk.parseMethod,
        chunk.languageHint,
        toJsonb(chunk.meta ?? {}),
      ],
    );
  }

  await storage.updateAnalysis(analysisId, {
    documentQuality,
  });
}

export async function persistSources(
  analysisId: number,
  runId: number,
  sources: AnalysisSource[],
) {
  await pool.query(`DELETE FROM analysis_sources WHERE run_id = $1`, [runId]);

  for (const source of sources) {
    await pool.query(
      `
        INSERT INTO analysis_sources (
          analysis_id,
          run_id,
          source_type,
          title,
          url,
          domain,
          published_at,
          retrieved_at,
          reliability_tier,
          snippet,
          note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8::timestamp, $9, $10, $11)
      `,
      [
        analysisId,
        runId,
        source.sourceType,
        source.title,
        source.url ?? null,
        source.domain ?? null,
        source.publishedAt ?? null,
        source.retrievedAt,
        source.reliabilityTier,
        source.snippet ?? null,
        source.note ?? null,
      ],
    );
  }
}

export async function persistEvidenceIndex(
  analysisId: number,
  runId: number,
  evidenceIndex: Record<string, AnalysisEvidenceItem[]>,
) {
  await pool.query(`DELETE FROM analysis_evidence WHERE run_id = $1`, [runId]);

  for (const [fieldPath, evidenceItems] of Object.entries(evidenceIndex)) {
    for (const item of evidenceItems) {
      await pool.query(
        `
          INSERT INTO analysis_evidence (
            analysis_id,
            run_id,
            source_id,
            field_path,
            label,
            source_kind,
            snippet,
            matched_text,
            page_number,
            char_start,
            char_end,
            clause_reference,
            confidence,
            source_url,
            source_title,
            note,
            meta
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `,
        [
          analysisId,
          runId,
          item.sourceId ?? null,
          fieldPath,
          item.label ?? null,
          item.sourceKind,
          item.snippet,
          item.matchedText ?? null,
          item.page ?? null,
          item.charStart ?? null,
          item.charEnd ?? null,
          item.clauseReference ?? null,
          item.confidence ?? null,
          item.sourceUrl ?? null,
          item.sourceTitle ?? null,
          item.note ?? null,
          toJsonb({}),
        ],
      );
    }
  }
}

export async function claimNextQueuedRun() {
  const result = await pool.query(
    `
      WITH candidate AS (
        SELECT id
        FROM analysis_runs
        WHERE
          status = 'queued'
          OR (
            status = 'running'
            AND last_heartbeat_at IS NOT NULL
            AND last_heartbeat_at < now() - make_interval(secs => stale_after_seconds)
          )
        ORDER BY requested_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE analysis_runs r
      SET
        status = 'running',
        started_at = COALESCE(r.started_at, now()),
        last_heartbeat_at = now(),
        attempt_count = r.attempt_count + 1
      FROM candidate
      WHERE r.id = candidate.id
      RETURNING r.*
    `,
  );

  return result.rows[0] ?? null;
}

export async function listRunStages(runId: number) {
  const result = await pool.query(
    `
      SELECT *
      FROM analysis_stage_runs
      WHERE run_id = $1
      ORDER BY stage_order ASC
    `,
    [runId],
  );

  return result.rows;
}

export async function getRunById(runId: number) {
  const result = await pool.query(
    `
      SELECT *
      FROM analysis_runs
      WHERE id = $1
      LIMIT 1
    `,
    [runId],
  );

  return result.rows[0] ?? null;
}
