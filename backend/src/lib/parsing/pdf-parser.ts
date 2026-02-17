import { makeError } from "@/lib/api/errors";

export interface PdfParseResult {
  text: string;
  pageCount: number;
  warnings: string[];
  needsOcr: boolean;
}

interface PdfParseLibraryResult {
  text?: string;
  numpages?: number;
}

interface ParsedWithDiagnostics {
  parsed: PdfParseLibraryResult;
  parserWarnings: string[];
}

function normalizePdfText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isLikelyCorruptedPdfText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return true;
  }

  const readableChars = (normalized.match(/[\p{L}\p{N}\s.,;:!?'"()\-[\]{}\/%@&+]/gu) ?? []).length;
  const readableRatio = readableChars / Math.max(normalized.length, 1);
  const replacementCharCount = (normalized.match(/�|\u0000/g) ?? []).length;
  const replacementRatio = replacementCharCount / Math.max(normalized.length, 1);
  const binaryMarkerHits = (normalized.match(/(?:endobj|stream|endstream|xref|trailer|%%eof)/giu) ?? []).length;
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const longLines = lines.filter((line) => line.length >= 80).length;
  const wordTokens = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}\-]{1,}/gu) ?? [];
  const uniqueTokenRatio =
    wordTokens.length > 0
      ? new Set(wordTokens.map((token) => token.toLowerCase())).size / wordTokens.length
      : 0;
  const punctuationHeavyRatio =
    ((normalized.match(/[^\p{L}\p{N}\s]/gu) ?? []).length) / Math.max(normalized.length, 1);

  return (
    readableRatio < 0.7 ||
    replacementRatio > 0.005 ||
    binaryMarkerHits >= 3 ||
    (wordTokens.length >= 120 && uniqueTokenRatio < 0.12) ||
    (wordTokens.length >= 200 && punctuationHeavyRatio > 0.22) ||
    (lines.length >= 10 && longLines === 0)
  );
}

function estimatePageCountFromRaw(raw: string): number {
  return Math.max((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
}

async function parsePdfWithLibrary(fileBytes: Buffer): Promise<ParsedWithDiagnostics> {
  const module = await import("pdf-parse");
  const pdfParse = module.default as (dataBuffer: Buffer, options?: Record<string, unknown>) => Promise<PdfParseLibraryResult>;
  const parserWarnings: string[] = [];
  const originalWarn = console.warn;
  const originalLog = console.log;

  // pdf-parse emits TT/font issues via console warnings instead of throwing.
  // Capture those warnings so we can degrade gracefully instead of trusting corrupted text.
  console.warn = (...args: unknown[]) => {
    const message = args.map((value) => String(value)).join(" ");
    if (/warning:\s*tt:|tt:\s*undefined function|invalid function id/i.test(message)) {
      parserWarnings.push(message);
      return;
    }
    originalWarn(...args);
  };
  console.log = (...args: unknown[]) => {
    const message = args.map((value) => String(value)).join(" ");
    if (/warning:\s*tt:|tt:\s*undefined function|invalid function id/i.test(message)) {
      parserWarnings.push(message);
      return;
    }
    originalLog(...args);
  };

  try {
    const parsed = await pdfParse(fileBytes, {});
    return { parsed, parserWarnings };
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
  }
}

export async function parsePdfBuffer(fileBytes: Buffer): Promise<PdfParseResult> {
  const raw = fileBytes.toString("latin1");

  if (!raw.startsWith("%PDF")) {
    throw makeError(400, "unsupported_format", "File is not a valid PDF payload", "parse-document", {
      retryable: false
    });
  }

  const warnings: string[] = [];
  let text = "";
  let pageCount = estimatePageCountFromRaw(raw);
  let needsOcr = false;

  try {
    const { parsed, parserWarnings } = await parsePdfWithLibrary(fileBytes);
    const parsedText = normalizePdfText(parsed.text ?? "");
    if (parserWarnings.length > 0) {
      needsOcr = true;
      warnings.push("[parser_degraded_local_pdf] Primary PDF parser emitted TrueType/font decode warnings; prioritizing unstructured/OCR output.");
    }
    if (parsedText.length > 0 && !isLikelyCorruptedPdfText(parsedText)) {
      text = parsedText;
    } else if (parsedText.length > 0) {
      warnings.push("[parser_degraded_local_pdf] Primary PDF parser returned low-quality/corrupted text; forcing OCR/unstructured fallback.");
      needsOcr = true;
    }
    if (typeof parsed.numpages === "number" && Number.isFinite(parsed.numpages) && parsed.numpages > 0) {
      pageCount = Math.max(1, Math.floor(parsed.numpages));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Primary PDF parser failed; using binary fallback extraction. (${message})`);
  }

  // Avoid binary-regex fallback extraction: it can inject compressed PDF noise
  // that degrades downstream AI extraction quality.
  if (!text) {
    warnings.push("[parser_degraded_local_pdf] No reliable text from primary PDF parser; skipping binary fallback and preferring OCR/unstructured.");
  }

  const textPerPage = text.length / Math.max(1, pageCount);
  if (text.length < 500 || textPerPage < 350) {
    needsOcr = true;
    warnings.push("[parser_degraded_local_pdf] PDF text extraction appears limited; OCR fallback recommended.");
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
