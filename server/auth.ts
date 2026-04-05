import crypto from "node:crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "./db";
import { getSessionSecret } from "./env";
import { storage } from "./storage";
import { sendVerificationEmail } from "./services/verificationEmail";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeWorkspaceId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        username: string;
        fullName: string | null;
        workspaceId: string;
        workspaceName: string;
        workspaceSlug: string;
        workspaceRole: string;
        onboardingStatus: string;
        emailVerifiedAt: Date | null;
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

const BUSINESS_EMAIL_BLOCKLIST = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "ymail.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);

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

function extractDomain(email: string) {
  return email.toLowerCase().split("@")[1] ?? "";
}

function isBusinessEmail(email: string) {
  const domain = extractDomain(email);
  return Boolean(domain) && !BUSINESS_EMAIL_BLOCKLIST.has(domain);
}

function sanitizeUser(user: {
  id: string;
  username: string;
  fullName: string | null;
  emailVerifiedAt?: Date | null;
}) {
  return {
    id: user.id,
    email: user.username,
    fullName: user.fullName,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

function sanitizeWorkspace(context: {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceRole?: string;
  onboardingStatus: string;
}) {
  return {
    id: context.workspaceId,
    name: context.workspaceName,
    slug: context.workspaceSlug,
    role: context.workspaceRole ?? "member",
    onboardingStatus: context.onboardingStatus,
  };
}

async function issueVerification(email: string, userId: string, fullName?: string | null) {
  const token = await storage.createEmailVerificationToken(userId, email);
  return sendVerificationEmail({ email, fullName, token });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

export function requireWorkspaceRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.authUser.workspaceRole)) {
      return res.status(403).json({
        message: "You do not have permission to manage this workspace setting",
      });
    }

    return next();
  };
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
    if (!user || !user.emailVerifiedAt) {
      req.session.userId = undefined;
      req.session.activeWorkspaceId = undefined;
      return next();
    }

    let context = await storage.getWorkspaceContextForUser(user.id);
    if (!context) {
      context = await storage.createOrJoinWorkspaceForUser(user);
    }

    req.session.activeWorkspaceId = context.workspace.id;
    req.authUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName ?? null,
      workspaceId: context.workspace.id,
      workspaceName: context.workspace.name,
      workspaceSlug: context.workspace.slug,
      workspaceRole: context.membership.role,
      onboardingStatus: context.workspace.onboardingStatus,
      emailVerifiedAt: user.emailVerifiedAt,
    };
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

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const user = await storage.consumeEmailVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "Verification link is invalid or expired" });
      }

      const workspaceContext = await storage.createOrJoinWorkspaceForUser(user);
      req.session.userId = user.id;
      req.session.activeWorkspaceId = workspaceContext.workspace.id;

      return res.status(200).json({
        verified: true,
        user: sanitizeUser(user),
        workspace: sanitizeWorkspace({
          workspaceId: workspaceContext.workspace.id,
          workspaceName: workspaceContext.workspace.name,
          workspaceSlug: workspaceContext.workspace.slug,
          workspaceRole: workspaceContext.membership.role,
          onboardingStatus: workspaceContext.workspace.onboardingStatus,
        }),
        redirectTo:
          workspaceContext.workspace.onboardingStatus === "completed"
            ? "/upload"
            : "/workspace",
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to verify email" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.authUser) return res.json({ user: null, workspace: null, onboarding: null });
      const context = await storage.getWorkspaceContextForUser(req.authUser.id);
      return res.json({
        user: sanitizeUser(req.authUser),
        workspace: sanitizeWorkspace(req.authUser),
        onboarding: {
        status: context?.workspace.onboardingStatus ?? req.authUser.onboardingStatus,
        calibrationState:
          context?.profile?.status === "completed"
            ? "full"
            : context?.profile?.status === "in_progress"
              ? "partial"
              : "default",
      },
    });
  });

  app.post("/api/auth/sign-up", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const email = input.email.toLowerCase();
      if (!isBusinessEmail(email)) {
        return res.status(400).json({
          message: "Use your business email to create or join an agency workspace.",
        });
      }

      const existing = await storage.getUserByUsername(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const user = await storage.createUser({
        username: email,
        password: await hashPassword(input.password),
        fullName: input.fullName,
      });
      const delivery = await issueVerification(email, user.id, user.fullName);
      return res.status(201).json({
        verificationRequired: true,
        email,
        verificationDelivery: delivery.delivery,
        verificationPreviewUrl: delivery.verificationPreviewUrl,
        redirectTo: delivery.redirectTo,
      });
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

      if (!user.emailVerifiedAt) {
        const delivery = await issueVerification(email, user.id, user.fullName);
        return res.status(403).json({
          message: "Email verification required",
          verificationRequired: true,
          email,
          verificationDelivery: delivery.delivery,
          verificationPreviewUrl: delivery.verificationPreviewUrl,
          redirectTo: delivery.redirectTo,
        });
      }

      const context = (await storage.getWorkspaceContextForUser(user.id)) || (await storage.createOrJoinWorkspaceForUser(user));
      req.session.userId = user.id;
      req.session.activeWorkspaceId = context.workspace.id;
      return res.status(200).json({
        user: sanitizeUser(user),
        workspace: sanitizeWorkspace({
          workspaceId: context.workspace.id,
          workspaceName: context.workspace.name,
          workspaceSlug: context.workspace.slug,
          workspaceRole: context.membership.role,
          onboardingStatus: context.workspace.onboardingStatus,
        }),
        redirectTo: context.workspace.onboardingStatus === "completed" ? "/upload" : "/workspace",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message || "Invalid sign-in data" });
      }
      return res.status(500).json({ message: error.message || "Failed to sign in" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const email = z.string().trim().email().parse(req.body?.email).toLowerCase();
      if (!isBusinessEmail(email)) {
        return res.status(200).json({
          verificationRequired: true,
          email,
          verificationDelivery: "email",
          redirectTo: `/verify-email?sent=1&email=${encodeURIComponent(email)}`,
        });
      }

      const user = await storage.getUserByUsername(email);
      if (!user || user.emailVerifiedAt) {
        return res.status(200).json({
          verificationRequired: false,
          email,
          redirectTo: "/sign-in",
        });
      }

      const delivery = await issueVerification(email, user.id, user.fullName);
      return res.status(200).json({
        verificationRequired: true,
        email,
        verificationDelivery: delivery.delivery,
        verificationPreviewUrl: delivery.verificationPreviewUrl,
        redirectTo: delivery.redirectTo,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message || "Invalid email address" });
      }
      return res.status(500).json({ message: error.message || "Failed to resend verification email" });
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
