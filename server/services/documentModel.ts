import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type {
  AnalysisDocumentChunk,
  AnalysisDocumentQuality,
} from "@shared/models/analysis";
import { getAnalysisFeatureFlags } from "./analysisFlags";

const execFile = promisify(execFileCallback);
let pdfParseModulePromise: Promise<any> | null = null;
let mammothModulePromise: Promise<any> | null = null;

async function loadPdfParse() {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = import("pdf-parse").then((module: any) => module.default ?? module);
  }
  return pdfParseModulePromise;
}

async function loadMammoth() {
  if (!mammothModulePromise) {
    mammothModulePromise = import("mammoth").then((module) => module.default ?? module);
  }
  return mammothModulePromise;
}

export interface DocumentModelResult {
  documentText: string;
  documentQuality: AnalysisDocumentQuality;
  chunks: AnalysisDocumentChunk[];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function splitPages(rawText: string): string[] {
  const pages = rawText
    .split(/\f+/)
    .map((page) => normalizeWhitespace(page))
    .filter(Boolean);
  return pages.length > 0 ? pages : [normalizeWhitespace(rawText)];
}

function inferLanguageHints(text: string): string[] {
  const hints = new Set<string>();
  if (/[ء-ي]/.test(text)) hints.add("ara");
  if (/[A-Za-z]/.test(text)) hints.add("eng");
  return Array.from(hints);
}

function inferSectionLabel(text: string): string | null {
  const heading = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 4 && line.length <= 80);
  if (!heading) return null;
  if (/^(section|article|phase|scope|submission|timeline|budget|evaluation)/i.test(heading)) {
    return heading;
  }
  if (heading === heading.toUpperCase()) return heading;
  return null;
}

function buildChunks(
  pages: string[],
  parseMethod: AnalysisDocumentQuality["parseMethod"],
): AnalysisDocumentChunk[] {
  const chunks: AnalysisDocumentChunk[] = [];
  const targetChunkSize = 4000;
  let globalOffset = 0;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageText = pages[pageIndex];
    const paragraphs = pageText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    let current = "";
    let currentStart = 0;

    const flush = () => {
      if (!current.trim()) return;
      const text = current.trim();
      chunks.push({
        chunkIndex: chunks.length,
        pageNumber: pageText ? pageIndex + 1 : null,
        sectionLabel: inferSectionLabel(text),
        text,
        charStart: currentStart,
        charEnd: currentStart + text.length,
        parseMethod,
        languageHint: inferLanguageHints(text).join("+") || null,
        meta: {},
      });
      current = "";
    };

    for (const paragraph of paragraphs.length > 0 ? paragraphs : [pageText]) {
      if (!current) {
        currentStart = globalOffset + Math.max(0, pageText.indexOf(paragraph));
      }

      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length > targetChunkSize && current) {
        flush();
        currentStart = globalOffset + Math.max(0, pageText.indexOf(paragraph));
        current = paragraph;
      } else {
        current = candidate;
      }
    }

    flush();
    globalOffset += pageText.length + 1;
  }

  if (chunks.length === 0) {
    const normalized = pages.join("\n\n").trim();
    chunks.push({
      chunkIndex: 0,
      pageNumber: null,
      sectionLabel: inferSectionLabel(normalized),
      text: normalized,
      charStart: 0,
      charEnd: normalized.length,
      parseMethod,
      languageHint: inferLanguageHints(normalized).join("+") || null,
      meta: {},
    });
  }

  return chunks;
}

function buildDocumentQuality(
  pages: string[],
  parseMethod: AnalysisDocumentQuality["parseMethod"],
  options?: {
    ocrUsed?: boolean;
    ocrConfidence?: number | null;
    parseWarnings?: string[];
  },
): AnalysisDocumentQuality {
  const extractedTextLength = pages.join("\n").length;
  const estimatedPageCount = pages.length;
  const averageCharsPerPage =
    estimatedPageCount > 0 ? extractedTextLength / estimatedPageCount : 0;
  const languageHints = inferLanguageHints(pages.join("\n"));

  return {
    extractedTextLength,
    estimatedPageCount,
    averageCharsPerPage,
    parseMethod,
    ocrUsed: options?.ocrUsed ?? false,
    ocrConfidence: options?.ocrConfidence ?? null,
    parseWarnings: options?.parseWarnings ?? [],
    languageHints,
  };
}

