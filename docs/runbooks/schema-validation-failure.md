# Schema Validation Failure Runbook

## Trigger
- Contract validation job fails (`contracts:validate`).
- Runtime responses fail JSON schema checks.

## Immediate Actions
1. Identify failing schema and payload path from CI logs.
2. Compare payload against `contracts/schemas/v1/*.schema.json`.
3. Confirm `schemaVersion` and required envelope fields are present.

## Mitigation
1. Roll back to last passing backend deployment if runtime impact is high.
2. If non-breaking, patch serializer and add regression fixture.
3. Prevent partial deploys that change payload contracts without fixture updates.

## Recovery Validation
1. Run `npm --prefix backend run contracts:validate`.
2. Run `npm --prefix backend test` and verify route tests pass.
3. Verify health/version endpoints still return valid envelope.

## Escalation
- Primary: Backend owner on-call.
- Secondary: QA owner for release hold decision.

