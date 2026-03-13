import "dotenv/config";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { attachAuth } from "./auth";
import { getValidatedEnv } from "./env";
import { getAnalysisFeatureFlags } from "./services/analysisFlags";

getValidatedEnv();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  log("boot: attachAuth start");
  await attachAuth(app);
  log("boot: attachAuth done");
  log("boot: registerRoutes start");
  await registerRoutes(httpServer, app);
  log("boot: registerRoutes done");
  const flags = getAnalysisFeatureFlags();
  if (flags.analysisWorker) {
    log("boot: startAnalysisWorker");
    const { startAnalysisWorker } = await import("./services/analysisWorker");
    startAnalysisWorker();
    log("boot: startAnalysisWorker done");
  } else {
    log("boot: analysis worker disabled");
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const skipViteInDev =
    process.env.NODE_ENV !== "production" &&
    ["1", "true", "yes", "on"].includes((process.env.SKIP_VITE || "").toLowerCase());

  if (process.env.NODE_ENV === "production") {
    log("boot: serveStatic");
    serveStatic(app);
  } else if (!skipViteInDev) {
    log("boot: setupVite start");
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    log("boot: setupVite done");
  } else {
    log("boot: skip vite in dev");
    app.get("/", (_req, res) => {
      res
        .status(200)
        .type("text/plain")
        .send("API-only dev server is running. Start the standalone Vite dev server for the UI.");
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  log(`boot: listen start ${port}`);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
