import { authed, errorResponse, json, requireSession, forbidden, ApiError } from "@/server/http";
import { listDocuments, saveDocument } from "@/server/data/media";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  return json({ items: listDocuments(session.org.id, params.id) });
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("Nenhum documento recebido.", 422, "no_files");
    const access = (form.get("accessLevel") as string) || "team";
    const doc = await saveDocument({
      orgId: session.org.id,
      userId: session.profile.id,
      propertyId: id,
      file,
      name: (form.get("name") as string) || file.name,
      docType: (form.get("docType") as string) || "other",
      accessLevel: ["private", "team", "public"].includes(access)
        ? (access as "private" | "team" | "public")
        : "team",
    });
    logAudit({
      orgId: session.org.id,
      actorId: session.profile.id,
      action: "document.uploaded",
      entity: "property_document",
      entityId: doc.id,
      meta: { property_id: id, access_level: doc.access_level },
    });
    return json({ document: doc }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
