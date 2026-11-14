/**
 * Runtime configuration validation.
 *
 * Fails fast in production instead of silently booting with an insecure default.
 * Everything here is server-only: none of these values are exposed to the client.
 */
import { z } from "zod";
import { storage } from "./storage";

const isProduction = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_SECRET: z.string().optional(),
  DATABASE_PATH: z.string().default("./data/estate.db"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  AI_PROVIDER: z.enum(["local", "openai"]).default("local"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4o-mini"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(45_000),
  COOKIE_SECURE: z.string().optional(),
});

function parse() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configuração de ambiente inválida — ${detail}`);
  }
  const env = result.data;

  if (isProduction) {
    if (!env.APP_SECRET || env.APP_SECRET.length < 32) {
      throw new Error(
        "APP_SECRET em falta ou demasiado curto (mínimo 32 caracteres) em produção. Gere com: openssl rand -hex 32",
      );
    }
    if (!env.NEXT_PUBLIC_APP_URL) {
      console.warn(
        "[env] NEXT_PUBLIC_APP_URL não definido — use-o para links de partilha e canonical correctos (ex.: https://app.exemplo.pt).",
      );
    }
  }

  const aiConfigured = env.AI_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);

  // Ephemeral writable storage: /tmp on serverless platforms is wiped on every
  // cold start, so a database or uploads kept there are NOT durable.
  const storageState = storage();
  const resolvedPath = storageState.file;
  const persistent = storageState.persistent;

  return {
    isProduction,
    appSecret: env.APP_SECRET ?? "",
    databasePath: env.DATABASE_PATH,
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
    storage: {
      databasePath: resolvedPath,
      /** False means data is lost on redeploy/scale-in — never present this as production-ready. */
      persistent,
      reason: persistent ? "volume local persistente" : storageState.reason,
    },
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
