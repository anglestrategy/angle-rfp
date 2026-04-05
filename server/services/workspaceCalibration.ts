import type { AgencyProfile, ClientMemory, WorkspaceCredential } from "@shared/schema";

export interface AgencyCalibration {
  coreServices: string[];
  preferredSectors: string[];
  minimumBudget: string;
  idealProjectSize: string;
  idealTimelineBand: string;
  riskRedLines: string[];
  pitchEffortTolerance: "low" | "moderate" | "high";
  preferredClientTypes: string[];
  saudiComplianceSensitivity: "low" | "moderate" | "high";
  teamSize: string;
}

export interface AgencyCalibrationContext {
  calibration: AgencyCalibration | null;
  credentials: WorkspaceCredential[];
  clientMemory: ClientMemory[];
  calibrationState: "default" | "partial" | "full";
}

export const DEFAULT_CALIBRATION: AgencyCalibration = {
  coreServices: [],
  preferredSectors: [],
  minimumBudget: "",
  idealProjectSize: "",
  idealTimelineBand: "",
  riskRedLines: [],
  pitchEffortTolerance: "moderate",
  preferredClientTypes: [],
  saudiComplianceSensitivity: "moderate",
  teamSize: "",
};

export function buildCalibrationContext(input: {
  profile?: AgencyProfile | null;
  credentials?: WorkspaceCredential[] | null;
  clientMemory?: ClientMemory[] | null;
}): AgencyCalibrationContext {
  const raw = (input.profile?.calibration || {}) as Partial<AgencyCalibration>;
  const calibration: AgencyCalibration = {
    ...DEFAULT_CALIBRATION,
    ...raw,
    coreServices: Array.isArray(raw.coreServices) ? raw.coreServices : [],
    preferredSectors: Array.isArray(raw.preferredSectors) ? raw.preferredSectors : [],
    riskRedLines: Array.isArray(raw.riskRedLines) ? raw.riskRedLines : [],
    preferredClientTypes: Array.isArray(raw.preferredClientTypes) ? raw.preferredClientTypes : [],
  };

  const meaningfulFields = [
    calibration.coreServices.length > 0,
    calibration.preferredSectors.length > 0,
    Boolean(calibration.minimumBudget),
    Boolean(calibration.pitchEffortTolerance),
    calibration.riskRedLines.length > 0,
    calibration.preferredClientTypes.length > 0,
  ].filter(Boolean).length;

  const calibrationState: AgencyCalibrationContext["calibrationState"] =
    meaningfulFields >= 5
      ? "full"
      : meaningfulFields >= 2
        ? "partial"
        : "default";

  return {
    calibration,
    credentials: input.credentials ?? [],
    clientMemory: input.clientMemory ?? [],
    calibrationState,
  };
}

export function normalizeClientKey(clientName?: string | null) {
  return String(clientName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
