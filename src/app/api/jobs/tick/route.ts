import { authed, json, forbidden } from "@/server/http";
import { canEdit } from "@/server/auth";
import { processQueue } from "@/server/jobs";

export const runtime = "nodejs";

export const POST = authed(async (_req, { session }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const processed = await processQueue(3);
  return json({ processed });
});
