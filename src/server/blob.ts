/**
 * Storage for uploaded photographs, floor plans and private documents.
 *
 * Two drivers, chosen automatically:
 *   * `db`   — bytes live in the `blobs` table (default on serverless hosts,
 *              where the container filesystem is wiped on every cold start);
 *   * `fs`   — bytes live under `storage/uploads` (default on a single host
 *              with a persistent volume).
 *
 * `STORAGE_DRIVER=db|fs` overrides the choice. Both drivers are addressed by an
 * opaque key, so call sites never care which one is active.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { one, run, uid } from "./db";

export type StorageDriver = "db" | "fs";

export function driver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER;
  if (configured === "db" || configured === "fs") return configured;
  const serverless = Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  return serverless ? "db" : "fs";
}

export function uploadsRoot(): string {
  return path.join(process.cwd(), "storage", "uploads");
}

/** Key for a new upload, namespaced by organisation. */
export function newKey(orgId: string, ext: string, prefix = "media"): string {
  return `${prefix}/${orgId}/${uid()}.${ext}`;
}

export async function put(key: string, data: Buffer, mimeType: string, orgId: string | null = null): Promise<void> {
  if (driver() === "db") {
    await run(
      `INSERT INTO blobs (key, org_id, mime_type, size_bytes, data) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, size_bytes = EXCLUDED.size_bytes, mime_type = EXCLUDED.mime_type`,
      [key, orgId, mimeType, data.byteLength, data],
    );
    return;
  }
  const file = path.join(uploadsRoot(), key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

export async function get(key: string): Promise<{ data: Buffer; mimeType: string | null } | null> {
  if (driver() === "db") {
    const row = await one<{ data: Buffer; mime_type: string }>(`SELECT data, mime_type FROM blobs WHERE key = ?`, [key]);
    if (!row) return null;
    // node-postgres returns bytea as a Buffer already.
    return { data: row.data, mimeType: row.mime_type };
  }
  try {
    const buffer = await fs.readFile(path.join(uploadsRoot(), key));
    return { data: buffer, mimeType: null };
  } catch {
    return null;
  }
}

export async function remove(key: string): Promise<void> {
  if (driver() === "db") {
    await run(`DELETE FROM blobs WHERE key = ?`, [key]);
    return;
  }
  try {
    await fs.unlink(path.join(uploadsRoot(), key));
  } catch {
    // Already gone: deleting a record must not fail because the file is missing.
  }
}
