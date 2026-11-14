import { getSession } from "@/server/auth";
import { getDocument, readMediaFile } from "@/server/data/media";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const doc = await getDocument(id);
  if (!doc) return new Response("Not found", { status: 404 });
  if (doc.access_level === "public") {
    // Public documents still require the owning property experience to be published.
    const { one } = await import("@/server/db");
    const published = await one<{ id: string }>(
      `SELECT id FROM property_experiences WHERE property_id = ? AND status = 'published'`,
      [doc.property_id],
    );
    if (!published) return new Response("Unauthorized", { status: 401 });
  } else {
    const session = await getSession();
    if (!session || session.org.id !== doc.org_id) return new Response("Unauthorized", { status: 401 });
  }
  if (!doc.storage_key) return new Response("Indisponível", { status: 404 });
  const buffer = await readMediaFile(doc);
  if (!buffer) return new Response("Indisponível", { status: 404 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": doc.mime_type || "application/octet-stream",
      "content-length": String(buffer.length),
      "content-disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
