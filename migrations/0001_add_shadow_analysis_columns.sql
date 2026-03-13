ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS analysis_version text NOT NULL DEFAULT 'live-v1';

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS shadow_run_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS shadow_outputs jsonb;

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS manual_review_required boolean NOT NULL DEFAULT false;

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS comparison_summary jsonb;
