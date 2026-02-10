import { makeError } from "@/lib/api/errors";

export interface PdfParseResult {
  text: string;
  pageCount: number;
  warnings: string[];
  needsOcr: boolean;
}

const printableChunkRegex = /[\u0600-\u06FFA-Za-z0-9][\u0600-\u06FFA-Za-z0-9\s,.;:%()\-_/]{2,}/g;

function extractPrintableText(raw: string): string {
  const matches = raw.match(printableChunkRegex) ?? [];
  const cleaned = matches
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter((entry) => entry.length >= 3);

  return Array.from(new Set(cleaned)).join("\n");
}

export function parsePdfBuffer(fileBytes: Buffer): PdfParseResult {
  const raw = fileBytes.toString("latin1");

  if (!raw.startsWith("%PDF")) {
    throw makeError(400, "unsupported_format", "File is not a valid PDF payload", "parse-document", {
      retryable: false
    });
  }

  const pageCount = Math.max((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
  const text = extractPrintableText(raw).trim();
  const warnings: string[] = [];
  let needsOcr = false;

  if (text.length < 500) {
    needsOcr = true;
    warnings.push("PDF text extraction appears limited; OCR fallback recommended.");
  }

  if (text.length === 0) {
    warnings.push("No direct text extracted from PDF content stream.");
  }

  return {
    text,
    pageCount,
    warnings,
    needsOcr
  };
}
