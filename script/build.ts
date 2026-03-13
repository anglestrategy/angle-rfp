import { build as esbuild } from "esbuild";
import { rm, readFile, writeFile, mkdir, cp } from "fs/promises";
import path from "path";

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

  console.log("building client...");
  const clientResult = await esbuild({
    entryPoints: ["client/src/main.tsx"],
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

  const outputFiles = Object.keys(clientResult.metafile.outputs);
  const entryJs = outputFiles.find((file) => file.startsWith("dist/public/assets/main-") && file.endsWith(".js"));
  const entryCss = outputFiles.find((file) => file.startsWith("dist/public/assets/main-") && file.endsWith(".css"));

  if (!entryJs) {
    throw new Error("Client build failed: entry JavaScript bundle was not generated");
  }

  const indexTemplate = await readFile("client/index.html", "utf-8");
  const productionIndex = indexTemplate
    .replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, `<script type="module" src="/assets/${path.basename(entryJs)}"></script>`)
    .replace(
      "</head>",
      entryCss ? `    <link rel="stylesheet" href="/assets/${path.basename(entryCss)}" />\n  </head>` : "</head>",
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
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
