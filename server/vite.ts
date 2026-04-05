import { type Express } from "express";
import { type Server } from "http";
import { createRequire } from "node:module";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const require = createRequire(path.resolve(process.cwd(), "package.json"));

export async function setupVite(server: Server, app: Express) {
  const viteModule: any = require("vite");
  const react: any = require("@vitejs/plugin-react");
  const viteLogger = viteModule.createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await viteModule.createServer({
    configFile: false,
    root: path.resolve(process.cwd(), "client"),
    plugins: [react()],
    css: {
      postcss: process.cwd(),
    },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "client", "src"),
        "@shared": path.resolve(process.cwd(), "shared"),
        "@assets": path.resolve(process.cwd(), "attached_assets"),
      },
    },
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: Record<string, unknown>) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
