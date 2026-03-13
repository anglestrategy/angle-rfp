ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS document_quality jsonb;

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS analysis_meta jsonb;

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS review_reasons jsonb;

CREATE TABLE IF NOT EXISTS analysis_runs (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  pipeline_version text NOT NULL,
  trigger text NOT NULL DEFAULT 'upload',
  status text NOT NULL DEFAULT 'queued',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 2,
  attempt_count integer NOT NULL DEFAULT 0,
  current_stage_key text,
  degraded boolean NOT NULL DEFAULT false,
  used_fallback boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  document_quality jsonb,
  review_reasons jsonb,
  meta jsonb,
  requested_at timestamp DEFAULT now(),
  started_at timestamp,
  finished_at timestamp,
  last_heartbeat_at timestamp,
  stale_after_seconds integer NOT NULL DEFAULT 300
);

CREATE TABLE IF NOT EXISTS analysis_payloads (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_content_base64 text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_stage_runs (
  id serial PRIMARY KEY,
  run_id integer NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  label text NOT NULL,
  stage_order integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  used_fallback boolean NOT NULL DEFAULT false,
  degraded boolean NOT NULL DEFAULT false,
  error_code text,
  error_message text,
  elapsed_ms integer,
  model_usage jsonb,
  result_envelope jsonb,
  started_at timestamp,
  finished_at timestamp
);

CREATE TABLE IF NOT EXISTS analysis_chunks (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  run_id integer REFERENCES analysis_runs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_number integer,
  section_label text,
  text text NOT NULL,
  char_start integer,
  char_end integer,
  parse_method text NOT NULL,
  language_hint text,
  meta jsonb
);

CREATE TABLE IF NOT EXISTS analysis_sources (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  run_id integer REFERENCES analysis_runs(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  title text NOT NULL,
  url text,
  domain text,
  published_at timestamp,
  retrieved_at timestamp DEFAULT now(),
  reliability_tier text NOT NULL DEFAULT 'unknown',
  snippet text,
  note text,
  meta jsonb
);

CREATE TABLE IF NOT EXISTS analysis_evidence (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  run_id integer REFERENCES analysis_runs(id) ON DELETE CASCADE,
  source_id integer REFERENCES analysis_sources(id) ON DELETE SET NULL,
  field_path text NOT NULL,
  label text,
  source_kind text NOT NULL,
  snippet text NOT NULL,
  matched_text text,
  page_number integer,
  char_start integer,
  char_end integer,
  clause_reference text,
  confidence real,
  source_url text,
  source_title text,
  note text,
  meta jsonb
);

CREATE INDEX IF NOT EXISTS analysis_runs_analysis_id_idx
  ON analysis_runs (analysis_id, status, requested_at);

CREATE INDEX IF NOT EXISTS analysis_payloads_analysis_id_idx
  ON analysis_payloads (analysis_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analysis_stage_runs_run_id_idx
  ON analysis_stage_runs (run_id, stage_order);

CREATE INDEX IF NOT EXISTS analysis_chunks_analysis_id_idx
  ON analysis_chunks (analysis_id, chunk_index);

CREATE INDEX IF NOT EXISTS analysis_evidence_analysis_id_idx
  ON analysis_evidence (analysis_id, field_path);

CREATE INDEX IF NOT EXISTS analysis_sources_analysis_id_idx
  ON analysis_sources (analysis_id, source_type);
