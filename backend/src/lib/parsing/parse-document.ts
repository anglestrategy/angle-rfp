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
const DEFAULT_MAX_UNSTRUCTURED_BYTES = 18 * 1024 * 1024;

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
  normalizedText?: string;
  rawText: string;
  sections: Array<{ name: string; startOffset: number; endOffset: number }>;
  chunkIndex: Array<{
    index: number;
    startOffset: number;
    endOffset: number;
    sectionHints: string[];
  }>;
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
  if (process.env.UNSTRUCTURED_DISABLED === "1") {
    return false;
  }

  if (params.detectedFormat === "txt") {
    return false;
  }

  const forceAll = process.env.UNSTRUCTURED_FORCE_ALL === "1";
  if (forceAll) {
    return true;
  }

  const warningSignal = params.warnings.some((warning) =>
    /limited|no direct text extracted|unable to extract|image-only|fallback|parser_degraded_local_pdf/i.test(warning)
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

  // high_assurance: always attempt premium parser when available.
  return true;
}

function maxUnstructuredBytes(): number {
  const fromEnvMb = Number(process.env.UNSTRUCTURED_MAX_MB ?? "");
  if (Number.isFinite(fromEnvMb) && fromEnvMb > 0) {
    return Math.floor(fromEnvMb * 1024 * 1024);
  }
  return DEFAULT_MAX_UNSTRUCTURED_BYTES;
}

function resolveExtractedCharLimit(profile: AnalysisProfile): {
  limit: number | null;
  ignoredConfiguredLimit: number | null;
} {
  const fromEnv = Number(process.env.PARSE_MAX_EXTRACTED_CHARS ?? "");
  if (!Number.isFinite(fromEnv) || fromEnv <= 0) {
    return { limit: null, ignoredConfiguredLimit: null };
  }

  const normalized = Math.floor(fromEnv);
  const allowTruncation = process.env.ALLOW_PARSE_TRUNCATION === "1";
  if (profile === "high_assurance" && !allowTruncation) {
    // High-assurance mode must avoid silent semantic blind spots.
    return {
      limit: null,
      ignoredConfiguredLimit: normalized
    };
  }

  return { limit: normalized, ignoredConfiguredLimit: null };
}

