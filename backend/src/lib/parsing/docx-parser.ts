import mammoth from "mammoth";
import { makeError } from "@/lib/api/errors";

export interface DocxParseResult {
  text: string;
  warnings: string[];
}

export async function parseDocxBuffer(fileBytes: Buffer): Promise<DocxParseResult> {
  const warnings: string[] = [];

  try {
    const extracted = await mammoth.extractRawText({ buffer: fileBytes });
    const text = extracted.value.trim();

    for (const message of extracted.messages) {
      warnings.push(`DOCX parser: ${message.message}`);
    }

    if (text.length > 0) {
      return { text, warnings };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`DOCX parser could not read document structure. (${message})`);
  }

  // DOCX is a ZIP container; utf8 fallback decode produces gibberish and pollutes extraction quality.
  throw makeError(422, "validation_error", "DOCX text extraction failed; document could not be parsed reliably", "parse-document", {
    retryable: true,
    details: { warnings }
  });
}
