type ExpectedJsonType = "object" | "array" | "any";

interface ParseJsonFromModelTextOptions {
  context: string;
  expectedType?: ExpectedJsonType;
}

function pushCandidate(target: string[], value: string | null | undefined): void {
  if (!value) {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed || target.includes(trimmed)) {
    return;
  }

  target.push(trimmed);
}

function extractBalancedSegment(input: string, openChar: "{" | "[", closeChar: "}" | "]"): string | null {
  const start = input.indexOf(openChar);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}

function assertExpectedType(value: unknown, expectedType: ExpectedJsonType, context: string): void {
  if (expectedType === "any") {
    return;
  }

  const isArray = Array.isArray(value);
  if (expectedType === "array" && !isArray) {
    throw new Error(`${context}: expected a JSON array response`);
  }

  if (expectedType === "object" && (isArray || !value || typeof value !== "object")) {
    throw new Error(`${context}: expected a JSON object response`);
  }
}

export function parseJsonFromModelText<T = unknown>(
  text: string,
  options: ParseJsonFromModelTextOptions
): T {
  const expectedType = options.expectedType ?? "any";
  const candidates: string[] = [];
  const trimmed = text.trim();

  pushCandidate(candidates, trimmed);
  pushCandidate(candidates, trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, ""));

  const fencedPattern = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fencedPattern.exec(trimmed)) !== null) {
    pushCandidate(candidates, fenceMatch[1]);
  }

  for (const candidate of [...candidates]) {
    pushCandidate(candidates, extractBalancedSegment(candidate, "{", "}"));
    pushCandidate(candidates, extractBalancedSegment(candidate, "[", "]"));
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T;
      assertExpectedType(parsed, expectedType, options.context);
      return parsed;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const snippet = trimmed.slice(0, 240).replace(/\s+/g, " ");
  throw new Error(
    `${options.context}: failed to parse model JSON response. ${errors[0] ?? "Unknown parse error"}. Response snippet: ${snippet}`
  );
}