function textQualityScore(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  const alphaNumericCount = (trimmed.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const printableRatio = alphaNumericCount / Math.max(trimmed.length, 1);
  const lineCount = trimmed.split(/\r?\n/).length;
  const avgLineLength = trimmed.length / Math.max(1, lineCount);
  const structureScore = avgLineLength >= 20 && avgLineLength <= 260 ? 0.2 : 0.08;
  const binaryNoisePenalty = /endobj|stream|endstream|xref|trailer|%%eof|\/type\s*\/page/iu.test(trimmed) ? 0.25 : 0;

  return Math.max(0, Math.min(1, printableRatio * 0.72 + structureScore - binaryNoisePenalty));
}

function looksCorruptedExtractedText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  const readableChars = (trimmed.match(/[\p{L}\p{N}\s.,;:!?'"()\-[\]{}\/%@&+]/gu) ?? []).length;
  const readableRatio = readableChars / Math.max(trimmed.length, 1);
  const replacementRatio = (trimmed.match(/�|\u0000/g) ?? []).length / Math.max(trimmed.length, 1);
  const binaryNoiseHits = (trimmed.match(/(?:endobj|stream|endstream|xref|trailer|%%eof)/giu) ?? []).length;

  return readableRatio < 0.68 || replacementRatio > 0.005 || binaryNoiseHits >= 3;
}

function hasParserDegradationWarning(warnings: string[]): boolean {
  return warnings.some((warning) =>
    /\[parser_degraded_local_pdf\]|low-quality\/corrupted text|no reliable text|text extraction appears limited/i.test(
      warning
    )
  );
}

function localPdfTextIsUsable(params: {
  text: string;
  pageCount: number;
  warnings: string[];
}): boolean {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return false;
  }

  if (looksCorruptedExtractedText(trimmed)) {
    return false;
  }

  const qualityScore = textQualityScore(trimmed);
  const minLength = Math.max(1_200, Math.min(5_000, params.pageCount * 220));
  const hasHardFailureSignal = params.warnings.some((warning) =>
    /no reliable text|no direct text extracted|low-quality\/corrupted text/i.test(warning)
  );

  if (hasHardFailureSignal && trimmed.length < minLength) {
    return false;
  }

  return qualityScore >= 0.36 && trimmed.length >= minLength;
}

function parseTimeoutFromEnv(raw: string | undefined, fallbackMs: number, minMs = 5_000, maxMs = 300_000): number {
  const parsed = Number(raw ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.max(minMs, Math.min(maxMs, Math.floor(parsed)));
}

function defaultParseStepTimeouts(profile: AnalysisProfile): {
  localPdfMs: number;
  ocrMs: number;
  unstructuredMs: number;
} {
  if (profile === "fast") {
    return {
      localPdfMs: 15_000,
      ocrMs: 20_000,
      unstructuredMs: 20_000
    };
  }

  if (profile === "balanced") {
    return {
      localPdfMs: 18_000,
      ocrMs: 25_000,
      unstructuredMs: 28_000
    };
  }

  return {
    localPdfMs: 20_000,
    ocrMs: 30_000,
    unstructuredMs: 40_000
  };
}

type StepOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

async function captureStepOutcome<T>(operation: Promise<T>): Promise<StepOutcome<T>> {
  try {
    return {
      ok: true,
      value: await operation
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message
    };
  }
}

async function withStepTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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

function buildChunkIndex(
  text: string,
  sections: Array<{ name: string; startOffset: number; endOffset: number }>
): ParsedDocumentV1["chunkIndex"] {
  const chunkSize = 16_000;
  const overlap = 1_200;
  const step = Math.max(1, chunkSize - overlap);
  const chunks: ParsedDocumentV1["chunkIndex"] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < text.length) {
    const end = Math.min(text.length, cursor + chunkSize);
    const sectionHints = sections
      .filter((section) => section.startOffset < end && section.endOffset > cursor)
      .map((section) => section.name);

    chunks.push({
      index,
      startOffset: cursor,
      endOffset: end,
      sectionHints
    });

    if (end >= text.length) {
      break;
    }
    cursor += step;
    index += 1;
  }

  return chunks;
}

export async function parseDocumentInput(input: ParseDocumentInput): Promise<ParsedDocumentV1> {
  const analysisProfile = resolvedAnalysisProfile();
  const timeoutDefaults = defaultParseStepTimeouts(analysisProfile);
  assertLimits(input.fileName, input.fileBytes);
  const detectedFormat = detectFormat(input.fileName, input.mimeType);
  const warnings: string[] = [];
  const parserProvenance: string[] = [];

  let rawText = "";
  let pageCount = 1;
  let sourceType: "pdf_text" | "ocr" | "docx" | "txt" | "unstructured" = "txt";
  let needsOcr = false;
  const localPdfStepTimeoutMs = parseTimeoutFromEnv(
    process.env.PARSE_LOCAL_PDF_TIMEOUT_MS,
    timeoutDefaults.localPdfMs
  );
  const ocrStepTimeoutMs = parseTimeoutFromEnv(process.env.PARSE_OCR_TIMEOUT_MS, timeoutDefaults.ocrMs);
  const unstructuredStepTimeoutMs = parseTimeoutFromEnv(
    process.env.PARSE_UNSTRUCTURED_TIMEOUT_MS,
    timeoutDefaults.unstructuredMs
  );

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
    try {
      const result = await withStepTimeout(
        parsePdfBuffer(input.fileBytes),
        localPdfStepTimeoutMs,
        "Local PDF parse"
      );
      rawText = result.text;
      pageCount = result.pageCount;
      warnings.push(...result.warnings);
      needsOcr = result.needsOcr;
      sourceType = "pdf_text";
      parserProvenance.push("pdf_local");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/timed out/i.test(message)) {
        warnings.push(
          `[parser_degraded_local_pdf] Local PDF parser timed out after ${localPdfStepTimeoutMs}ms; prioritizing OCR/unstructured parsing.`
        );
        needsOcr = true;
        rawText = "";
        sourceType = "pdf_text";
        parserProvenance.push("pdf_local_timeout");
      } else {
        throw error;
      }
    }

    if (pageCount > MAX_PAGES) {
      throw makeError(413, "file_too_large", `PDF page count exceeds ${MAX_PAGES}`, "parse-document", {
        retryable: false,
        details: { pageCount, maxPages: MAX_PAGES }
      });
    }
  }

  if (detectedFormat === "pdf" && rawText.trim().length > 0 && looksCorruptedExtractedText(rawText)) {
    warnings.push("[parser_degraded_local_pdf] Local PDF text appears corrupted; prioritizing OCR/unstructured parsing.");
    needsOcr = true;
  }

  if (
    detectedFormat === "pdf" &&
    needsOcr &&
    localPdfTextIsUsable({
      text: rawText,
      pageCount,
      warnings
    })
  ) {
    needsOcr = false;
    warnings.push(
      "[parser_pdf_local_accepted] Local PDF text quality is sufficient; skipping OCR to reduce timeout risk."
    );
  }

  let ocrStats: { used: boolean; pagesOcred: number } | null = null;
  const unstructuredConfigured = Boolean(process.env.UNSTRUCTURED_API_KEY);

  if (detectedFormat !== "txt" && !unstructuredConfigured && analysisProfile === "high_assurance") {
    warnings.push("[parser_unstructured_unavailable] UNSTRUCTURED_API_KEY is not configured; complex layout/table extraction quality may be reduced.");
  }

  const ocrOutcomePromise =
    detectedFormat === "pdf" && needsOcr
      ? captureStepOutcome(
          withStepTimeout(
            (input.ocrProvider ?? createOcrProvider()).performOcr({
              fileBytes: input.fileBytes,
              fileName: input.fileName,
              pagesHint: pageCount
            }),
            ocrStepTimeoutMs,
            "OCR step"
          )
        )
      : null;

  const shouldUseUnstructured =
    detectedFormat !== "txt" &&
    unstructuredConfigured &&
    shouldUseUnstructuredParser({
      analysisProfile,
      detectedFormat,
      needsOcr,
      pageCount,
      rawTextLength: rawText.length,
      warnings
    });

  if (shouldUseUnstructured && input.fileBytes.length > maxUnstructuredBytes()) {
    warnings.push(
      `Unstructured parser skipped for large file (${Math.round(input.fileBytes.length / (1024 * 1024))} MB).`
    );
  }

  const unstructuredOutcomePromise =
    shouldUseUnstructured && input.fileBytes.length <= maxUnstructuredBytes()
      ? captureStepOutcome(
          withStepTimeout(
            parseWithUnstructured({
              fileBytes: input.fileBytes,
              fileName: input.fileName,
              mimeType: input.mimeType
            }),
            unstructuredStepTimeoutMs,
            "Unstructured parse"
          )
        )
      : null;

  const [ocrOutcome, unstructuredOutcome] = await Promise.all([
    ocrOutcomePromise ?? Promise.resolve<StepOutcome<Awaited<ReturnType<OcrProvider["performOcr"]>>> | null>(null),
    unstructuredOutcomePromise ?? Promise.resolve<StepOutcome<Awaited<ReturnType<typeof parseWithUnstructured>>> | null>(null)
  ]);

  if (ocrOutcome) {
    if (ocrOutcome.ok) {
      const ocrResult = ocrOutcome.value;
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
    } else {
      warnings.push(`[ocr_unavailable] OCR step failed or timed out: ${ocrOutcome.message}`);
    }
  }

  if (unstructuredOutcome) {
    if (unstructuredOutcome.ok) {
      const unstructured = unstructuredOutcome.value;
      if (unstructured && unstructured.text.trim().length > 500) {
        const localScore = textQualityScore(rawText);
        const unstructuredScore = textQualityScore(unstructured.text);
        const warningSignal = warnings.some((warning) =>
          /limited|no direct text extracted|unable to extract|image-only|fallback|ocr|parser_degraded_local_pdf/i.test(
            warning
          )
        );
        const localCorrupted = looksCorruptedExtractedText(rawText);
        const localDegraded = hasParserDegradationWarning(warnings);
        const shouldPreferUnstructured =
          analysisProfile === "high_assurance"
            ? warningSignal ||
              needsOcr ||
              localCorrupted ||
              localDegraded ||
              unstructuredScore >= Math.max(0.2, localScore - 0.05)
            : warningSignal ||
              needsOcr ||
              localCorrupted ||
              unstructuredScore >= localScore + 0.05 ||
              localScore < 0.42;

        if (shouldPreferUnstructured) {
          rawText = unstructured.text;
          sourceType = "unstructured";
        } else {
          warnings.push(
            `Unstructured output kept as secondary context (local quality score ${localScore.toFixed(2)} >= unstructured ${unstructuredScore.toFixed(2)}).`
          );
        }
      }
      parserProvenance.push("unstructured");

      if (unstructured?.warnings.length) {
        warnings.push(...unstructured.warnings);
      }
    } else {
      warnings.push(
        `[parser_unstructured_unavailable] Unstructured parser unavailable; continued with local parser. (${unstructuredOutcome.message})`
      );
    }
  }

  const localPdfDegraded =
    detectedFormat === "pdf" &&
    sourceType === "pdf_text" &&
    hasParserDegradationWarning(warnings);
  if (analysisProfile === "high_assurance" && localPdfDegraded) {
    const hasUnstructured = parserProvenance.includes("unstructured");
    const hasOcrText = sourceType === "ocr";
    if (!hasUnstructured && !hasOcrText) {
      if (localPdfTextIsUsable({ text: rawText, pageCount, warnings })) {
        warnings.push(
          "[parser_degraded_local_pdf_accepted] Premium parsing path unavailable; continuing with usable local PDF text in degraded high-assurance mode."
        );
      } else {
        throw makeError(
          422,
          "validation_error",
          "PDF text extraction quality is degraded and no premium parsing path succeeded (Unstructured/OCR).",
          "parse-document",
          {
            retryable: true,
            details: {
              warnings,
              parserProvenance
            }
          }
        );
      }
    }
  }

  const trimmedText = rawText.trim();
  if (trimmedText.length === 0) {
    throw makeError(422, "validation_error", "No text could be extracted from document", "parse-document", {
      retryable: false
    });
  }

  const extractedCharLimitState = resolveExtractedCharLimit(analysisProfile);
  const extractedCharLimit = extractedCharLimitState.limit;
  if (extractedCharLimitState.ignoredConfiguredLimit) {
    warnings.push(
      `PARSE_MAX_EXTRACTED_CHARS=${extractedCharLimitState.ignoredConfiguredLimit} ignored in high_assurance mode. Set ALLOW_PARSE_TRUNCATION=1 to force truncation.`
    );
  }
  const boundedText =
    extractedCharLimit && extractedCharLimit > 0
      ? truncateText(trimmedText, extractedCharLimit)
      : trimmedText;
  if (extractedCharLimit && boundedText.length < trimmedText.length) {
    warnings.push(`Parsed text was truncated from ${trimmedText.length} to ${boundedText.length} characters.`);
  }
  const sections = detectSections(boundedText);
  const chunkIndex = buildChunkIndex(boundedText, sections);
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
    normalizedText: boundedText,
    rawText: boundedText,
    sections,
    chunkIndex,
    tables,
    evidenceMap,
    parseConfidence,
    ocrStats,
    parserProvenance,
    warnings
  };
}
