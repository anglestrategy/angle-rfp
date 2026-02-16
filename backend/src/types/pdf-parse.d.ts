declare module "pdf-parse" {
  interface PdfParseResult {
    text?: string;
    numpages?: number;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
