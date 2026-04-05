import { build as esbuild } from "esbuild";
import { rm, readFile, writeFile, mkdir, cp } from "fs/promises";
import path from "path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  await rm(".build-tmp", { recursive: true, force: true });
  const clientEnv = {
    "import.meta.env.DEV": "false",
    "import.meta.env.VITE_ENABLE_DEV_PRELOADER": JSON.stringify(process.env.VITE_ENABLE_DEV_PRELOADER ?? ""),
  };
  await mkdir(".build-tmp", { recursive: true });

  const mainSource = await readFile("client/src/main.tsx", "utf-8");
  const clientEntryPath = path.resolve(".build-tmp/main.tsx");
  await writeFile(
    clientEntryPath,
    mainSource
      .replace(/^import\s+["']\.\/index\.css["'];\s*$/m, "")
      .replace(/from\s+["']\.\/App["']/g, 'from "../client/src/App"'),
    "utf-8",
  );

  console.log("building client...");
  const clientResult = await esbuild({
    entryPoints: [clientEntryPath],
    bundle: true,
    outdir: "dist/public/assets",
    entryNames: "[name]-[hash]",
    assetNames: "asset-[name]-[hash]",
    chunkNames: "chunk-[name]-[hash]",
    format: "esm",
    splitting: true,
    platform: "browser",
    target: ["es2020"],
    minify: true,
    metafile: true,
    sourcemap: false,
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"production"',
      ...clientEnv,
    },
    loader: {
      ".svg": "file",
      ".png": "file",
      ".jpg": "file",
      ".jpeg": "file",
      ".webp": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    alias: {
      "@": path.resolve("client/src"),
      "@shared": path.resolve("shared"),
      "@assets": path.resolve("attached_assets"),
    },
    logLevel: "info",
  });

  await execFileAsync(
    path.resolve("node_modules/.bin/tailwindcss"),
    [
      "-i",
      path.resolve("client/src/index.css"),
      "-o",
      path.resolve("dist/public/assets/main.css"),
      "--config",
      path.resolve("tailwind.config.ts"),
      "--minify",
    ],
    {
      env: process.env,
    },
  );

  const outputFiles = Object.keys(clientResult.metafile.outputs);
  const entryJs = outputFiles.find((file) => file.startsWith("dist/public/assets/main-") && file.endsWith(".js"));

  if (!entryJs) {
    throw new Error("Client build failed: entry JavaScript bundle was not generated");
  }

  const indexTemplate = await readFile("client/index.html", "utf-8");
  const productionIndex = indexTemplate
    .replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, `<script type="module" src="/assets/${path.basename(entryJs)}"></script>`)
    .replace(
      "</head>",
      `    <link rel="stylesheet" href="/assets/main.css" />\n  </head>`,
    );

  await mkdir("dist/public", { recursive: true });
  await writeFile("dist/public/index.html", productionIndex, "utf-8");
  await cp("client/public", "dist/public", { recursive: true });

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
      ...clientEnv,
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  await rm(".build-tmp", { recursive: true, force: true });
}

buildAll()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
