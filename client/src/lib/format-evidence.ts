/**
 * Transforms raw scoring evidence strings into clean, human-readable text.
 *
 * Examples:
 *   "Entity type: semi_government" → "Semi Government"
 *   "Social activity: very_active, content publishing: very_active" → "Very Active"
 *   "Company size: large, employee range: 1000-5000" → "Large"
 *   "Geographic reach: regional" → "Regional"
 *   "Media spend signal: high" → "High Media Presence"
 */

export function humanize(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function extractFirstSentence(text: string): string {
  // Remove field name prefixes like "Entity type: "
  const cleaned = text.replace(/^[^:]+:\s*/i, "");
  // Get first sentence
  const sentence = cleaned.split(/[.!]\s/)[0];
  // Humanize if it's a single underscore-delimited value
  if (sentence.length < 40 && !sentence.includes(" ")) {
    return humanize(sentence);
  }
  return sentence.length > 120 ? sentence.slice(0, 117) + "..." : sentence;
}

export function formatEvidence(
  evidence: string,
  factorName: string,
): string {
  if (!evidence) return "";

  const lower = factorName.toLowerCase();

  // Digital Presence: extract the activity level
  if (lower.includes("digital presence")) {
    const match = evidence.match(
      /(?:very_active|active|moderate|low|minimal|inactive)/i,
    );
    if (match) {
      return humanize(match[0]);
    }
    return extractFirstSentence(evidence);
  }

  // Entity Type: just humanize the value after the colon
  if (lower.includes("entity type")) {
    const match = evidence.match(/entity.?type[:\s]+([^\s,]+)/i);
    if (match) return humanize(match[1]);
    return humanize(evidence.replace(/entity.?type[:\s]*/i, "").trim());
  }

  // Company Size: humanize the size label
  if (lower.includes("company size")) {
    const match = evidence.match(
      /(?:size|estimated.?size)[:\s]+([^\s,]+)/i,
    );
    if (match) return humanize(match[1]);
    return extractFirstSentence(evidence);
  }

  // Brand Reach: humanize the reach value
  if (lower.includes("brand reach") || lower.includes("geographic")) {
    const match = evidence.match(
      /(?:reach|geographic.?reach)[:\s]+([^\s,]+)/i,
    );
    if (match) return humanize(match[1]);
    return extractFirstSentence(evidence);
  }

  // Media/Ad Spend: return descriptive text
  if (lower.includes("media") || lower.includes("ad spend")) {
    // Try to extract a signal level
    const signal = evidence.match(
      /(?:signal|spend)[:\s]+([^\s,]+)/i,
    );
    if (signal) {
      const level = humanize(signal[1]);
      return `${level} Media Presence`;
    }
    return extractFirstSentence(evidence);
  }

  // Scope / Service Match / Output: return as-is (already descriptive)
  if (
    lower.includes("scope") ||
    lower.includes("service match") ||
    lower.includes("output")
  ) {
    return extractFirstSentence(evidence);
  }

  // Default: return first meaningful sentence, cleaned up
  return extractFirstSentence(evidence);
}
