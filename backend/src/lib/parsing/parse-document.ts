import { makeError } from "@/lib/api/errors";
import { buildEvidenceMap, detectPrimaryLanguage, detectSections, extractTables, normalizeForMatching, truncateText } from "@/lib/parsing/normalization";
import { createOcrProvider, type OcrProvider } from "@/lib/parsing/ocr-provider";
import { parseDocxBuffer } from "@/lib/parsing/docx-parser";
import { parsePdfBuffer } from "@/lib/parsing/pdf-parser";
import { parseTxtBuffer } from "@/lib/parsing/txt-parser";
import { parseWithUnstructured } from "@/lib/parsing/unstructured-provider";

export type ParsedFormat = "pdf" | "docx" | "txt";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_PAGES = 250;
const MAX_EXTRACTED_CHARS = 2_000_000;

const supportedMimeTypeToFormat: Record<string, ParsedFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt"
};

export interface ParseDocumentInput {
  analysisId: string;
  fileName: string;
  mimeType: string;
  fileBytes: Buffer;
  ocrProvider?: OcrProvider;
}

export interface ParsedDocumentV1 {
  schemaVersion: "1.0.0";
  analysisId: string;
  detectedFormat: ParsedFormat;
  primaryLanguage: "arabic" | "english" | "mixed";
  rawText: string;
  sections: Array<{ name: string; startOffset: number; endOffset: number }>;
  tables: Array<{
    title: string;
    headers: string[];
    rows: string[][];
    pages: number[];
    confidence: number;
  }>;
  evidenceMap: Array<{
    page: number;
    charStart: number;
    charEnd: number;
    excerpt: string;
    sourceType: "pdf_text" | "ocr" | "docx" | "txt" | "table_cell" | "unstructured";
  }>;
  parseConfidence: number;
  ocrStats: {
    used: boolean;
    pagesOcred: number;
  } | null;
  parserProvenance?: string[];
  warnings: string[];
}

type AnalysisProfile = "high_assurance" | "balanced" | "fast";

function resolvedAnalysisProfile(): AnalysisProfile {
  const raw = process.env.ANALYSIS_PROFILE?.trim().toLowerCase();
  if (raw === "fast" || raw === "balanced" || raw === "high_assurance") {
    return raw;
  }
  return "high_assurance";
}

function detectFormat(fileName: string, mimeType: string): ParsedFormat {
  const fromMime = supportedMimeTypeToFormat[mimeType.toLowerCase()];
  if (fromMime) {
    return fromMime;
  }

  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || ext === "docx" || ext === "txt") {
    return ext;
  }

  throw makeError(400, "unsupported_format", `Unsupported document format: ${mimeType || ext || "unknown"}`, "parse-document", {
    retryable: false,
    details: { fileName, mimeType }
  });
}

function shouldUseUnstructuredParser(params: {
  analysisProfile: AnalysisProfile;
  detectedFormat: ParsedFormat;
  needsOcr: boolean;
  pageCount: number;
  rawTextLength: number;
  warnings: string[];
}): boolean {
  if (params.detectedFormat === "txt") {
    return false;
  }

  const forceAll = process.env.UNSTRUCTURED_FORCE_ALL === "1";
  if (forceAll) {
    return true;
  }

  const warningSignal = params.warnings.some((warning) =>
    /limited|no direct text extracted|unable to extract|image-only|fallback/i.test(warning)
  );
  const lowTextDensity =
    params.detectedFormat === "pdf"
      ? params.rawTextLength / Math.max(1, params.pageCount) < 900
      : params.rawTextLength < 7_000;
  const largePdf = params.detectedFormat === "pdf" && params.pageCount >= 45;
  const structuredHint = params.detectedFormat === "docx" && params.rawTextLength < 12_000;

  if (params.analysisProfile === "fast") {
    return params.needsOcr && (warningSignal || lowTextDensity);
  }

  if (params.analysisProfile === "balanced") {
    return params.needsOcr || warningSignal || lowTextDensity;
  }

  // high_assurance: selective premium parsing, not unconditional.
  return params.needsOcr || warningSignal || lowTextDensity || largePdf || structuredHint;
}

function assertLimits(fileName: string, fileBytes: Buffer): void {
  if (fileBytes.length > MAX_FILE_BYTES) {
    throw makeError(413, "file_too_large", `File ${fileName} exceeds ${MAX_FILE_BYTES} bytes`, "parse-document", {
      retryable: false,
      details: { maxBytes: MAX_FILE_BYTES, actualBytes: fileBytes.length }
    });
  }
}

