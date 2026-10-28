import { authed, errorResponse, json, requireSession, forbidden, enforceRateLimit, ApiError } from "@/server/http";
import { listMedia, saveUpload, LIMITS } from "@/server/data/media";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  return json({
    items: listMedia(session.org.id, {
      propertyId: url.searchParams.get("propertyId") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
    }),
    limits: LIMITS,
  });
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
    enforceRateLimit(req, "upload", 40, 60_000);
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) throw new ApiError("Nenhum ficheiro recebido.", 422, "no_files");
    if (files.length > 12) throw new ApiError("Máximo de 12 ficheiros por envio.", 422, "too_many_files");
    const propertyId = (form.get("propertyId") as string) || null;
    const room = (form.get("room") as string) || null;
    const kindRaw = (form.get("kind") as string) || null;
    const kind = ["photo", "floorplan", "document", "video"].includes(kindRaw ?? "")
      ? (kindRaw as "photo" | "floorplan" | "document" | "video")
      : undefined;
    const created = [];
    for (const file of files) {
      created.push(
        await saveUpload({
          orgId: session.org.id,
          userId: session.profile.id,
          file,
          propertyId,
          room,
          kind,
        }),
      );
    }
    logAudit({
      orgId: session.org.id,
      actorId: session.profile.id,
      action: "media.uploaded",
      entity: "property_media",
      entityId: created[0]?.id ?? null,
      meta: { count: created.length, propertyId },
    });
    return json({ items: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
