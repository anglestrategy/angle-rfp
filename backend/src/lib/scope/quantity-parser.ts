export interface OutputQuantities {
  videoProduction: number | null;
  motionGraphics: number | null;
  visualDesign: number | null;
  contentOnly: number | null;
}

function parseCandidateValue(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value <= 0 || value > 300) {
    return null;
  }

  return Math.round(value);
}

function extractMaxCount(text: string, patterns: RegExp[]): number | null {
  let max: number | null = null;

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const raw = match[1] ?? match[2];
      if (!raw) {
        continue;
      }

      const parsed = parseCandidateValue(raw);
      if (parsed === null) {
        continue;
      }

      if (max === null || parsed > max) {
        max = parsed;
      }
    }
  }

  return max;
}

export function parseOutputQuantities(scopeOfWork: string): OutputQuantities {
  const lowered = scopeOfWork.toLowerCase();

  const video = extractMaxCount(lowered, [
    /(?:x|×)\s*(\d{1,3})\s*(?:videos?|films?)/gi,
    /(\d{1,3})\s*(?:x|×)\s*(?:videos?|films?)/gi,
    /(\d{1,3})\s+(?:hero\s+)?(?:videos?|films?)/gi,
    /(?:videos?|films?)\s*(?:x|×)\s*(\d{1,3})/gi,
    /(?:videos?|films?)\s*[:\-]?\s*(\d{1,3})/gi
  ]);

  const motion = extractMaxCount(lowered, [
    /(?:x|×)\s*(\d{1,3})\s*(?:animated|motion)\s+(?:posts?|assets?|graphics?)/gi,
    /(\d{1,3})\s*(?:x|×)\s*(?:animated|motion)\s+(?:posts?|assets?|graphics?)/gi,
    /(\d{1,3})\s+(?:animated|motion)\s+(?:posts?|assets?|graphics?)/gi,
    /(?:animated|motion)\s+(?:posts?|assets?|graphics?)\s*(?:x|×)\s*(\d{1,3})/gi,
    /(?:animated|motion)\s+(?:posts?|assets?|graphics?)\s*[:\-]?\s*(\d{1,3})/gi
  ]);

  const visuals = extractMaxCount(lowered, [
    /(?:x|×)\s*(\d{1,3})\s*(?:static\s+designs?|key visuals?|visuals?|design mockups?|illustrations?)/gi,
    /(\d{1,3})\s*(?:x|×)\s*(?:static\s+designs?|key visuals?|visuals?|design mockups?|illustrations?)/gi,
    /(\d{1,3})\s+(?:static\s+designs?|key visuals?|visuals?|designs?|illustrations?)/gi,
    /(?:static\s+designs?|key visuals?|visuals?|designs?|illustrations?)\s*(?:x|×)\s*(\d{1,3})/gi,
    /(?:static\s+designs?|key visuals?|visuals?|designs?)\s*[:\-]?\s*(\d{1,3})/gi
  ]);

  const content = extractMaxCount(lowered, [
    /(?:x|×)\s*(\d{1,3})\s*(?:content\s+pieces?|posts?|articles?|copies|reports?)/gi,
    /(\d{1,3})\s*(?:x|×)\s*(?:content\s+pieces?|posts?|articles?|copies|reports?)/gi,
    /(\d{1,3})\s+(?:content\s+pieces?|posts?|articles?|copies|reports?)/gi,
    /(?:content\s+pieces?|posts?|articles?|copies|reports?)\s*(?:x|×)\s*(\d{1,3})/gi,
    /(?:content\s+pieces?|posts?|articles?|copies|reports?)\s*[:\-]?\s*(\d{1,3})/gi
  ]);

  return {
    videoProduction: video,
    motionGraphics: motion,
    visualDesign: visuals,
    contentOnly: content
  };
}

export function classifyOutputTypes(
  quantities: OutputQuantities,
  scopeOfWorkText?: string
): Array<"videoProduction" | "motionGraphics" | "visualDesign" | "contentOnly"> {
  const out: Array<"videoProduction" | "motionGraphics" | "visualDesign" | "contentOnly"> = [];

  if ((quantities.videoProduction ?? 0) > 0) out.push("videoProduction");
  if ((quantities.motionGraphics ?? 0) > 0) out.push("motionGraphics");
  if ((quantities.visualDesign ?? 0) > 0) out.push("visualDesign");
  if ((quantities.contentOnly ?? 0) > 0) out.push("contentOnly");

  const lower = (scopeOfWorkText ?? "").toLowerCase();
  if (lower.length > 0) {
    if (!out.includes("videoProduction") && /(video|film|intro|outro)/i.test(lower)) {
      out.push("videoProduction");
    }
    if (!out.includes("motionGraphics") && /(motion|animated|animation)/i.test(lower)) {
      out.push("motionGraphics");
    }
    if (!out.includes("visualDesign") && /(design|visual|key visual|illustration|iconography|palette|pattern)/i.test(lower)) {
      out.push("visualDesign");
    }
    if (!out.includes("contentOnly") && /(content|copy|article|post|social media)/i.test(lower)) {
      out.push("contentOnly");
    }
  }

  return out;
}
