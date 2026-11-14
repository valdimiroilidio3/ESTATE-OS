import { getSession } from "@/server/auth";
import { getDocument, readMediaFile } from "@/server/data/media";
import { logSecurityEvent } from "@/server/audit";
import { clientIp } from "@/server/http";

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
    if (!session || session.org.id !== doc.org_id) {
      // A private document pulled by another tenant is exactly the event the
      // audit trail exists for: who tried, from where, and on which record.
      await logSecurityEvent({
        orgId: session?.org.id ?? null,
        actorId: session?.profile.id ?? null,
        action: "document.access_denied",
        outcome: "denied",
        route: `/api/documents/${id}/file`,
        ip: clientIp(_req),
        meta: { document_id: id, owner_org: doc.org_id },
      });
      return new Response("Unauthorized", { status: 401 });
    }
  }
  if (!doc.storage_key) return new Response("Indisponível", { status: 404 });
  const buffer = await readMediaFile(doc);
  if (!buffer) return new Response("Indisponível", { status: 404 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": doc.mime_type || "application/octet-stream",
      "content-length": String(buffer.length),
      // Images may render inline; anything else is a download, so a crafted
      // file can never execute in the application's origin.
      "content-disposition": `${String(doc.mime_type ?? "").startsWith("image/") ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.name)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-frame-options": "DENY",
      "cross-origin-resource-policy": "same-origin",
    },
  });
}
