export interface OcrResult {
  text: string;
  pagesOcred: number;
  warnings: string[];
}

export interface OcrProvider {
  performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult>;
}

class StubVisionOcrProvider implements OcrProvider {
  async performOcr(input: {
    fileBytes: Buffer;
    fileName: string;
    pagesHint: number;
  }): Promise<OcrResult> {
    const hasKey = Boolean(process.env.GOOGLE_VISION_API_KEY);

    if (!hasKey) {
      return {
        text: "",
        pagesOcred: 0,
        warnings: [
          `OCR fallback requested for ${input.fileName}, but GOOGLE_VISION_API_KEY is not configured.`
        ]
      };
    }

    return {
      text: "",
      pagesOcred: 0,
      warnings: [
        `OCR provider wiring is configured but no live implementation exists yet for ${input.fileName}.`
      ]
    };
  }
}

export function createOcrProvider(): OcrProvider {
  return new StubVisionOcrProvider();
}
