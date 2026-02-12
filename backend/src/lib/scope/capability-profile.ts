import angleAgencyProfile from "@/lib/scope/capability-profiles/angle-agency.json";
import defaultProfile from "@/lib/scope/capability-profiles/default.json";
import fullServiceProfile from "@/lib/scope/capability-profiles/full-service.json";

export interface AgencyCapabilityProfile {
  name: string;
  supportsMarketResearch: boolean | null;
}

type ProfileSource = "env_override" | "profile" | "taxonomy";

const PROFILE_MAP: Record<string, AgencyCapabilityProfile> = {
  "default": {
    name: "default",
    supportsMarketResearch: defaultProfile.supportsMarketResearch
  },
  "angle-agency": {
    name: "angle-agency",
    supportsMarketResearch: angleAgencyProfile.supportsMarketResearch
  },
  "full-service": {
    name: "full-service",
    supportsMarketResearch: fullServiceProfile.supportsMarketResearch
  }
};

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function selectedProfileName(): string {
  const env = process.env.AGENCY_CAPABILITY_PROFILE?.trim().toLowerCase();
  if (env && PROFILE_MAP[env]) {
    return env;
  }
  return "angle-agency";
}

function resolveProfile(): AgencyCapabilityProfile {
  return PROFILE_MAP[selectedProfileName()] ?? PROFILE_MAP["default"];
}

export function resolveMarketResearchSupport(taxonomySupports: boolean): {
  supported: boolean;
  source: ProfileSource;
  profile: string;
} {
  const envOverride = parseBoolean(process.env.AGENCY_SUPPORTS_MARKET_RESEARCH);
  const profile = resolveProfile();

  if (envOverride !== null) {
    return {
      supported: envOverride,
      source: "env_override",
      profile: profile.name
    };
  }

  if (profile.supportsMarketResearch !== null) {
    return {
      supported: profile.supportsMarketResearch,
      source: "profile",
      profile: profile.name
    };
  }

  return {
    supported: taxonomySupports,
    source: "taxonomy",
    profile: profile.name
  };
}

export function loadCapabilityProfile(taxonomySupports: boolean): AgencyCapabilityProfile {
  const resolved = resolveMarketResearchSupport(taxonomySupports);
  return {
    name: resolved.profile,
    supportsMarketResearch: resolved.supported
  };
}
