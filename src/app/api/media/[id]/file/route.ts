import { getSession } from "@/server/auth";
import { getMediaRow, readMediaFile } from "@/server/data/media";

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
  const row = await getMediaRow(id);
  if (!row) return new Response("Not found", { status: 404 });

  const isPublic = row.is_public === 1 && row.status === "approved";
  if (!isPublic) {
    const session = await getSession();
    if (!session || session.org.id !== row.org_id) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  const buffer = await readMediaFile(row);
  if (!buffer) return new Response("Ficheiro indisponível", { status: 404 });
  const ext = String(row.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": row.mime_type || MIME_FALLBACK[ext] || "application/octet-stream",
      "content-length": String(buffer.length),
      "cache-control": isPublic ? "public, max-age=86400" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
