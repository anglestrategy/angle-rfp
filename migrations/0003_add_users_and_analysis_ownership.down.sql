DROP INDEX IF EXISTS rfp_analyses_user_id_idx;

ALTER TABLE rfp_analyses
  DROP COLUMN IF EXISTS user_id;

ALTER TABLE users
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS created_at;
