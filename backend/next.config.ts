import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: {
    "/api/analyze-scope": ["./agencyservicesheet.csv"]
  },
  allowedDevOrigins: ["*"],
};

export default nextConfig;
