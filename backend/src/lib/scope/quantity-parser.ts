export interface OutputQuantities {
  videoProduction: number | null;
  motionGraphics: number | null;
  visualDesign: number | null;
  contentOnly: number | null;
}

function extractCount(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function parseOutputQuantities(scopeOfWork: string): OutputQuantities {
  const lowered = scopeOfWork.toLowerCase();

  const video = extractCount(lowered, /(\d+)\s+(?:hero\s+)?videos?/i) ?? extractCount(lowered, /video\s*[:\-]?\s*(\d+)/i);
  const motion = extractCount(lowered, /(\d+)\s+(?:animated|motion)\s+(?:posts?|graphics?)/i);
  const visuals =
    extractCount(lowered, /(\d+)\s+(?:static\s+designs?|designs?|visuals?|static\s+posts?)/i) ??
    extractCount(lowered, /(?:static\s+designs?|designs?|visuals?)\s*[:\-]?\s*(\d+)/i);
  const content = extractCount(lowered, /(\d+)\s+(?:content\s+pieces?|articles?|copies)/i);

  return {
    videoProduction: video,
    motionGraphics: motion,
    visualDesign: visuals,
    contentOnly: content
  };
}

export function classifyOutputTypes(quantities: OutputQuantities): Array<"videoProduction" | "motionGraphics" | "visualDesign" | "contentOnly"> {
  const out: Array<"videoProduction" | "motionGraphics" | "visualDesign" | "contentOnly"> = [];

  if ((quantities.videoProduction ?? 0) > 0) out.push("videoProduction");
  if ((quantities.motionGraphics ?? 0) > 0) out.push("motionGraphics");
  if ((quantities.visualDesign ?? 0) > 0) out.push("visualDesign");
  if ((quantities.contentOnly ?? 0) > 0) out.push("contentOnly");

  return out;
}
