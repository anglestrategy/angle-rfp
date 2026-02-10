import { makeError } from "@/lib/api/errors";

export interface TxtParseResult {
  text: string;
  warnings: string[];
}

export function parseTxtBuffer(fileBytes: Buffer): TxtParseResult {
  const utf8 = fileBytes.toString("utf8").trim();
  const fallback = fileBytes.toString("latin1").trim();
  const text = utf8.length > 0 ? utf8 : fallback;

  if (text.length === 0) {
    throw makeError(400, "validation_error", "TXT file contains no readable text", "parse-document", {
      retryable: false
    });
  }

  const warnings: string[] = [];
  if (text.length < 200) {
    warnings.push("TXT document is very short; analysis confidence may be reduced.");
  }

  return { text, warnings };
}
