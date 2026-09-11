import { z } from "zod";

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

/**
 * Every secret AuthForge needs comes from the environment — nothing is
 * hardcoded. This module validates them once at boot so a missing/blank
 * secret fails loudly at startup instead of silently at runtime.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_SECRET_PREVIOUS: z.preprocess(emptyToUndefined, z.string().min(32).optional()),

  NEXTAUTH_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  APP_URL: z.string().url().default("http://localhost:3000"),

  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GITHUB_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GITHUB_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  UPSTASH_REDIS_REST_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),

  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().email().optional()),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables — check .env against .env.example");
  }
  return parsed.data;
}

// Lazily validated so `next build` without a real DB configured doesn't
// crash the whole toolchain (Next collects route metadata at build time).
let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}
