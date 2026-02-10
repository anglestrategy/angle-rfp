import fs from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { exportAnalysis } from "@/lib/export/export-service";

const reportFixture = {
  schemaVersion: "1.0.0",
  analysisId: "e6c1c93e-6f43-4f16-bbe0-30761998a4db",
  summary: {
    headline: "High-value bilingual campaign opportunity",
    recommendation: "Proceed with standard diligence",
    score: 78.2
  }
};

describe("exportAnalysis", () => {
  test("exports PDF artifact and schedules deletion", async () => {
    process.env.EXPORT_RETENTION_MINUTES = "0";

    const result = await exportAnalysis({
      analysisId: reportFixture.analysisId,
      report: reportFixture,
      format: "pdf"
    });

    expect(result.schemaVersion).toBe("1.0.0");
    expect(result.artifact.type).toBe("file");
    expect(result.retention.deletionScheduled).toBe(true);

    const filePath = String(result.artifact.filePath);
    const fileBytes = await fs.readFile(filePath);
    expect(fileBytes.slice(0, 4).toString("utf8")).toBe("%PDF");

    await new Promise((resolve) => setTimeout(resolve, 40));
    await expect(fs.access(filePath)).rejects.toThrow();
  });

  test("exports email payload format", async () => {
    const result = await exportAnalysis({
      analysisId: reportFixture.analysisId,
      report: reportFixture,
      format: "email"
    });

    expect(result.format).toBe("email");
    expect(result.artifact.type).toBe("email_payload");
    expect(String(result.artifact.subject)).toContain("RFP Analysis");
  });

  test("exports share link with token and expiry", async () => {
    const result = await exportAnalysis({
      analysisId: reportFixture.analysisId,
      report: reportFixture,
      format: "link"
    });

    expect(result.format).toBe("link");
    expect(result.artifact.type).toBe("share_link");
    expect(String(result.artifact.url)).toContain("/r/");
    expect(typeof result.artifact.token).toBe("string");
  });
});
