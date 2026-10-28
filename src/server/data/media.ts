import fs from "node:fs";
import path from "node:path";
import { many, one, run, uid, now, type Row } from "../db";
import { ApiError } from "../http";
import { mapMedia } from "./properties";
import type { PropertyMedia } from "@/lib/types";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const DOC_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export const LIMITS = {
  image: 8 * 1024 * 1024,
  document: 12 * 1024 * 1024,
  video: 40 * 1024 * 1024,
};

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export function storageRoot() {
  return path.join(process.cwd(), "storage", "uploads");
}

export function validateUpload(file: File): { kind: "photo" | "floorplan" | "document" | "video"; ext: string } {
  const type = file.type;
  if (IMAGE_TYPES.has(type)) {
    if (file.size > LIMITS.image) throw new ApiError("A imagem excede o limite de 8 MB.", 413, "too_large");
    return { kind: "photo", ext: EXT[type] ?? "jpg" };
  }
  if (VIDEO_TYPES.has(type)) {
    if (file.size > LIMITS.video) throw new ApiError("O vídeo excede o limite de 40 MB.", 413, "too_large");
    return { kind: "video", ext: EXT[type] ?? "mp4" };
  }
  if (DOC_TYPES.has(type)) {
    if (file.size > LIMITS.document) throw new ApiError("O documento excede o limite de 12 MB.", 413, "too_large");
    return { kind: "document", ext: EXT[type] ?? "bin" };
  }
  throw new ApiError(
    "Formato não suportado. Utilize JPG, PNG, WEBP, AVIF, PDF, DOC ou MP4.",
    415,
    "unsupported_type",
  );
}

