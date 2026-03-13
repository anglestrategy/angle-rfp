ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rfp_analyses_user_id_idx ON rfp_analyses(user_id);
