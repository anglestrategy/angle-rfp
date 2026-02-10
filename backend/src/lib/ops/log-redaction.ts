const REDACTION = "[REDACTED]";

const patterns: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d{1,3}[ -]?)?(?:\(?\d{2,4}\)?[ -]?)\d{3,4}[ -]?\d{3,4}\b/g,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi,
  /\bsk-ant-[A-Za-z0-9_-]+\b/g,
  /\bBSA[A-Za-z0-9_-]{10,}\b/g
];

function redactString(input: string): string {
  return patterns.reduce((value, pattern) => value.replace(pattern, REDACTION), input);
}

export function redactLogText(input: string): string {
  return redactString(input);
}

export function redactLogMetadata(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogMetadata(item));
  }

  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("token") || normalizedKey.includes("secret") || normalizedKey.includes("password")) {
        output[key] = REDACTION;
      } else {
        output[key] = redactLogMetadata(item);
      }
    }
    return output;
  }

  return value;
}
