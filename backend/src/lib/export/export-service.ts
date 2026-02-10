import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { makeError } from "@/lib/api/errors";
import { renderPdfDocument } from "@/lib/export/pdf-renderer";
import { createShareLinkPayload } from "@/lib/export/share-link";

type ExportFormat = "pdf" | "email" | "link";

interface AnalysisReportLike {
  schemaVersion?: string;
  analysisId?: string;
  summary?: {
    headline?: string;
    recommendation?: string;
    score?: number;
  };
}

export interface ExportInput {
  analysisId: string;
  report: AnalysisReportLike;
  format: ExportFormat;
}

export interface ExportResult {
  schemaVersion: "1.0.0";
  analysisId: string;
  format: ExportFormat;
  exportId: string;
  artifact: Record<string, unknown>;
  retention: {
    deleteAfterMinutes: number;
    deletionScheduled: boolean;
  };
}

const DEFAULT_RETENTION_MINUTES = 15;

async function ensureExportDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), "angle-rfp-exports");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function scheduleDeletion(filePath: string, retentionMinutes: number): void {
  const delayMs = Math.max(0, retentionMinutes) * 60_000;
  setTimeout(() => {
    fs.unlink(filePath).catch(() => {
      // Best-effort cleanup for ephemeral artifacts.
    });
  }, delayMs).unref();
}

async function buildPdfExport(input: ExportInput, retentionMinutes: number): Promise<ExportResult> {
  const headline = input.report.summary?.headline ?? "angle/RFP Analysis";
  const recommendation = input.report.summary?.recommendation ?? "Recommendation unavailable";
  const score = input.report.summary?.score ?? 0;

  const bytes = renderPdfDocument({
    analysisId: input.analysisId,
    headline,
    recommendation,
    score
  });

  const exportId = `exp_${crypto.randomUUID()}`;
  const fileName = `${input.analysisId}-${Date.now()}.pdf`;
  const dir = await ensureExportDir();
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, bytes);
  scheduleDeletion(filePath, retentionMinutes);

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    format: "pdf",
    exportId,
    artifact: {
      type: "file",
      fileName,
      mimeType: "application/pdf",
      filePath,
      sizeBytes: bytes.byteLength
    },
    retention: {
      deleteAfterMinutes: retentionMinutes,
      deletionScheduled: true
    }
  };
}

function buildEmailExport(input: ExportInput): ExportResult {
  const exportId = `exp_${crypto.randomUUID()}`;
  const subject = `RFP Analysis - ${input.report.summary?.headline ?? input.analysisId}`;
  const body = [
    `Analysis ID: ${input.analysisId}`,
    `Recommendation: ${input.report.summary?.recommendation ?? "N/A"}`,
    `Score: ${input.report.summary?.score ?? "N/A"}`
  ].join("\n");

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    format: "email",
    exportId,
    artifact: {
      type: "email_payload",
      subject,
      body,
      bodyBytes: Buffer.byteLength(body, "utf8")
    },
    retention: {
      deleteAfterMinutes: 0,
      deletionScheduled: false
    }
  };
}

function buildShareLinkExport(input: ExportInput): ExportResult {
  const exportId = `exp_${crypto.randomUUID()}`;
  const serialized = JSON.stringify(input.report);
  const link = createShareLinkPayload(input.analysisId, serialized);

  return {
    schemaVersion: "1.0.0",
    analysisId: input.analysisId,
    format: "link",
    exportId,
    artifact: {
      type: "share_link",
      token: link.token,
      url: link.url,
      expiresAt: link.expiresAt
    },
    retention: {
      deleteAfterMinutes: 60 * 24,
      deletionScheduled: true
    }
  };
}

export async function exportAnalysis(input: ExportInput): Promise<ExportResult> {
  if (!input.analysisId || !input.report || !input.format) {
    throw makeError(400, "validation_error", "analysisId, report, and format are required", "export", {
      retryable: false
    });
  }

  if (input.report.analysisId && input.report.analysisId !== input.analysisId) {
    throw makeError(400, "validation_error", "analysisId does not match report.analysisId", "export", {
      retryable: false
    });
  }

  const retentionMinutes = Number(process.env.EXPORT_RETENTION_MINUTES ?? DEFAULT_RETENTION_MINUTES);

  switch (input.format) {
    case "pdf":
      return buildPdfExport(input, retentionMinutes);
    case "email":
      return buildEmailExport(input);
    case "link":
      return buildShareLinkExport(input);
    default:
      throw makeError(400, "validation_error", "Unsupported export format", "export", {
        retryable: false,
        details: { format: input.format }
      });
  }
}
