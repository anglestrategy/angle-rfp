import crypto from "node:crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "./db";
import { getSessionSecret } from "./env";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeWorkspaceId?: string;
    oauthState?: string;
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
  "tutanota.com",
  "zoho.com",
  "aol.com",
]);

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
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!clientId || !clientSecret) return null;
  const redirectUri = baseUrl
    ? `${baseUrl.replace(/\/+$/, "")}/api/auth/google/callback`
    : "http://127.0.0.1:5000/api/auth/google/callback";
  return { clientId, clientSecret, redirectUri };
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

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many sign-in attempts. Please try again in a few minutes." },
  });

  app.get("/api/auth/google", oauthLimiter, (req, res) => {
    const config = getGoogleOAuthConfig();
    if (!config) {
      return res.status(503).json({ message: "Google sign-in is not configured" });
    }

    const state = crypto.randomBytes(24).toString("hex");
    req.session.oauthState = state;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state,
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const config = getGoogleOAuthConfig();
    if (!config) {
      return res.redirect("/sign-in?error=oauth_not_configured");
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const error = typeof req.query.error === "string" ? req.query.error : "";

    if (error) {
      return res.redirect(`/sign-in?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state || state !== req.session.oauthState) {
      return res.redirect("/sign-in?error=invalid_state");
    }
    req.session.oauthState = undefined;

    try {
      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const detail = await tokenRes.text();
        console.error("[auth] Google token exchange failed:", detail);
        return res.redirect("/sign-in?error=token_exchange_failed");
      }

      const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };

      // Get user info
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoRes.ok) {
        return res.redirect("/sign-in?error=userinfo_failed");
      }

      const profile = (await userInfoRes.json()) as {
        email?: string;
        name?: string;
        verified_email?: boolean;
        hd?: string; // hosted domain for Google Workspace
      };

      const email = profile.email?.toLowerCase().trim();
      if (!email) {
        return res.redirect("/sign-in?error=no_email");
      }

      if (!isBusinessEmail(email)) {
        return res.redirect("/sign-in?error=personal_email");
      }

      // Find or create user
      let user = await storage.getUserByUsername(email);
      if (!user) {
        const placeholderPassword = crypto.randomBytes(32).toString("hex");
        user = await storage.createUser({
          username: email,
          password: placeholderPassword,
          fullName: profile.name || null,
        });
        // Auto-verify OAuth users since Google already verified the email
        await storage.markUserEmailVerified(user.id);
        user = (await storage.getUser(user.id))!;
      } else if (!user.emailVerifiedAt) {
        // Auto-verify existing users who sign in via OAuth
        await storage.markUserEmailVerified(user.id);
        user = (await storage.getUser(user.id))!;
      }

      // Set up workspace and session
      const context =
        (await storage.getWorkspaceContextForUser(user.id)) ||
        (await storage.createOrJoinWorkspaceForUser(user));

      req.session.userId = user.id;
      req.session.activeWorkspaceId = context.workspace.id;

      const redirectTo =
        context.workspace.onboardingStatus === "completed" ? "/upload" : "/workspace";

      return res.redirect(redirectTo);
    } catch (err: any) {
      console.error("[auth] Google OAuth error:", err);
      return res.redirect("/sign-in?error=oauth_failed");
    }
  });

  // ── Sign out ──────────────────────────────────────────────────────────────

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
