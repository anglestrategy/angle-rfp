DROP INDEX IF EXISTS analysis_sources_analysis_id_idx;
DROP INDEX IF EXISTS analysis_evidence_analysis_id_idx;
DROP INDEX IF EXISTS analysis_chunks_analysis_id_idx;
DROP INDEX IF EXISTS analysis_stage_runs_run_id_idx;
DROP INDEX IF EXISTS analysis_payloads_analysis_id_idx;
DROP INDEX IF EXISTS analysis_runs_analysis_id_idx;

DROP TABLE IF EXISTS analysis_evidence;
DROP TABLE IF EXISTS analysis_sources;
DROP TABLE IF EXISTS analysis_chunks;
DROP TABLE IF EXISTS analysis_stage_runs;
DROP TABLE IF EXISTS analysis_payloads;
DROP TABLE IF EXISTS analysis_runs;

ALTER TABLE rfp_analyses
  DROP COLUMN IF EXISTS review_reasons;

ALTER TABLE rfp_analyses
  DROP COLUMN IF EXISTS analysis_meta;

ALTER TABLE rfp_analyses
  DROP COLUMN IF EXISTS document_quality;