function shouldAttemptOcr(quality: AnalysisDocumentQuality): boolean {
  return (
    quality.extractedTextLength < 800 ||
    quality.averageCharsPerPage < 60 ||
    quality.parseWarnings.length > 0
  );
}

async function performPdfOcr(fileBuffer: Buffer): Promise<{
  text: string;
  confidence: number | null;
  warnings: string[];
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "rfp-ocr-"));
  const inputPath = path.join(tempDir, "input.pdf");
  const prefix = path.join(tempDir, "page");
  const warnings: string[] = [];

  try {
    await writeFile(inputPath, fileBuffer);
    await execFile("pdftoppm", ["-png", "-r", "180", inputPath, prefix]);

    const files = (await readdir(tempDir))
      .filter((file) => file.startsWith("page-") && file.endsWith(".png"))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    if (files.length === 0) {
      warnings.push("OCR fallback could not rasterize PDF pages.");
      return { text: "", confidence: null, warnings };
    }

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(["eng", "ara"]);

    try {
      let combinedText = "";
      const confidences: number[] = [];

      for (const file of files) {
        const imagePath = path.join(tempDir, file);
        const result = await worker.recognize(imagePath);
        const text = normalizeWhitespace(result.data.text || "");
        if (text) combinedText += `${text}\n\n`;
        if (typeof result.data.confidence === "number") {
          confidences.push(result.data.confidence / 100);
        }
      }

      return {
        text: combinedText.trim(),
        confidence:
          confidences.length > 0
            ? confidences.reduce((sum, value) => sum + value, 0) /
              confidences.length
            : null,
        warnings,
      };
    } finally {
      await worker.terminate();
    }
  } catch (error: any) {
    warnings.push(error?.message || "OCR fallback failed.");
    return { text: "", confidence: null, warnings };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function extractDocumentModel(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<DocumentModelResult> {
  const flags = getAnalysisFeatureFlags();
  const parseWarnings: string[] = [];

  let parseMethod: AnalysisDocumentQuality["parseMethod"] =
    mimeType === "application/pdf" ? "pdf_text" : "docx_text";
  let rawText = "";

  if (mimeType === "application/pdf") {
    const pdfParse = await loadPdfParse();
    const parser = new pdfParse.PDFParse(new Uint8Array(fileBuffer));
    await parser.load();
    const pdfResult = await parser.getText();
    rawText = typeof pdfResult === "string" ? pdfResult : pdfResult.text || "";
  } else {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    rawText = result.value;
  }

  rawText = normalizeWhitespace(rawText);
  let pages = splitPages(rawText);
  let quality = buildDocumentQuality(pages, parseMethod, { parseWarnings });

  if (mimeType === "application/pdf" && shouldAttemptOcr(quality)) {
    parseWarnings.push("Low text density detected in initial PDF parse.");
    if (flags.ocrFallback) {
      const ocrResult = await performPdfOcr(fileBuffer);
      if (ocrResult.text.trim().length > rawText.trim().length) {
        rawText = normalizeWhitespace(ocrResult.text);
        pages = splitPages(rawText);
        parseMethod = "ocr_fallback";
      }
      quality = buildDocumentQuality(pages, parseMethod, {
        ocrUsed: true,
        ocrConfidence: ocrResult.confidence,
        parseWarnings: [...parseWarnings, ...ocrResult.warnings],
      });
    } else {
      quality = buildDocumentQuality(pages, parseMethod, {
        parseWarnings: [...parseWarnings, "OCR fallback available but disabled by feature flag."],
      });
    }
  }

  const chunks = buildChunks(pages, parseMethod);
  return {
    documentText: rawText,
    documentQuality: quality,
    chunks,
  };
}
