import { many, one, run, uid, now, parseJson, type Row } from "../db";
import { ApiError } from "../http";
import type { Lead, LeadStatus } from "@/lib/types";

export const PIPELINE: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "visit_scheduled", label: "Visit scheduled" },
  { id: "offer", label: "Offer" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export function listLeads(
  orgId: string,
  opts: { q?: string; status?: string; propertyId?: string; ownerId?: string; limit?: number } = {},
) {
  const where = ["l.org_id = ?"];
  const params: unknown[] = [orgId];
  if (opts.status && opts.status !== "all") {
    where.push("l.status = ?");
    params.push(opts.status);
  }
  if (opts.propertyId) {
    where.push("l.property_id = ?");
    params.push(opts.propertyId);
  }
  if (opts.ownerId) {
    where.push("l.owner_id = ?");
    params.push(opts.ownerId);
  }
  if (opts.q) {
    where.push("(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR p.title LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like, like);
  }
  return many<Row>(
    `SELECT l.*, p.title AS property_title, p.reference AS property_reference, pr.full_name AS owner_name
     FROM leads l LEFT JOIN properties p ON p.id = l.property_id
     LEFT JOIN profiles pr ON pr.id = l.owner_id
     WHERE ${where.join(" AND ")} ORDER BY
       CASE l.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, l.created_at DESC
     LIMIT ?`,
    [...params, Math.min(opts.limit ?? 200, 500)],
  ) as Lead[];
}

export function getLead(orgId: string, id: string) {
  return one<Row>(
    `SELECT l.*, p.title AS property_title, p.reference AS property_reference, pr.full_name AS owner_name
     FROM leads l LEFT JOIN properties p ON p.id = l.property_id
     LEFT JOIN profiles pr ON pr.id = l.owner_id
     WHERE l.id = ? AND l.org_id = ?`,
    [id, orgId],
  ) as Lead | undefined;
}

export function createLead(input: {
  orgId: string;
  propertyId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  source: string;
  message?: string | null;
  consentMarketing?: boolean;
  priority?: "low" | "normal" | "high";
  status?: LeadStatus;
}) {
  const id = uid();
  run(
    `INSERT INTO leads (id, org_id, property_id, name, email, phone, source, message, status, priority,
      consent_marketing, consent_terms, consent_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.orgId,
      input.propertyId ?? null,
      input.name.slice(0, 120),
      input.email.slice(0, 160),
      input.phone ?? null,
      input.source,
      input.message ?? null,
      input.status ?? "new",
      input.priority ?? "normal",
      input.consentMarketing ? 1 : 0,
      1,
      now(),
      now(),
      now(),
    ],
  );
  addLeadEvent({
    orgId: input.orgId,
    leadId: id,
    type: "created",
    note: `Origem: ${input.source}`,
  });
  return getLead(input.orgId, id)!;
}

export function updateLead(
  orgId: string,
  id: string,
  patch: {
    status?: LeadStatus;
    owner_id?: string | null;
    next_action?: string | null;
    next_action_at?: string | null;
    priority?: "low" | "normal" | "high";
  },
  actorId?: string,
) {
  const lead = getLead(orgId, id);
  if (!lead) throw new ApiError("Lead inexistente.", 404, "not_found");
  const set: Record<string, unknown> = {};
  const changes: string[] = [];
  if (patch.status && patch.status !== lead.status) {
    set.status = patch.status;
    changes.push(`Estado: ${lead.status} → ${patch.status}`);
  }
  if (patch.owner_id !== undefined) {
    if (patch.owner_id) {
      const member = one<Row>(
        `SELECT profile_id FROM organization_members WHERE org_id = ? AND profile_id = ?`,
        [orgId, patch.owner_id],
      );
      if (!member) throw new ApiError("Consultor inválido.", 422, "invalid_owner");
    }
    set.owner_id = patch.owner_id;
    changes.push("Responsável atualizado");
  }
  if (patch.next_action !== undefined) set.next_action = patch.next_action;
  if (patch.next_action_at !== undefined) set.next_action_at = patch.next_action_at;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (!Object.keys(set).length) return lead;
  set.updated_at = now();
  const keys = Object.keys(set);
  run(
    `UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND org_id = ?`,
    [...keys.map((k) => set[k]), id, orgId],
  );
  if (changes.length) {
    addLeadEvent({ orgId, leadId: id, type: "status_change", note: changes.join(" · "), actorId });
  }
  return getLead(orgId, id)!;
}

export function addLeadEvent(input: {
  orgId: string;
  leadId: string;
  type: string;
  note?: string | null;
  actorId?: string | null;
  meta?: Record<string, unknown>;
}) {
  run(
    `INSERT INTO lead_events (id, org_id, lead_id, type, note, actor_id, meta, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    [uid(), input.orgId, input.leadId, input.type, input.note ?? null, input.actorId ?? null, JSON.stringify(input.meta ?? {}), now()],
  );
}

export function listLeadEvents(orgId: string, leadId: string) {
  return many<Row>(
    `SELECT e.*, p.full_name AS actor_name FROM lead_events e
     LEFT JOIN profiles p ON p.id = e.actor_id
     WHERE e.org_id = ? AND e.lead_id = ? ORDER BY e.created_at DESC`,
    [orgId, leadId],
  ).map((r) => ({ ...r, meta: parseJson(r.meta, {}) }));
}

export function leadStats(orgId: string) {
  const rows = many<{ status: string; c: number }>(
    `SELECT status, count(*) AS c FROM leads WHERE org_id = ? GROUP BY status`,
    [orgId],
  );
  const byStatus = Object.fromEntries(PIPELINE.map((p) => [p.id, 0])) as Record<string, number>;
  rows.forEach((r) => (byStatus[r.status] = r.c));
  const total = rows.reduce((sum, r) => sum + r.c, 0);
  const won = byStatus.won ?? 0;
  const active = total - won - (byStatus.lost ?? 0);
  return { total, byStatus, won, active };
}

export function leadsCsv(orgId: string) {
  const rows = listLeads(orgId, { limit: 500 });
  const header = ["name", "email", "phone", "status", "source", "property", "created_at", "consent_marketing"];
  const lines = rows.map((l) =>
    [
      l.name,
      l.email,
      l.phone ?? "",
      l.status,
      l.source,
      l.property_title ?? "",
      l.created_at,
      l.consent_marketing ? "yes" : "no",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
