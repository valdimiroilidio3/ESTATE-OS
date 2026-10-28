import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { __estateDb?: Database.Database };

function open(): Database.Database {
  const file = process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : path.join(process.cwd(), "data", "estate.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const database = new Database(file);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  const schema = fs.readFileSync(path.join(process.cwd(), "src", "server", "schema.sql"), "utf8");
  database.exec(schema);
  return database;
}

export const db: Database.Database = globalForDb.__estateDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__estateDb = db;

export type Row = Record<string, any>;

export function one<T = Row>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...(params as any[])) as T | undefined;
}

export function many<T = Row>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...(params as any[])) as T[];
}

export function run(sql: string, params: unknown[] = []) {
  return db.prepare(sql).run(...(params as any[]));
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
export const now = () => new Date().toISOString();
