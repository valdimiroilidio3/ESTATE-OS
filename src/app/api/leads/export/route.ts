import { authed, forbidden } from "@/server/http";
import { leadsCsv } from "@/server/data/leads";
import { roles } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session }) => {
  if (!roles.canManageOrg(session.role)) throw forbidden("Exportação reservada a administradores.");
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "leads.exported",
    entity: "lead",
    meta: { format: "csv" },
  });
  const csv = leadsCsv(session.org.id);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
});
