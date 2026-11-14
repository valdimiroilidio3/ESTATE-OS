/**
 * Runtime configuration validation.
 *
 * Fails fast in production instead of silently booting with an insecure default.
 * Everything here is server-only: none of these values are exposed to the client.
 */
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_SECRET: z.string().optional(),
  // Any PostgreSQL connection string. Vercel Postgres exposes POSTGRES_URL, Neon
  // and Supabase give DATABASE_URL; both are accepted.
  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  AI_PROVIDER: z.enum(["local", "openai"]).default("local"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4o-mini"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(45_000),
  COOKIE_SECURE: z.string().optional(),
  STORAGE_DRIVER: z.enum(["db", "fs"]).optional(),
  AUTO_MIGRATE: z.string().optional(),
  HEALTH_TOKEN: z.string().optional(),
});

function redact(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}/${parsed.pathname.replace(/^\//, "")}`;
  } catch {
    return "definido";
  }
}

function parse() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuração de ambiente inválida — ${detail}`);
  }
  const env = result.data;
  const databaseUrl = env.DATABASE_URL ?? env.POSTGRES_URL ?? "";

  if (isProduction) {
    if (!env.APP_SECRET || env.APP_SECRET.length < 32) {
      throw new Error(
        "APP_SECRET em falta ou demasiado curto (mínimo 32 caracteres) em produção. Gere com: openssl rand -hex 32",
      );
    }
    // A missing DATABASE_URL is not a crash: the app renders a setup screen that
    // explains exactly what to configure. Only the secret is a hard failure.
    if (!env.NEXT_PUBLIC_APP_URL) {
      console.warn(
        "[env] NEXT_PUBLIC_APP_URL não definido — use-o para links de partilha e canonical correctos (ex.: https://app.exemplo.pt).",
      );
    }
  }

  // Production-only warnings. They do not stop the app (a warning beats an
  // outage) but they name the exact variable that is unsafe.
  const warnings: string[] = [];
  if (isProduction) {
    if (env.COOKIE_SECURE === "false") {
      warnings.push(
        "COOKIE_SECURE=false em produção: o cookie de sessão viaja sem Secure. Remova a variável fora de testes locais.",
      );
    }
    if (databaseUrl && /sslmode=disable/i.test(databaseUrl)) {
      warnings.push("DATABASE_URL com sslmode=disable: a ligação à base de dados não é cifrada.");
    }
    if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      warnings.push("AI_PROVIDER=openai sem OPENAI_API_KEY: o motor determinístico local é usado.");
    }
    for (const warning of warnings) console.warn(`[env] ${warning}`);
  }

  const aiConfigured = env.AI_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
  const storageDriver = env.STORAGE_DRIVER ?? (process.env.VERCEL ? "db" : "fs");

  return {
    isProduction,
    appSecret: env.APP_SECRET ?? "",
    database: {
      configured: Boolean(databaseUrl),
      /** Host only: never log credentials. */
      host: databaseUrl ? redact(databaseUrl) : "",
      /** TLS is expected for managed providers; sockets and localhost are exempt. */
      encrypted: databaseUrl ? !/sslmode=disable/i.test(databaseUrl) : false,
    },
    /** Environment problems that were reported but did not stop the process. */
    warnings,
    storage: {
      driver: storageDriver as "db" | "fs",
      /** Bytes in PostgreSQL survive redeploys; local files do not. */
      persistent: true,
    },
    appUrl: env.NEXT_PUBLIC_APP_URL ?? "",
    ai: {
      provider: env.AI_PROVIDER,
      configured: aiConfigured,
      model: env.OPENAI_TEXT_MODEL,
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      /** "model" only when a provider is configured; otherwise the deterministic engine runs. */
      mode: (aiConfigured ? "model" : "deterministic") as "model" | "deterministic",
    },
    cookieSecure: env.COOKIE_SECURE === "false" ? false : isProduction,
    healthTokenConfigured: Boolean(env.HEALTH_TOKEN && env.HEALTH_TOKEN.length >= 16),
  };
}

let cached: ReturnType<typeof parse> | null = null;

export function config() {
  if (!cached) cached = parse();
  return cached;
}

/** Called once from the root layout so a misconfigured deployment fails loudly. */
export function assertRuntimeConfig() {
  config();
}
