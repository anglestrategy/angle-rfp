import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AI_INTEGRATIONS_ANTHROPIC_API_KEY: z
    .string()
    .min(1, "AI_INTEGRATIONS_ANTHROPIC_API_KEY is required"),
  SESSION_SECRET: z.string().optional(),
  APP_BASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getValidatedEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }

  if (parsed.data.NODE_ENV === "production" && !parsed.data.SESSION_SECRET) {
    throw new Error("Invalid environment: SESSION_SECRET is required in production");
  }

  return parsed.data;
}

export function getSessionSecret() {
  return process.env.SESSION_SECRET || "dev-session-secret-change-me";
}
