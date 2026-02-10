export interface PdfRenderInput {
  analysisId: string;
  headline: string;
  recommendation: string;
  score: number;
}

function escapePdfText(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderPdfDocument(input: PdfRenderInput): Uint8Array {
  const lines = [
    "angle/RFP Analysis Report",
    `Analysis ID: ${input.analysisId}`,
    `Headline: ${input.headline}`,
    `Recommendation: ${input.recommendation}`,
    `Score: ${input.score}`
  ];

  const contentStream = `BT /F1 12 Tf 50 760 Td (${escapePdfText(lines.join(" | "))}) Tj ET`;
  const contentLength = Buffer.byteLength(contentStream, "utf8");

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${contentLength} >>
stream
${contentStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000064 00000 n
0000000121 00000 n
0000000249 00000 n
0000000350 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`;

  return new TextEncoder().encode(pdf);
}
