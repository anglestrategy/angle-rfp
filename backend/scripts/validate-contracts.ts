import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { AnySchema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repoRoot = path.resolve(process.cwd(), "..");
const openApiPath = path.join(repoRoot, "contracts", "openapi", "angle-rfp-v1.yaml");
const schemasDir = path.join(repoRoot, "contracts", "schemas", "v1");
const fixturesDir = path.join(repoRoot, "contracts", "fixtures", "v1");

async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function validateOpenApi(): Promise<void> {
  await SwaggerParser.validate(openApiPath);
  console.log("[ok] OpenAPI validation passed");
}

async function validateSchemasAndFixtures(): Promise<void> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const schemaFiles = (await fs.readdir(schemasDir))
    .filter((file) => file.endsWith(".schema.json"))
    .sort();

  for (const schemaFile of schemaFiles) {
    const schemaPath = path.join(schemasDir, schemaFile);
    const schema = await readJson(schemaPath);
    ajv.addSchema(schema as AnySchema);
  }

  const fixtureToSchemaId: Record<string, string> = {
    "parsed-document.fixture.json": "https://angle-rfp.dev/schemas/v1/parsed-document-v1.schema.json",
    "extracted-rfp-data.fixture.json": "https://angle-rfp.dev/schemas/v1/extracted-rfp-data-v1.schema.json",
    "scope-analysis.fixture.json": "https://angle-rfp.dev/schemas/v1/scope-analysis-v1.schema.json",
    "client-research.fixture.json": "https://angle-rfp.dev/schemas/v1/client-research-v1.schema.json",
    "financial-score.fixture.json": "https://angle-rfp.dev/schemas/v1/financial-score-v1.schema.json",
    "analysis-report.fixture.json": "https://angle-rfp.dev/schemas/v1/analysis-report-v1.schema.json",
    "api-envelope-success.fixture.json": "https://angle-rfp.dev/schemas/v1/api-envelope.schema.json",
    "api-envelope-error.fixture.json": "https://angle-rfp.dev/schemas/v1/api-envelope.schema.json"
  };

  for (const [fixtureFile, schemaId] of Object.entries(fixtureToSchemaId)) {
    const fixturePath = path.join(fixturesDir, fixtureFile);
    const fixture = await readJson(fixturePath);
    const validate = ajv.getSchema(schemaId);

    if (!validate) {
      throw new Error(`Schema not registered: ${schemaId}`);
    }

    const ok = validate(fixture);
    if (!ok) {
      const details = (validate.errors ?? []).map((error) => `${error.instancePath} ${error.message}`).join("; ");
      throw new Error(`Fixture ${fixtureFile} failed validation: ${details}`);
    }

    console.log(`[ok] ${fixtureFile}`);
  }

  console.log("[ok] Schema + fixture validation passed");
}

async function main(): Promise<void> {
  await validateOpenApi();
  await validateSchemasAndFixtures();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exit(1);
});
