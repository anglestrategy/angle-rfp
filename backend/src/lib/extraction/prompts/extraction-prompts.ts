export const EXTRACTION_PROMPT_VERSIONS = {
  pass1: "extract.pass1.fields.v1",
  pass2: "extract.pass2.verify.v1",
  pass3: "extract.pass3.redflags.v1",
  pass4: "extract.pass4.completeness.v1",
  pass5: "extract.pass5.conflicts.v1"
} as const;

export function extractionPromptMetadata() {
  return {
    versions: EXTRACTION_PROMPT_VERSIONS,
    strategy: "Deterministic local extraction fallback"
  };
}
