function readBoolFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export interface AnalysisFeatureFlags {
  analysisWorker: boolean;
  shadowV2: boolean;
  evidenceUi: boolean;
  webResearch: boolean;
  liveV2Cutover: boolean;
  ocrFallback: boolean;
}

export function getAnalysisFeatureFlags(): AnalysisFeatureFlags {
  return {
    analysisWorker: readBoolFlag("FEATURE_ANALYSIS_WORKER", false),
    shadowV2: readBoolFlag("FEATURE_SHADOW_V2", false),
    evidenceUi: readBoolFlag("FEATURE_EVIDENCE_UI", false),
    webResearch: readBoolFlag("FEATURE_WEB_RESEARCH", false),
    liveV2Cutover: readBoolFlag("FEATURE_LIVE_V2_CUTOVER", false),
    ocrFallback: readBoolFlag("FEATURE_OCR_FALLBACK", false),
  };
}

export function getWorkerMode(flags = getAnalysisFeatureFlags()) {
  return flags.analysisWorker ? "postgres_worker" : "inline";
}
