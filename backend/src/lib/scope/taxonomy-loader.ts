import { promises as fs } from "node:fs";
import path from "node:path";

export interface AgencyService {
  id: string;
  category: string;
  service: string;
  normalized: string;
}

const taxonomyCandidates = [
  // Vercel/production: the CSV is vendored into the backend workspace root.
  path.resolve(process.cwd(), "agencyservicesheet.csv"),
  // Local/dev: allow monorepo root (one level above backend/) as a fallback.
  path.resolve(process.cwd(), "..", "agencyservicesheet.csv")
];

async function resolveTaxonomyPath(): Promise<string> {
  for (const candidate of taxonomyCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  // Surface the most helpful error by using the first candidate path.
  return taxonomyCandidates[0]!;
}

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buffer = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }

  out.push(buffer.trim());
  return out;
}

let cached: AgencyService[] | null = null;

export async function loadAgencyTaxonomy(): Promise<AgencyService[]> {
  if (cached) {
    return cached;
  }

  const taxonomyPath = await resolveTaxonomyPath();
  const raw = await fs.readFile(taxonomyPath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trimEnd());

  const services: AgencyService[] = [];
  let currentCategory = "uncategorized";
  let idCounter = 1;

  for (const line of lines) {
    if (!line || /SERVICES WITHIN AGENCY SCOPE/i.test(line) || /^CATEGORY\s*,\s*SERVICE/i.test(line)) {
      continue;
    }

    const [categoryCell, serviceCell] = parseCsvLine(line);
    const service = (serviceCell ?? "").trim();
    const categoryRaw = (categoryCell ?? "").trim();

    if (categoryRaw) {
      currentCategory = categoryRaw;
    }

    if (!service) {
      continue;
    }

    services.push({
      id: String(idCounter++),
      category: currentCategory,
      service,
      normalized: normalize(service)
    });
  }

  cached = services;
  return services;
}

export function taxonomyVersionFromServices(services: AgencyService[]): string {
  const payload = services.map((item) => `${item.category}:${item.service}`).join("|");
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return `csv-${hash.toString(16)}`;
}

export function clearTaxonomyCacheForTests(): void {
  cached = null;
}

export function normalizeForMatching(text: string): string {
  return normalize(text);
}
