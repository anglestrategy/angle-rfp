import { describe, expect, test } from "vitest";
import { parseDocumentInput } from "@/lib/parsing/parse-document";

function uuid(): string {
  return "5b92d2fe-77be-4f15-9b89-cb7ddf0fe4f2";
}

describe("parseDocumentInput", () => {
  test("parses English TXT and detects sections", async () => {
    const txt = [
      "Client: Example Corp",
      "Scope of Work",
      "Deliverables include a brand strategy and social media assets.",
      "Evaluation Criteria",
      "Technical approach 30%",
      "Timeline and deadlines"
    ].join("\n");

    const parsed = await parseDocumentInput({
      analysisId: uuid(),
      fileName: "sample.txt",
      mimeType: "text/plain",
      fileBytes: Buffer.from(txt, "utf8")
    });

    expect(parsed.detectedFormat).toBe("txt");
    expect(parsed.primaryLanguage).toBe("english");
    expect(parsed.sections.length).toBeGreaterThan(0);
    expect(parsed.evidenceMap.length).toBeGreaterThan(0);
  });

  test("detects Arabic text", async () => {
    const text = "نطاق العمل يشمل تطوير الهوية ومعايير التقييم والجدول الزمني.";

    const parsed = await parseDocumentInput({
      analysisId: uuid(),
      fileName: "arabic.txt",
      mimeType: "text/plain",
      fileBytes: Buffer.from(text, "utf8")
    });

    expect(parsed.primaryLanguage).toBe("arabic");
  });

  test("parses low-text PDF and invokes OCR adapter", async () => {
    const pdfMinimal = "%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF";

    const parsed = await parseDocumentInput({
      analysisId: uuid(),
      fileName: "scan.pdf",
      mimeType: "application/pdf",
      fileBytes: Buffer.from(pdfMinimal, "latin1"),
      ocrProvider: {
        async performOcr() {
          return {
            text: "OCR recovered text نطاق العمل",
            pagesOcred: 1,
            warnings: ["OCR used for one page"]
          };
        }
      }
    });

    expect(parsed.detectedFormat).toBe("pdf");
    expect(parsed.ocrStats).toEqual({ used: true, pagesOcred: 1 });
    expect(parsed.rawText).toContain("OCR recovered text");
    expect(parsed.warnings.some((warning) => warning.includes("OCR"))).toBe(true);
  });

  test("parses DOCX payload with fallback decode when structure is invalid", async () => {
    const fakeDocxPayload = Buffer.from("Project Name: Mock DOCX\nScope of Work\nEvaluation Criteria", "utf8");

    const parsed = await parseDocumentInput({
      analysisId: uuid(),
      fileName: "sample.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBytes: fakeDocxPayload
    });

    expect(parsed.detectedFormat).toBe("docx");
    expect(parsed.rawText).toContain("Project Name");
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });

  test("rejects file above max size", async () => {
    const tooLarge = Buffer.alloc(31 * 1024 * 1024, 1);

    await expect(
      parseDocumentInput({
        analysisId: uuid(),
        fileName: "large.txt",
        mimeType: "text/plain",
        fileBytes: tooLarge
      })
    ).rejects.toThrowError(/exceeds/);
  });
});
