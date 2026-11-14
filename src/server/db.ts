/**
 * PostgreSQL access layer.
 *
 * The whole data layer is asynchronous because PostgreSQL is. Call sites keep
 * writing SQL with `?` placeholders; `q()` rewrites them to `$1…$n` so the
 * queries stay readable and portable.
 *
 * Conventions that the rest of the server relies on:
 *   * timestamps are ISO-8601 UTC text (see `iso_now()`);
 *   * 0/1 flags are returned as numbers, not booleans;
 *   * `count(*)` comes back as a number, not a bigint string.
 */
import { Pool, types, type PoolClient } from "pg";

const globalForDb = globalThis as unknown as { __estatePool?: Pool };

// int8/bigint and numeric would otherwise arrive as strings and silently turn
// every counter into "12". The domain never exceeds 2^53 in any of these.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));
types.setTypeParser(types.builtins.DATE, (value) => value);

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL não está definido. Configure uma base de dados PostgreSQL (ex.: Neon, Supabase, Vercel Postgres) e reinicie.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

function connectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  return url;
}

function needsSsl(url: string): boolean {
  if (process.env.PGSSL === "disable") return false;
  if (/sslmode=(disable|require|prefer)/.test(url)) return false;
  // Managed providers (Neon, Supabase, Vercel Postgres) require TLS; local
  // sockets and localhost do not.
  return !/@(localhost|127\.0\.0\.1|.*@\/)/.test(url) && !url.includes("host=/");
}

export function pool(): Pool {
  if (!globalForDb.__estatePool) {
    const url = connectionString();
    const created = new Pool({
      connectionString: url,
      ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    created.on("error", (error) => {
      console.error("[db] erro no pool PostgreSQL:", error.message);
    });
    globalForDb.__estatePool = created;
  }
  return globalForDb.__estatePool;
}

/** Rewrites `?` placeholders into `$1…$n`, skipping quoted literals. */
export function q(sql: string): string {
  let index = 0;
  let out = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (quote) {
      out += char;
      if (char === quote) {
        if (sql[i + 1] === quote) {
          out += sql[i + 1];
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }
    if (char === "?") {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += char;
  }
  return out;
}

export type Row = Record<string, any>;

/**
 * Guards against the classic "query has 3 placeholders, call passes 2" mistake,
 * which PostgreSQL otherwise reports as an opaque bind error at runtime.
 */
function assertParams(sql: string, params: unknown[]): void {
  const expected = (q(sql).match(/\$\d+/g) ?? []).length;
  if (expected !== params.length) {
    throw new Error(
      `Consulta com ${expected} parâmetros mas ${params.length} valores fornecidos: ${sql.trim().slice(0, 120)}`,
    );
  }
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  assertParams(sql, params);
  await ensureSchemaOnce();
  const result = await pool().query(q(sql), params as any[]);
  return result.rows[0] as T | undefined;
}

export async function many<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  assertParams(sql, params);
  await ensureSchemaOnce();
  const result = await pool().query(q(sql), params as any[]);
  return result.rows as T[];
}

export async function run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  assertParams(sql, params);
  await ensureSchemaOnce();
  const result = await pool().query(q(sql), params as any[]);
  return { changes: result.rowCount ?? 0 };
}

/** Executes a multi-statement script. No parameters, no placeholders. */
export async function exec(sql: string): Promise<void> {
  await pool().query(sql);
}

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Applies the schema. Idempotent: every statement is `IF NOT EXISTS`. */
export async function ensureSchema(): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "src", "server", "schema.sql");
  const sql = await fs.readFile(file, "utf8");
  await exec(sql);
}

const globalForSchema = globalThis as unknown as { __estateSchemaReady?: Promise<void> };

async function schemaPresent(): Promise<boolean> {
  const result = await pool().query("select to_regclass('public.organizations') as table_name");
  return Boolean(result.rows[0]?.table_name);
}

/**
 * Applies `schema.sql` on first use, so a brand-new deployment boots straight
 * into a working product instead of failing on a missing table.
 *
 * Only additive statements run, one connection at a time (PostgreSQL advisory
 * lock), and the result is cached per process. Set `AUTO_MIGRATE=0` to require
 * an explicit `npm run db:init` before the app will touch the database.
 */
export function ensureSchemaOnce(): Promise<void> {
  if (process.env.AUTO_MIGRATE === "0") return Promise.resolve();
  if (!globalForSchema.__estateSchemaReady) {
    globalForSchema.__estateSchemaReady = (async () => {
      if (await schemaPresent()) return;
      const client = await pool().connect();
      try {
        await client.query("select pg_advisory_lock(914527381)");
        if (!(await schemaPresent())) {
          console.info("[db] esquema em falta — a aplicar schema.sql");
          await ensureSchema();
          console.info("[db] esquema aplicado");
        }
      } catch (error) {
        // Let the next request retry instead of caching a failure forever.
        globalForSchema.__estateSchemaReady = undefined;
        throw error;
      } finally {
        await client.query("select pg_advisory_unlock(914527381)").catch(() => undefined);
        client.release();
      }
    })();
  }
  return globalForSchema.__estateSchemaReady;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const uid = () => crypto.randomUUID();

/** ISO-8601 UTC timestamp, identical in format to `schema.sql` column defaults. */
export const now = () => new Date().toISOString();
