/**
 * Where the instance keeps its data on disk.
 *
 * The product is built for a single host with a persistent volume. On hosts with a
 * read-only project directory (serverless bundles) or a temporary filesystem, we
 * still need an honest answer: either the data survives a restart, or the operator
 * is told clearly that it does not.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type StorageState = {
  /** Absolute path of the SQLite file actually in use. */
  file: string;
  /** True only when the file lives outside a temporary filesystem. */
  persistent: boolean;
  /** Human-readable (Portuguese) explanation, shown by /api/health. */
  reason: string;
  /** Set when the configured path was unusable and a temporary one was chosen. */
  fallbackFrom?: string;
};

const TEMP_ROOTS = ["/tmp/", "/var/folders/", "/private/tmp/"];

function isTemporary(file: string): boolean {
  return TEMP_ROOTS.some((root) => file.startsWith(root));
}

function onServerless(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function tryPrepare(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

let cached: StorageState | null = null;

export function storage(): StorageState {
  if (cached) return cached;

  const configured = process.env.DATABASE_PATH ?? path.join(".", "data", "estate.db");
  const wanted = path.resolve(process.cwd(), configured);
  const fallbackDir = path.join(os.tmpdir(), "estate-os");

  let state: StorageState;
  if (tryPrepare(path.dirname(wanted))) {
    state = { file: wanted, persistent: !isTemporary(wanted), reason: "" };
  } else {
    fs.mkdirSync(fallbackDir, { recursive: true });
    state = {
      file: path.join(fallbackDir, "estate.db"),
      persistent: false,
      reason: "o diretório configurado não é escrevível",
      fallbackFrom: wanted,
    };
  }

  if (!state.persistent) {
    state.reason =
      state.reason ||
      (onServerless()
        ? "plataforma serverless: o sistema de ficheiros é efémero"
        : "diretório temporário: os dados são apagados ao reiniciar");
    if (onServerless() && !state.fallbackFrom) {
      // Keep the resolved path but make the ephemeral nature explicit.
      state.reason = "plataforma serverless: o sistema de ficheiros é efémero";
    }
    console.warn(`[storage] dados NÃO persistentes — ${state.reason} (${state.file})`);
  }

  cached = state;
  return state;
}

/**
 * Directory used for private uploads. Prefers `./storage/uploads` (the documented
 * layout) and falls back to a directory beside the database when the project
 * directory is read-only.
 */
export function uploadsDir(): string {
  const preferred = path.join(process.cwd(), "storage", "uploads");
  if (tryPrepare(preferred)) return preferred;
  const fallback = path.join(path.dirname(storage().file), "uploads");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}