export async function saveUpload(input: {
  orgId: string;
  userId: string;
  file: File;
  propertyId?: string | null;
  kind?: "photo" | "floorplan" | "document" | "video";
  room?: string | null;
  caption?: string | null;
}) {
  const { file } = input;
  if (input.propertyId) {
    const owns = one<Row>(`SELECT id FROM properties WHERE id = ? AND org_id = ?`, [input.propertyId, input.orgId]);
    if (!owns) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  }
  const validation = validateUpload(file);
  const kind = input.kind ?? validation.kind;
  const id = uid();
  const dir = path.join(storageRoot(), input.orgId);
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${id}.${validation.ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, fileName), buffer);
  const sortRow = one<{ m: number }>(
    `SELECT coalesce(max(sort), 0) + 1 AS m FROM property_media WHERE org_id = ? AND property_id IS ?`,
    [input.orgId, input.propertyId ?? null],
  );
  const hasPrimary = one<Row>(
    `SELECT id FROM property_media WHERE org_id = ? AND property_id IS ? AND is_primary = 1`,
    [input.orgId, input.propertyId ?? null],
  );
  run(
    `INSERT INTO property_media (id, org_id, property_id, storage_key, public_path, file_name, mime_type,
      size_bytes, kind, room, caption, tags, is_primary, is_public, status, sort, uploaded_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.orgId,
      input.propertyId ?? null,
      `${input.orgId}/${fileName}`,
      null,
      file.name.slice(0, 200) || `upload-${id}.${validation.ext}`,
      file.type,
      file.size,
      kind,
      input.room ?? null,
      input.caption ?? null,
      JSON.stringify([]),
      !hasPrimary && kind === "photo" ? 1 : 0,
      0,
      "pending",
      sortRow?.m ?? 1,
      input.userId,
      now(),
      now(),
    ],
  );
  const row = one<Row>(`SELECT * FROM property_media WHERE id = ?`, [id]);
  return mapMedia(row!);
}

export function listMedia(
  orgId: string,
  filters: { propertyId?: string; kind?: string; q?: string; status?: string; limit?: number } = {},
) {
  const where = ["org_id = ?"];
  const params: unknown[] = [orgId];
  if (filters.propertyId) {
    where.push("property_id = ?");
    params.push(filters.propertyId);
  }
  if (filters.kind && filters.kind !== "all") {
    where.push("kind = ?");
    params.push(filters.kind);
  }
  if (filters.status && filters.status !== "all") {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters.q) {
    where.push("(file_name LIKE ? OR caption LIKE ? OR room LIKE ? OR tags LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  const rows = many<Row>(
    `SELECT m.*, p.title AS property_title, p.reference AS property_reference
     FROM property_media m LEFT JOIN properties p ON p.id = m.property_id
     WHERE m.${where.join(" AND m.")} ORDER BY m.created_at DESC LIMIT ?`,
    [...params, Math.min(filters.limit ?? 120, 300)],
  );
  return rows.map((r) => ({ ...mapMedia(r), property_title: r.property_title, property_reference: r.property_reference }));
}

export function getMedia(orgId: string, id: string) {
  const row = one<Row>(`SELECT * FROM property_media WHERE id = ? AND org_id = ?`, [id, orgId]);
  return row ? mapMedia(row) : null;
}

export function getMediaRow(id: string) {
  return one<Row>(`SELECT * FROM property_media WHERE id = ?`, [id]);
}

export function updateMedia(
  orgId: string,
  id: string,
  patch: Partial<{
    caption: string | null;
    room: string | null;
    kind: "photo" | "floorplan" | "video" | "document";
    is_primary: boolean;
    is_public: boolean;
    status: "pending" | "approved" | "rejected";
    tags: string[];
    sort: number;
    property_id: string | null;
  }>,
) {
  const existing = getMedia(orgId, id);
  if (!existing) throw new ApiError("Ficheiro inexistente.", 404, "not_found");
  if (patch.property_id) {
    const owns = one<Row>(`SELECT id FROM properties WHERE id = ? AND org_id = ?`, [patch.property_id, orgId]);
    if (!owns) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  }
  if (patch.is_primary) {
    run(`UPDATE property_media SET is_primary = 0 WHERE org_id = ? AND property_id IS ?`, [
      orgId,
      existing.property_id,
    ]);
  }
  const set: Record<string, unknown> = {};
  if (patch.caption !== undefined) set.caption = patch.caption;
  if (patch.room !== undefined) set.room = patch.room;
  if (patch.kind !== undefined) set.kind = patch.kind;
  if (patch.is_public !== undefined) set.is_public = patch.is_public ? 1 : 0;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.tags !== undefined) set.tags = JSON.stringify(patch.tags);
  if (patch.sort !== undefined) set.sort = patch.sort;
  if (patch.property_id !== undefined) set.property_id = patch.property_id;
  if (patch.is_primary !== undefined) set.is_primary = patch.is_primary ? 1 : 0;
  set.updated_at = now();
  const keys = Object.keys(set);
  run(
    `UPDATE property_media SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND org_id = ?`,
    [...keys.map((k) => set[k]), id, orgId],
  );
  // Publishing requires explicit approval: a public file must be approved.
  if (patch.is_public) {
    run(`UPDATE property_media SET status = 'approved' WHERE id = ? AND org_id = ? AND status = 'rejected'`, [
      id,
      orgId,
    ]);
  }
  return getMedia(orgId, id)!;
}

export function deleteMedia(orgId: string, id: string) {
  const row = getMediaRow(id);
  if (!row || row.org_id !== orgId) throw new ApiError("Ficheiro inexistente.", 404, "not_found");
  if (row.storage_key) {
    const file = path.join(storageRoot(), row.storage_key);
    try {
      fs.unlinkSync(file);
    } catch {
      /* file already gone */
    }
  }
  run(`DELETE FROM property_media WHERE id = ? AND org_id = ?`, [id, orgId]);
}

export function mediaFilePath(row: Row) {
  if (!row.storage_key) return null;
  const file = path.join(storageRoot(), row.storage_key);
  return fs.existsSync(file) ? file : null;
}

export function mediaUrl(media: Pick<PropertyMedia, "id" | "public_path">) {
  return media.public_path || `/api/media/${media.id}/file`;
}

export function publicMedia(propertyId: string) {
  return many<Row>(
    `SELECT * FROM property_media WHERE property_id = ? AND is_public = 1 AND status = 'approved'
     ORDER BY is_primary DESC, sort, created_at`,
  ).map(mapMedia);
}

/* ───────── documents ───────── */

export async function saveDocument(input: {
  orgId: string;
  userId: string;
  propertyId: string;
  file: File;
  name: string;
  docType: string;
  accessLevel: "private" | "team" | "public";
}) {
  const owns = one<Row>(`SELECT id FROM properties WHERE id = ? AND org_id = ?`, [input.propertyId, input.orgId]);
  if (!owns) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  validateUpload(input.file);
  if (input.file.size > LIMITS.document)
    throw new ApiError("O documento excede o limite de 12 MB.", 413, "too_large");
  const id = uid();
  const ext = EXT[input.file.type] ?? "bin";
  const dir = path.join(storageRoot(), input.orgId, "documents");
  fs.mkdirSync(dir, { recursive: true });
  const storageKey = `${input.orgId}/documents/${id}.${ext}`;
  fs.writeFileSync(path.join(storageRoot(), storageKey), Buffer.from(await input.file.arrayBuffer()));
  run(
    `INSERT INTO property_documents (id, org_id, property_id, storage_key, name, doc_type, access_level,
      mime_type, size_bytes, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.orgId,
      input.propertyId,
      storageKey,
      input.name.slice(0, 160),
      input.docType,
      input.accessLevel,
      input.file.type,
      input.file.size,
      input.userId,
      now(),
    ],
  );
  return one<Row>(`SELECT * FROM property_documents WHERE id = ?`, [id])!;
}

export function listDocuments(orgId: string, propertyId?: string) {
  return many<Row>(
    `SELECT d.*, p.full_name AS uploaded_by_name, pr.title AS property_title FROM property_documents d
     LEFT JOIN profiles p ON p.id = d.uploaded_by LEFT JOIN properties pr ON pr.id = d.property_id
     WHERE d.org_id = ? ${propertyId ? "AND d.property_id = ?" : ""} ORDER BY d.created_at DESC`,
    propertyId ? [orgId, propertyId] : [orgId],
  );
}

export function getDocument(id: string) {
  return one<Row>(`SELECT * FROM property_documents WHERE id = ?`, [id]);
}

export function deleteDocument(orgId: string, id: string) {
  const row = getDocument(id);
  if (!row || row.org_id !== orgId) throw new ApiError("Documento inexistente.", 404, "not_found");
  if (row.storage_key) {
    try {
      fs.unlinkSync(path.join(storageRoot(), row.storage_key));
    } catch {
      /* ignore */
    }
  }
  run(`DELETE FROM property_documents WHERE id = ? AND org_id = ?`, [id, orgId]);
}
