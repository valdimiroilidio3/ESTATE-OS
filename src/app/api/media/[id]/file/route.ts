import fs from "node:fs";
import path from "node:path";
import { getSession } from "@/server/auth";
import { getMediaRow, mediaFilePath } from "@/server/data/media";

export const runtime = "nodejs";

const MIME_FALLBACK: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getMediaRow(id);
  if (!row) return new Response("Not found", { status: 404 });

  const isPublic = row.is_public === 1 && row.status === "approved";
  if (!isPublic) {
    const session = await getSession();
    if (!session || session.org.id !== row.org_id) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  const file = mediaFilePath(row);
  if (!file) return new Response("Ficheiro indisponível", { status: 404 });
  const ext = path.extname(file).replace(".", "").toLowerCase();
  const buffer = fs.readFileSync(file);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": row.mime_type || MIME_FALLBACK[ext] || "application/octet-stream",
      "content-length": String(buffer.length),
      "cache-control": isPublic ? "public, max-age=86400" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
