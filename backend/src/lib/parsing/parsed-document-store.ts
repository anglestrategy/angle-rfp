import type { ParsedDocumentV1 } from "@/lib/parsing/parse-document";

interface ParsedDocumentRecord {
  parsedDocument: ParsedDocumentV1;
  createdAtMs: number;
}

const store = new Map<string, ParsedDocumentRecord>();
const MAX_RECORDS = 250;
const TTL_MS = 6 * 60 * 60 * 1000;

function pruneExpired(nowMs = Date.now()): void {
  for (const [analysisId, record] of store.entries()) {
    if (nowMs - record.createdAtMs > TTL_MS) {
      store.delete(analysisId);
    }
  }
}

function pruneOverflow(): void {
  if (store.size <= MAX_RECORDS) {
    return;
  }

  const entries = Array.from(store.entries())
    .sort((a, b) => a[1].createdAtMs - b[1].createdAtMs);
  const toDelete = Math.max(0, store.size - MAX_RECORDS);
  for (let i = 0; i < toDelete; i += 1) {
    store.delete(entries[i][0]);
  }
}

export function storeParsedDocument(analysisId: string, parsedDocument: ParsedDocumentV1): void {
  const nowMs = Date.now();
  pruneExpired(nowMs);
  store.set(analysisId, {
    parsedDocument,
    createdAtMs: nowMs
  });
  pruneOverflow();
}

export function getParsedDocument(analysisId: string): ParsedDocumentV1 | null {
  pruneExpired();
  const record = store.get(analysisId);
  return record?.parsedDocument ?? null;
}

export function deleteParsedDocument(analysisId: string): void {
  store.delete(analysisId);
}
