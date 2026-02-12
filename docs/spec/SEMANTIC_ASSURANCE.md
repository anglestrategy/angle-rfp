# Semantic Assurance and High-Stakes Correctness Policy

## 1. Purpose
This document defines how angle/RFP prevents high-impact semantic mistakes in extraction, scope analysis, research synthesis, and scoring.

Core rule:
1. If the system cannot support a critical conclusion with strong evidence, it must abstain/escalate instead of overconfidently guessing.

## 2. Critical Fields
Critical fields requiring strict assurance:
1. `clientName`
2. `projectName`
3. `scopeOfWork`
4. `evaluationCriteria`
5. `requiredDeliverables`
6. `importantDates`
7. recommendation text and recommendation level

## 3. Evidence Requirements

### 3.1 Evidence Structure
Every critical field should map to:
1. source reference (`page`, `excerpt`, `sourceType`)
2. extraction method (`verbatim`, `inferred`, `resolved_conflict`)
3. confidence score and evidence density score

### 3.2 Minimum Evidence Density Thresholds
1. `clientName` >= 0.85
2. `projectName` >= 0.80
3. `scopeOfWork` >= 0.75
4. `evaluationCriteria` >= 0.80
5. `requiredDeliverables` >= 0.80 for verbatim items
6. `importantDates` >= 0.90 for hard deadlines

Behavior:
1. If below threshold, mark field `insufficient_evidence`.
2. If critical field unresolved, recommendation cannot be final-high-confidence.

## 4. Confidence Model

### 4.1 Composite Confidence
Per-field confidence = weighted blend of:
1. extraction confidence
2. verification consistency
3. contradiction penalties
4. evidence density

### 4.2 Confidence Buckets
1. `high` >= 0.85
2. `medium` >= 0.70 and < 0.85
3. `low` < 0.70

### 4.3 Operational Rules
1. `low` on any critical field triggers `qualityFlags` entry.
2. multiple medium+ conflicts trigger adjudication pass.
3. unresolved conflict after adjudication triggers escalation warning.

## 5. Cross-Model Adjudication

### 5.1 When Adjudication Runs
Run second-model adjudication when any of these conditions occur:
1. parse/extraction conflict on critical fields.
2. confidence below threshold on critical fields.
3. contradictory values across sections/tables/providers.

### 5.2 Adjudication Output Contract
Each adjudicated field must return:
1. selected value
2. competing candidates
3. reason for selection
4. confidence delta
5. evidence citations used

### 5.3 Failure Policy
If adjudicator fails or disagreement remains unresolved:
1. return safest deterministic fallback.
2. flag `cross_model_disagreement`.
3. keep `partialResult=true` if materially impacting recommendation quality.

## 6. Scope-Specific Assurance

### 6.1 Classification Set
Use:
1. `full`
2. `partial`
3. `none`
4. `uncertain` (new)

### 6.2 Percentage Computation Rules
1. `full` contributes fully to agency fit.
2. `partial` contributes with configured partial weight.
3. `none` contributes to outsourcing.
4. `uncertain` excluded from denominator by default and surfaced separately.

### 6.3 Capability Profile Policy
Do not hardcode universal exclusions. Use profile config.

Config file family:
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/config/capabilities/default.yaml`
2. `/Users/Faisal/Documents/New project/angle-rfp/backend/config/capabilities/*.yaml`

Example shape:
```yaml
profile: default
supports:
  market_research: false
  media_buying_execution: false
  media_buying_supervision: true
  video_production_execution: false
  video_production_supervision: true
partial_weight: 0.5
uncertain_handling:
  exclude_from_percentage: true
  escalate_if_count_gte: 3
```

## 7. Beautification Assurance

### 7.1 Scope Boundary Rules
Beautified `scopeOfWork` must never include:
1. submission instructions
2. evaluation rubric text
3. timeline admin milestones
4. legal/commercial boilerplate
5. markdown fence noise

### 7.2 Required Output Sections
Dashboard payload must maintain:
1. `Executive Summary` section (summary content)
2. `Scope Analysis` section (classification and percentages)

Prohibited:
1. long phase dumps under scope analysis
2. duplicate section heading contamination

### 7.3 Validator Actions
When validator detects contamination:
1. strip contaminated lines.
2. regenerate deterministic scope bullet list.
3. add warning `quality_degraded: scope_boundary_violation`.

## 8. Research Assurance
1. Normalize provider claims to source-tiered claims.
2. Resolve conflicts with trust hierarchy and freshness windows.
3. Cap confidence for stale-only evidence.
4. Require minimum independent source count before high-confidence claims.
5. If only weak sources available, mark `insufficient_evidence` and avoid hard conclusions.

## 9. Scoring Assurance
1. Factor status must be explicit: `scored`, `na`, `insufficient_evidence`.
2. Missing evidence does not auto-convert to zero unless policy explicitly says so.
3. Recommendation output must include top positive drivers and top uncertainty drivers.
4. If critical uncertainty unresolved, recommendation text must explicitly state review requirement.

## 10. Quality Flags Taxonomy
Planned `qualityFlags` values:
1. `insufficient_evidence`
2. `scope_boundary_violation`
3. `cross_model_disagreement`
4. `provider_volatility`
5. `high_conflict_density`
6. `stale_research_only`

## 11. Human Review Escalation Policy
Mandatory human review if any of the following:
1. unresolved conflict on submission deadline.
2. unresolved conflict on evaluation criteria weighting.
3. more than 3 `uncertain` scope items.
4. recommendation requested while any critical field is low-confidence.

## 12. Test Gates for Semantic Assurance
1. Critical-field evidence threshold tests.
2. Cross-model disagreement simulation tests.
3. Scope contamination regression tests.
4. Deadline conflict resolution tests.
5. Recommendation suppression tests under unresolved uncertainty.

## 13. Implementation Files to Touch
Primary code files:
1. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/extraction/analyze-rfp.ts`
2. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/extraction/passes/pass1-extract.ts`
3. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/extraction/text-beautifier.ts`
4. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/scope/analyze-scope.ts`
5. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/scope/matcher.ts`
6. `/Users/Faisal/Documents/New project/angle-rfp/backend/src/lib/scoring/calculate-score.ts`

Contracts and app decode updates:
1. `/Users/Faisal/Documents/New project/angle-rfp/contracts/schemas/v1/*`
2. `/Users/Faisal/Documents/New project/angle-rfp/contracts/openapi/angle-rfp-v1.yaml`
3. `/Users/Faisal/Documents/New project/angle-rfp/angle-rfp/Models/API/BackendContractsV1.swift`
