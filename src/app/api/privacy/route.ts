import { privacyRequestSchema } from "@/lib/schemas";
import { authed, json, readJson } from "@/server/http";
import { many, run, uid, now, type Row } from "@/server/db";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session }) => {
  return json({
    items: many<Row>(`SELECT * FROM privacy_requests WHERE org_id = ? ORDER BY created_at DESC`, [
      session.org.id,
    ]),
  });
});

export const POST = authed(async (req, { session }) => {
  const input = await readJson(req, privacyRequestSchema);
  run(
    `INSERT INTO privacy_requests (id, org_id, email, kind, status, note, created_at) VALUES (?,?,?,?,?,?,?)`,
    [uid(), session.org.id, input.email, input.kind, "open", input.note ?? null, now()],
  );
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "privacy.request_created",
    entity: "privacy_request",
    meta: { kind: input.kind },
  });
  return json({ ok: true }, { status: 201 });
});
