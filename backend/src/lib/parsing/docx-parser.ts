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
  } catch {
    warnings.push("DOCX parser could not read document structure. Attempting fallback decode.");
  }

  const fallbackText = fileBytes.toString("utf8").replace(/\0/g, "").trim();
  if (fallbackText.length === 0) {
    throw makeError(400, "validation_error", "DOCX file contains no readable text", "parse-document", {
      retryable: false
    });
  }

  warnings.push("DOCX fallback decode used; extracted text may be incomplete.");
  return {
    text: fallbackText,
    warnings
  };
}
