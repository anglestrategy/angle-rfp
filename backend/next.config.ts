import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Monorepo: prevent Next from tracing from an incorrect workspace root (can break serverless output on deploy).
  outputFileTracingRoot: __dirname,
  // Ensure the agency taxonomy CSV is bundled for the analyze-scope route on Vercel.
  outputFileTracingIncludes: {
    "/api/analyze-scope": ["./agencyservicesheet.csv"]
  }
};

export default nextConfig;
