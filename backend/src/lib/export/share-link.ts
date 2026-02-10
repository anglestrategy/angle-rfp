import crypto from "node:crypto";
import { makeError } from "@/lib/api/errors";

export interface ShareLinkResult {
  token: string;
  url: string;
  expiresAt: string;
}

export function createShareLinkPayload(
  analysisId: string,
  reportJson: string,
  ttlMinutes = 60 * 24
): ShareLinkResult {
  const payloadBytes = Buffer.byteLength(reportJson, "utf8");
  const maxPayloadBytes = 64 * 1024;
  if (payloadBytes > maxPayloadBytes) {
    throw makeError(400, "validation_error", "Report payload exceeds share-link size limit", "export", {
      retryable: false,
      details: {
        payloadBytes,
        maxPayloadBytes
      }
    });
  }

  const expiresAtDate = new Date(Date.now() + ttlMinutes * 60_000);
  const payload = `${analysisId}:${expiresAtDate.toISOString()}:${payloadBytes}:${crypto.randomUUID()}`;
  const token = crypto.createHash("sha256").update(payload).digest("hex");

  const baseUrl = process.env.SHARE_LINK_BASE_URL ?? "https://share.angle-rfp.local";
  const url = `${baseUrl.replace(/\/$/, "")}/r/${token}`;

  return {
    token,
    url,
    expiresAt: expiresAtDate.toISOString()
  };
}