function estimateParseConfidence(params: {
  textLength: number;
  sectionCount: number;
  tableCount: number;
  warnings: number;
  ocrUsed: boolean;
}): number {
  const lengthScore = Math.min(params.textLength / 5000, 1) * 0.4;
  const sectionScore = Math.min(params.sectionCount / 4, 1) * 0.25;
  const tableScore = Math.min(params.tableCount / 2, 1) * 0.15;
  const ocrPenalty = params.ocrUsed ? 0.03 : 0;
  const warningPenalty = Math.min(params.warnings * 0.04, 0.25);

  return Math.max(0, Math.min(1, 0.2 + lengthScore + sectionScore + tableScore - warningPenalty - ocrPenalty));
}

export async function parseDocumentInput(input: ParseDocumentInput): Promise<ParsedDocumentV1> {
  const analysisProfile = resolvedAnalysisProfile();
  assertLimits(input.fileName, input.fileBytes);
  const detectedFormat = detectFormat(input.fileName, input.mimeType);
  const warnings: string[] = [];
  const parserProvenance: string[] = [];

  let rawText = "";
  let pageCount = 1;
  let sourceType: "pdf_text" | "ocr" | "docx" | "txt" | "unstructured" = "txt";
  let needsOcr = false;

  if (detectedFormat === "txt") {
    const result = parseTxtBuffer(input.fileBytes);
    rawText = result.text;
    warnings.push(...result.warnings);
    sourceType = "txt";
    parserProvenance.push("txt_local");
  } else if (detectedFormat === "docx") {
    const result = await parseDocxBuffer(input.fileBytes);
    rawText = result.text;
    warnings.push(...result.warnings);
    sourceType = "docx";
    parserProvenance.push("docx_local");
  } else {
    const result = parsePdfBuffer(input.fileBytes);
    rawText = result.text;
    pageCount = result.pageCount;
    warnings.push(...result.warnings);
    needsOcr = result.needsOcr;
    sourceType = "pdf_text";
    parserProvenance.push("pdf_local");

    if (pageCount > MAX_PAGES) {
      throw makeError(413, "file_too_large", `PDF page count exceeds ${MAX_PAGES}`, "parse-document", {
        retryable: false,
        details: { pageCount, maxPages: MAX_PAGES }
      });
    }
  }

  let ocrStats: { used: boolean; pagesOcred: number } | null = null;

  if (detectedFormat === "pdf" && needsOcr) {
    const provider = input.ocrProvider ?? createOcrProvider();
    const ocrResult = await provider.performOcr({
      fileBytes: input.fileBytes,
      fileName: input.fileName,
      pagesHint: pageCount
    });

    if (ocrResult.text.trim().length > 0) {
      rawText = `${rawText}\n\n${ocrResult.text}`.trim();
      sourceType = "ocr";
    }

    warnings.push(...ocrResult.warnings);
    ocrStats = {
      used: true,
      pagesOcred: ocrResult.pagesOcred
    };
    parserProvenance.push("ocr");
  }

  if (detectedFormat !== "txt" && process.env.UNSTRUCTURED_API_KEY) {
    const shouldUseUnstructured = shouldUseUnstructuredParser({
      analysisProfile,
      detectedFormat,
      needsOcr,
      pageCount,
      rawTextLength: rawText.length,
      warnings
    });

    if (shouldUseUnstructured) {
      try {
        const unstructured = await parseWithUnstructured({
          fileBytes: input.fileBytes,
          fileName: input.fileName,
          mimeType: input.mimeType
        });

        if (unstructured && unstructured.text.length > Math.max(Math.floor(rawText.length * 0.75), 500)) {
          rawText = unstructured.text;
          sourceType = "unstructured";
        }
        parserProvenance.push("unstructured");

        if (unstructured?.warnings.length) {
          warnings.push(...unstructured.warnings);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`Unstructured parser unavailable; continued with local parser. (${message})`);
      }
    }
  }

  const trimmedText = rawText.trim();
  if (trimmedText.length === 0) {
    throw makeError(422, "validation_error", "No text could be extracted from document", "parse-document", {
      retryable: false
    });
  }

  const boundedText = truncateText(trimmedText, MAX_EXTRACTED_CHARS);
  const sections = detectSections(boundedText);
  const tables = extractTables(boundedText);
  const evidenceMap = buildEvidenceMap(boundedText, sections, sourceType);
  const primaryLanguage = detectPrimaryLanguage(normalizeForMatching(boundedText));

  const parseConfidence = estimateParseConfidence({
    textLength: boundedText.length,
    sectionCount: sections.length,
    tableCount: tables.length,
    warnings: warnings.length,
    ocrUsed: Boolean(ocrStats)
  });

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    detectedFormat,
    primaryLanguage,
    rawText: boundedText,
    sections,
    tables,
    evidenceMap,
    parseConfidence,
    ocrStats,
    parserProvenance,
    warnings
  };
}
