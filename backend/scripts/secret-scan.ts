import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Rule = {
  id: string;
  description: string;
  regex: RegExp;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/scripts/* -> backend -> repo root
const repoRoot = path.resolve(__dirname, "..", "..");

const EXCLUDE_PREFIXES = [
  ".git/",
  "backend/.next/",
  "backend/node_modules/",
  "backend/coverage/",
  "backend/.turbo/",
  // Test suites intentionally contain fake token-like strings to validate redaction.
  "backend/tests/",
  "angle-rfpTests/"
];

const rules: Rule[] = [
  {
    id: "anthropic_api_key",
    description: "Anthropic/Claude API key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g
  },
  {
    id: "brave_search_key",
    description: "Brave Search API key",
    regex: /\bBSA[A-Za-z0-9_-]{16,}\b/g
  },
  {
    id: "github_pat",
    description: "GitHub personal access token",
    regex: /\bghp_[A-Za-z0-9]{20,}\b/g
  },
  {
    id: "private_key_block",
    description: "Private key block header",
    regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/g
  },
  {
    id: "aws_access_key_id",
    description: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/g
  }
];

function gitLsFiles(root: string): string[] {
  const out = execFileSync("git", ["-C", root, "ls-files", "-z"], {
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return out
    .toString("utf8")
    .split("\0")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isExcluded(relPath: string): boolean {
  const normalized = relPath.replaceAll("\\", "/");
  return EXCLUDE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isProbablyBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, 8_000);
  let nonPrintable = 0;

  for (const b of sample) {
    if (b === 0) return true; // NUL byte is a strong binary signal.
    if (b === 9 || b === 10 || b === 13) continue; // whitespace
    if (b < 32 || b > 126) nonPrintable += 1;
  }

  return nonPrintable / Math.max(1, sample.length) > 0.3;
}

function redactToken(token: string): string {
  // Never print full secrets in logs.
  if (token.length <= 12) return "[REDACTED]";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function getLineNumber(text: string, index: number): number {
  // 1-based line numbers; ok to be O(n) since matches should be rare.
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

type Finding = {
  ruleId: string;
  description: string;
  file: string;
  line: number;
  redactedMatch: string;
};

function main(): void {
  const files = gitLsFiles(repoRoot);
  const findings: Finding[] = [];

  for (const rel of files) {
    if (isExcluded(rel)) continue;

    const abs = path.join(repoRoot, rel);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }

    if (!stat.isFile()) continue;

    let buf: Buffer;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      continue;
    }

    if (isProbablyBinary(buf)) continue;

    const text = buf.toString("utf8");

    for (const rule of rules) {
      for (const match of text.matchAll(rule.regex)) {
        const token = match[0] ?? "";

        // Allow explicit placeholders/redactions in docs.
        if (token.includes("[REDACTED]") || token.includes("REDACTED")) continue;

        const index = match.index ?? 0;
        findings.push({
          ruleId: rule.id,
          description: rule.description,
          file: rel,
          line: getLineNumber(text, index),
          redactedMatch: redactToken(token)
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log("✅ Secret scan: no potential secrets found in tracked, non-test files.");
    return;
  }

  console.error("❌ Secret scan: potential secrets detected.");
  for (const f of findings) {
    console.error(`- ${f.ruleId} (${f.description}) ${f.file}:${f.line} -> ${f.redactedMatch}`);
  }

  console.error("\nRemediation:");
  console.error("- Remove secrets from the repo and rotate the compromised keys.");
  console.error("- Use environment variables (Vercel) / macOS Keychain (app) for local storage.");
  process.exitCode = 1;
}

main();

