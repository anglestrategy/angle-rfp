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

function normalizePdfText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function estimatePageCountFromRaw(raw: string): number {
  return Math.max((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
}

async function parsePdfWithLibrary(fileBytes: Buffer): Promise<PdfParseLibraryResult> {
  const module = await import("pdf-parse");
  const pdfParse = module.default as (dataBuffer: Buffer, options?: Record<string, unknown>) => Promise<PdfParseLibraryResult>;
  return pdfParse(fileBytes, {});
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

  try {
    const parsed = await parsePdfWithLibrary(fileBytes);
    const parsedText = normalizePdfText(parsed.text ?? "");
    if (parsedText.length > 0) {
      text = parsedText;
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
    warnings.push("No reliable text from primary PDF parser; skipping binary fallback and preferring OCR/unstructured.");
  }

  let needsOcr = false;

  const textPerPage = text.length / Math.max(1, pageCount);
  if (text.length < 500 || textPerPage < 350) {
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
