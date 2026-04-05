ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, now())
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS workspaces (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  primary_domain text NOT NULL UNIQUE,
  onboarding_status text NOT NULL DEFAULT 'not_started',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_domains (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'verified',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agency_profiles (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  calibration jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_started',
  updated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

ALTER TABLE rfp_analyses
  ADD COLUMN IF NOT EXISTS workspace_id varchar REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS workspace_credentials (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  sectors jsonb NOT NULL DEFAULT '[]'::jsonb,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  formats jsonb NOT NULL DEFAULT '[]'::jsonb,
  case_study_text text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credential_suggestions (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_analysis_id integer REFERENCES rfp_analyses(id) ON DELETE SET NULL,
  source_note text,
  extracted_summary text NOT NULL,
  proposed_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_status text NOT NULL DEFAULT 'draft',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_memory (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  normalized_client_key text NOT NULL,
  quality_rating text NOT NULL DEFAULT 'unknown',
  bad_fit_flag boolean NOT NULL DEFAULT false,
  notes text,
  last_touched_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_preferences_history (
  id serial PRIMARY KEY,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  calibration_snapshot jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pursuit_decisions (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  system_recommendation text NOT NULL,
  user_decision text NOT NULL,
  override_reason text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pursuit_outcomes (
  id serial PRIMARY KEY,
  analysis_id integer NOT NULL REFERENCES rfp_analyses(id) ON DELETE CASCADE,
  workspace_id varchar NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  outcome text NOT NULL,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_memberships_user_id_idx ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS workspace_memberships_workspace_id_idx ON workspace_memberships(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_memberships_workspace_user_uidx ON workspace_memberships(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS agency_profiles_workspace_id_idx ON agency_profiles(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS agency_profiles_workspace_uidx ON agency_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS rfp_analyses_workspace_id_idx ON rfp_analyses(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_credentials_workspace_id_idx ON workspace_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS credential_suggestions_workspace_id_idx ON credential_suggestions(workspace_id);
CREATE INDEX IF NOT EXISTS client_memory_workspace_id_idx ON client_memory(workspace_id);
CREATE INDEX IF NOT EXISTS client_memory_client_key_idx ON client_memory(workspace_id, normalized_client_key);
CREATE UNIQUE INDEX IF NOT EXISTS client_memory_workspace_client_uidx ON client_memory(workspace_id, normalized_client_key);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS email_verification_tokens_token_hash_idx ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS pursuit_decisions_analysis_id_idx ON pursuit_decisions(analysis_id);
CREATE INDEX IF NOT EXISTS pursuit_outcomes_analysis_id_idx ON pursuit_outcomes(analysis_id);

INSERT INTO workspaces (name, slug, primary_domain, onboarding_status)
SELECT DISTINCT
  initcap(split_part(split_part(username, '@', 2), '.', 1)) AS name,
  regexp_replace(split_part(username, '@', 2), '[^a-zA-Z0-9]+', '-', 'g') AS slug,
  split_part(username, '@', 2) AS primary_domain,
  'completed'
FROM users
WHERE username LIKE '%@%'
ON CONFLICT (primary_domain) DO NOTHING;

INSERT INTO workspace_domains (workspace_id, domain, is_primary, status)
SELECT w.id, w.primary_domain, true, 'verified'
FROM workspaces w
ON CONFLICT (domain) DO NOTHING;

INSERT INTO agency_profiles (workspace_id, calibration, status)
SELECT w.id, '{}'::jsonb, 'completed'
FROM workspaces w
ON CONFLICT (workspace_id) DO NOTHING;

INSERT INTO workspace_memberships (workspace_id, user_id, role)
SELECT
  w.id,
  u.id,
  CASE
    WHEN row_number() OVER (PARTITION BY w.id ORDER BY u.created_at, u.id) = 1 THEN 'owner'
    ELSE 'member'
  END AS role
FROM users u
JOIN workspaces w
  ON w.primary_domain = split_part(u.username, '@', 2)
WHERE u.username LIKE '%@%'
ON CONFLICT (workspace_id, user_id) DO NOTHING;

UPDATE rfp_analyses a
SET workspace_id = w.id
FROM users u
JOIN workspaces w ON w.primary_domain = split_part(u.username, '@', 2)
WHERE a.user_id = u.id
  AND a.workspace_id IS NULL;
