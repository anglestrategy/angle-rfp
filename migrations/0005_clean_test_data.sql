-- One-time cleanup of test data from staging
DELETE FROM pursuit_outcomes;
DELETE FROM pursuit_decisions;
DELETE FROM credential_suggestions;
DELETE FROM workspace_credentials;
DELETE FROM client_memory;
DELETE FROM workspace_preferences_history;
DELETE FROM analysis_evidence;
DELETE FROM analysis_sources;
DELETE FROM analysis_chunks;
DELETE FROM analysis_stage_runs;
DELETE FROM analysis_runs;
DELETE FROM analysis_payloads;
DELETE FROM rfp_analyses;

-- Reset agency profiles to blank
UPDATE agency_profiles SET calibration = '{}'::jsonb, status = 'not_started';
UPDATE workspaces SET onboarding_status = 'not_started';

-- Remove test user accounts (keep only real ones)
DELETE FROM workspace_memberships WHERE user_id IN (
  SELECT id FROM users WHERE username LIKE '%test%' OR username LIKE '%smoketest%' OR username LIKE '%curltest%' OR username LIKE '%deploy-test%' OR username LIKE '%staging@%'
);
DELETE FROM users WHERE username LIKE '%test%' OR username LIKE '%smoketest%' OR username LIKE '%curltest%' OR username LIKE '%deploy-test%' OR username LIKE '%staging@%';

-- Clean up orphaned workspaces with no members
DELETE FROM workspace_domains WHERE workspace_id IN (
  SELECT w.id FROM workspaces w LEFT JOIN workspace_memberships wm ON w.id = wm.workspace_id WHERE wm.id IS NULL
);
DELETE FROM agency_profiles WHERE workspace_id IN (
  SELECT w.id FROM workspaces w LEFT JOIN workspace_memberships wm ON w.id = wm.workspace_id WHERE wm.id IS NULL
);
DELETE FROM workspaces WHERE id IN (
  SELECT w.id FROM workspaces w LEFT JOIN workspace_memberships wm ON w.id = wm.workspace_id WHERE wm.id IS NULL
);
