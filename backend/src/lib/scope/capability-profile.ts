export interface AgencyCapabilityProfile {
  supportsMarketResearch: boolean;
}

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

export function resolveMarketResearchSupport(taxonomySupports: boolean): {
  supported: boolean;
  source: "env_override" | "taxonomy";
} {
  const env = parseBoolean(process.env.AGENCY_SUPPORTS_MARKET_RESEARCH);
  if (env !== null) {
    return {
      supported: env,
      source: "env_override"
    };
  }

  return {
    supported: taxonomySupports,
    source: "taxonomy"
  };
}

export function loadCapabilityProfile(taxonomySupports: boolean): AgencyCapabilityProfile {
  return {
    supportsMarketResearch: resolveMarketResearchSupport(taxonomySupports).supported
  };
}
