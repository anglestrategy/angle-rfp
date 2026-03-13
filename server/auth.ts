import crypto from "node:crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "./db";
import { getSessionSecret } from "./env";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        username: string;
        fullName: string | null;
      };
    }
  }
}

const authSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(255),
});

const registerSchema = authSchema.extend({
  fullName: z.string().trim().min(2).max(255),
});

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  const derived = await scryptAsync(password, salt);
  return crypto.timingSafeEqual(Buffer.from(stored, "hex"), derived);
}

function sanitizeUser(user: { id: string; username: string; fullName: string | null }) {
  return {
    id: user.id,
    email: user.username,
    fullName: user.fullName,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

export async function attachAuth(app: Express) {
  const PgStore = connectPgSimple(session);
  app.set("trust proxy", 1);
  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: getSessionSecret(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 14,
      },
    }),
  );

  app.use(async (req, _res, next) => {
    const userId = req.session.userId;
    if (!userId) return next();
    const user = await storage.getUser(userId);
    if (user) {
      req.authUser = {
        id: user.id,
        username: user.username,
        fullName: user.fullName ?? null,
      };
    } else {
      req.session.userId = undefined;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      await pool.query("select 1");
      res.status(200).json({
        status: "ready",
        database: "ok",
        ai: Boolean(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY),
      });
    } catch (error: any) {
      res.status(503).json({
        status: "degraded",
        database: "error",
        message: error.message || "Database unavailable",
      });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.authUser) return res.json({ user: null });
    return res.json({ user: sanitizeUser(req.authUser) });
  });

  app.post("/api/auth/sign-up", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const email = input.email.toLowerCase();
      const existing = await storage.getUserByUsername(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const user = await storage.createUser({
        username: email,
        password: await hashPassword(input.password),
        fullName: input.fullName,
      });
      req.session.userId = user.id;
      return res.status(201).json({ user: sanitizeUser(user) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message || "Invalid sign-up data" });
      }
      return res.status(500).json({ message: error.message || "Failed to create account" });
    }
  });

  app.post("/api/auth/sign-in", async (req, res) => {
    try {
      const input = authSchema.parse(req.body);
      const email = input.email.toLowerCase();
      const user = await storage.getUserByUsername(email);
      if (!user || !(await verifyPassword(input.password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      req.session.userId = user.id;
      return res.status(200).json({ user: sanitizeUser(user) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message || "Invalid sign-in data" });
      }
      return res.status(500).json({ message: error.message || "Failed to sign in" });
    }
  });

  app.post("/api/auth/sign-out", (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ message: "Failed to sign out" });
      }
      res.clearCookie("connect.sid");
      return res.status(204).send();
    });
  });
}
