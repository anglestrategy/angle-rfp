import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const apiTarget = process.env.VITE_API_TARGET;
const isReplitDev =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined;

export default defineConfig({
  cacheDir: path.resolve(import.meta.dirname, "node_modules/.vite-client"),
  // Force PostCSS discovery from the repo root; Vite's default search
  // from `client/` intermittently fails in this workspace.
  css: {
    postcss: path.resolve(import.meta.dirname),
  },
  plugins: [
    react(),
    ...(isReplitDev
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    hmr: {
      overlay: false,
    },
    proxy: apiTarget
      ? {
          "/api": {
            target: apiTarget,
            changeOrigin: true,
          },
        }
      : undefined,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    watch: {
      ignored: ["**/node_modules.broken*/**"],
    },
  },
});
