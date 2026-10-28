import { many, one, run, uid, now, parseJson, type Row } from "../db";
import type {
  Property,
  PropertySpecs,
  PropertyStatus,
  PropertyMedia,
  ContentRecord,
  Experience,
  Job,
  Lead,
  Visit,
} from "@/lib/types";
import { ApiError } from "../http";
import type { PropertyInput } from "@/lib/schemas";

const SPEC_FIELDS = [
  "usable_area_m2",
  "plot_area_m2",
  "bedrooms",
  "bathrooms",
  "parking",
  "typology",
  "condition",
  "year_built",
  "energy_rating",
] as const;

export function mapSpecs(row: Row | undefined): PropertySpecs | null {
  if (!row) return null;
  return {
    property_id: row.property_id,
    usable_area_m2: row.usable_area_m2,
    plot_area_m2: row.plot_area_m2,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    typology: row.typology,
    condition: row.condition,
    year_built: row.year_built,
    energy_rating: row.energy_rating,
    amenities: parseJson(row.amenities, []),
    features: parseJson(row.features, []),
    views: parseJson(row.views, []),
    extra_fields: parseJson(row.extra_fields, []),
  };
}

export function mapProperty(row: Row, specsRow?: Row): Property {
  const specs = specsRow ?? one<Row>(`SELECT * FROM property_specs WHERE property_id = ?`, [row.id]);
  return {
    id: row.id,
    org_id: row.org_id,
    reference: row.reference,
    title: row.title,
    property_type: row.property_type,
    operation: row.operation,
    price_cents: row.price_cents,
    currency: row.currency,
    country: row.country,
    city: row.city,
    location: row.location,
    address_line: row.address_line,
    address_private: row.address_private,
    status: row.status,
    summary: row.summary,
    internal_notes: row.internal_notes,
    completion: row.completion,
    created_at: row.created_at,
    updated_at: row.updated_at,
    specs: mapSpecs(specs),
  };
}

export function listProperties(
  orgId: string,
  opts: {
    q?: string;
    status?: string;
    operation?: string;
    type?: string;
    limit?: number;
    offset?: number;
    orderBy?: "updated_at" | "created_at" | "price";
  } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = ["p.org_id = ?"];
  const params: unknown[] = [orgId];
  if (opts.status && opts.status !== "all") {
    where.push("p.status = ?");
    params.push(opts.status);
  }
  if (opts.operation && opts.operation !== "all") {
    where.push("p.operation = ?");
    params.push(opts.operation);
  }
  if (opts.type && opts.type !== "all") {
    where.push("p.property_type = ?");
    params.push(opts.type);
  }
  if (opts.q) {
    where.push("(p.title LIKE ? OR p.reference LIKE ? OR p.city LIKE ? OR p.location LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like, like);
  }
  const order =
    opts.orderBy === "price"
      ? "p.price_cents DESC"
      : opts.orderBy === "created_at"
        ? "p.created_at DESC"
        : "p.updated_at DESC";
  const rows = many<Row>(
    `SELECT p.*, s.usable_area_m2, s.bedrooms, s.bathrooms, s.amenities, s.features, s.views,
            s.plot_area_m2, s.parking, s.typology, s.condition, s.year_built, s.energy_rating,
            s.property_id AS s_property_id,
            (SELECT count(*) FROM property_media m WHERE m.property_id = p.id AND m.kind = 'photo') AS media_count,
            (SELECT count(*) FROM leads l WHERE l.property_id = p.id) AS lead_count
     FROM properties p LEFT JOIN property_specs s ON s.property_id = p.id
     WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const total =
    one<{ c: number }>(
      `SELECT count(*) AS c FROM properties p WHERE ${where.join(" AND ")}`,
      params,
    )?.c ?? 0;
  const items = rows.map((row) => ({
    ...mapProperty(row, {
      ...row,
      property_id: row.s_property_id,
      amenities: row.amenities,
      features: row.features,
      views: row.views,
    }),
    media_count: row.media_count as number,
    lead_count: row.lead_count as number,
  }));
  return { items, total, limit, offset };
}

export function getProperty(orgId: string, id: string): Property | null {
  const row = one<Row>(`SELECT * FROM properties WHERE id = ? AND org_id = ?`, [id, orgId]);
  return row ? mapProperty(row) : null;
}

export function getPropertyByReference(orgId: string, reference: string): Property | null {
  const row = one<Row>(`SELECT * FROM properties WHERE reference = ? AND org_id = ?`, [reference, orgId]);
  return row ? mapProperty(row) : null;
}

function nextReference(orgId: string) {
  const year = new Date().getFullYear();
  const row = one<{ c: number }>(
    `SELECT count(*) AS c FROM properties WHERE org_id = ? AND reference LIKE ?`,
    [orgId, `ES-${year}-%`],
  );
  const seq = String((row?.c ?? 0) + 1).padStart(4, "0");
  return `ES-${year}-${seq}`;
}

export function computeCompletion(propertyId: string, orgId: string) {
  const property = getProperty(orgId, propertyId);
  if (!property) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  const specs = property.specs;
  const photos =
    one<{ c: number; approved: number }>(
      `SELECT count(*) AS c, sum(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
       FROM property_media WHERE property_id = ? AND kind IN ('photo','floorplan')`,
      [propertyId],
    ) ?? { c: 0, approved: 0 };
  const approvedPhotos =
    one<{ c: number }>(
      `SELECT count(*) AS c FROM property_media WHERE property_id = ? AND kind = 'photo' AND status = 'approved'`,
      [propertyId],
    )?.c ?? 0;
  const approvedContent =
    one<{ c: number }>(
      `SELECT count(*) AS c FROM property_content WHERE property_id = ? AND status = 'approved' AND kind = 'listing'`,
      [propertyId],
    )?.c ?? 0;
  const experience = one<Row>(`SELECT status FROM property_experiences WHERE property_id = ?`, [propertyId]);

  const checks: { key: string; label: string; weight: number; done: boolean }[] = [
    { key: "title", label: "Título do imóvel", weight: 8, done: property.title.trim().length > 2 },
    {
      key: "location",
      label: "País e cidade",
      weight: 10,
      done: Boolean(property.country && property.city),
    },
    { key: "price", label: "Preço e moeda", weight: 10, done: property.price_cents !== null && property.price_cents > 0 },
    {
      key: "specs",
      label: "Área, quartos e casas de banho",
      weight: 15,
      done: Boolean(specs?.usable_area_m2 && specs?.bedrooms !== null && specs?.bathrooms !== null),
    },
    {
      key: "features",
      label: "Comodidades ou características",
      weight: 7,
      done: Boolean((specs?.amenities.length ?? 0) + (specs?.features.length ?? 0) > 0),
    },
    { key: "primary_photo", label: "Fotografia principal aprovada", weight: 15, done: approvedPhotos > 0 },
    { key: "photo_set", label: "Pelo menos 3 fotografias aprovadas", weight: 10, done: approvedPhotos >= 3 },
    { key: "listing", label: "Descrição comercial aprovada", weight: 15, done: approvedContent > 0 },
    {
      key: "contact",
      label: "Consultor de contacto definido",
      weight: 5,
      done: false,
    },
    {
      key: "experience",
      label: "Experiência publicada",
      weight: 5,
      done: experience?.status === "published",
    },
  ];

  const missing = checks.filter((c) => !c.done);
  const score = checks.filter((c) => c.done).reduce((sum, c) => sum + c.weight, 0);
  return {
    score: Math.min(100, score),
    missing,
    total: checks.length,
    complete: missing.length === 0,
    stats: { photos: photos.c ?? 0, approvedPhotos, approvedContent: approvedContent > 0 },
  };
}

export function refreshCompletion(propertyId: string, orgId: string) {
  const { score } = computeCompletion(propertyId, orgId);
  run(`UPDATE properties SET completion = ?, updated_at = ? WHERE id = ?`, [score, now(), propertyId]);
  return score;
}

export function propertyExists(orgId: string, id: string) {
  return Boolean(one<Row>(`SELECT id FROM properties WHERE id = ? AND org_id = ?`, [id, orgId]));
}

export function createProperty(orgId: string, userId: string, input: PropertyInput) {
  const id = uid();
  const timestamp = now();
  const title = input.title.trim();
  run(
    `INSERT INTO properties (id, org_id, reference, title, property_type, operation, price_cents, currency,
      country, city, location, address_line, address_private, status, summary, internal_notes,
      completion, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      nextReference(orgId),
      title,
      input.property_type,
      input.operation,
      Math.round((input.price ?? 0) * 100),
      input.currency,
      input.country,
      input.city,
      input.location ?? null,
      input.address_line ?? null,
      input.address_private ? 1 : 0,
      "draft",
      input.summary ?? null,
      input.internal_notes ?? null,
      0,
      userId,
      timestamp,
      timestamp,
    ],
  );
  const s = input.specs;
  run(
    `INSERT INTO property_specs (property_id, org_id, usable_area_m2, plot_area_m2, bedrooms, bathrooms,
      parking, typology, condition, year_built, energy_rating, amenities, features, views, extra_fields)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      s.usable_area_m2,
      s.plot_area_m2,
      s.bedrooms,
      s.bathrooms,
      s.parking,
      s.typology ?? null,
      s.condition ?? null,
      s.year_built,
      s.energy_rating ?? null,
      JSON.stringify(s.amenities ?? []),
      JSON.stringify(s.features ?? []),
      JSON.stringify(s.views ?? []),
      JSON.stringify([]),
    ],
  );
  if (input.mediaIds.length) {
    for (const mediaId of input.mediaIds) {
      run(
        `UPDATE property_media SET property_id = ?, sort = sort + ? WHERE id = ? AND org_id = ? AND property_id IS NULL`,
        [id, 0, mediaId, orgId],
      );
    }
    // first attached photo becomes primary
    const first = one<Row>(
      `SELECT id FROM property_media WHERE property_id = ? AND org_id = ? AND kind = 'photo' ORDER BY sort, created_at LIMIT 1`,
      [id, orgId],
    );
    if (first) run(`UPDATE property_media SET is_primary = 1 WHERE id = ?`, [first.id]);
  }
  refreshCompletion(id, orgId);
  return getProperty(orgId, id)!;
}

type PatchInput = Partial<PropertyInput> & { status?: PropertyStatus };

export function updateProperty(orgId: string, id: string, patch: PatchInput) {
  const existing = getProperty(orgId, id);
  if (!existing) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  const columns: Record<string, unknown> = {};
  if (patch.title !== undefined) columns.title = patch.title.trim();
  if (patch.property_type !== undefined) columns.property_type = patch.property_type;
  if (patch.operation !== undefined) columns.operation = patch.operation;
  if (patch.price !== undefined) columns.price_cents = Math.round((patch.price ?? 0) * 100);
  if (patch.currency !== undefined) columns.currency = patch.currency;
  if (patch.country !== undefined) columns.country = patch.country;
  if (patch.city !== undefined) columns.city = patch.city;
  if (patch.location !== undefined) columns.location = patch.location ?? null;
  if (patch.address_line !== undefined) columns.address_line = patch.address_line ?? null;
  if (patch.address_private !== undefined) columns.address_private = patch.address_private ? 1 : 0;
  if (patch.summary !== undefined) columns.summary = patch.summary ?? null;
  if (patch.internal_notes !== undefined) columns.internal_notes = patch.internal_notes ?? null;
  if (patch.status !== undefined) columns.status = patch.status;

  const entries = Object.entries(columns);
  if (entries.length) {
    run(
      `UPDATE properties SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ? AND org_id = ?`,
      [...entries.map(([, v]) => v), now(), id, orgId],
    );
  }

  if (patch.specs) {
    const s = patch.specs;
    const set: Record<string, unknown> = {};
    for (const field of SPEC_FIELDS) {
      const value = (s as Record<string, unknown>)[field];
      if (value !== undefined) set[field] = value;
    }
    set.amenities = JSON.stringify(s.amenities ?? existing.specs?.amenities ?? []);
    set.features = JSON.stringify(s.features ?? existing.specs?.features ?? []);
    set.views = JSON.stringify(s.views ?? existing.specs?.views ?? []);
    const keys = Object.keys(set);
    run(
      `UPDATE property_specs SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE property_id = ? AND org_id = ?`,
      [...keys.map((k) => set[k]), id, orgId],
    );
  }
  if (patch.mediaIds && patch.mediaIds.length) {
    for (const mediaId of patch.mediaIds) {
      run(`UPDATE property_media SET property_id = ? WHERE id = ? AND org_id = ?`, [id, mediaId, orgId]);
    }
  }
  refreshCompletion(id, orgId);
  return getProperty(orgId, id)!;
}

export function setPropertyStatus(orgId: string, id: string, status: PropertyStatus) {
  run(`UPDATE properties SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?`, [
    status,
    now(),
    id,
    orgId,
  ]);
}

export function archiveProperty(orgId: string, id: string) {
  setPropertyStatus(orgId, id, "archived");
}

export function deleteProperty(orgId: string, id: string) {
  const existing = getProperty(orgId, id);
  if (!existing) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  run(`DELETE FROM properties WHERE id = ? AND org_id = ?`, [id, orgId]);
}

/* ─────────── aggregates used by the property profile ─────────── */

export interface PropertyBundle {
  property: Property;
  media: PropertyMedia[];
  content: ContentRecord[];
  experience: Experience | null;
  leads: Lead[];
  visits: Visit[];
  documents: Row[];
  jobs: Job[];
  completion: ReturnType<typeof computeCompletion>;
}

export function getPropertyBundle(orgId: string, id: string): PropertyBundle | null {
  const property = getProperty(orgId, id);
  if (!property) return null;
  const media = many<Row>(
    `SELECT * FROM property_media WHERE org_id = ? AND property_id = ? ORDER BY is_primary DESC, sort, created_at`,
    [orgId, id],
  ).map(mapMedia);
  const content = many<Row>(
    `SELECT * FROM property_content WHERE org_id = ? AND property_id = ? ORDER BY created_at DESC`,
    [orgId, id],
  ).map(mapContent);
  const expRow = one<Row>(`SELECT * FROM property_experiences WHERE org_id = ? AND property_id = ?`, [orgId, id]);
  const experience = expRow ? mapExperience(expRow) : null;
  const leads = many<Row>(
    `SELECT l.*, p.title AS property_title, p.reference AS property_reference, pr.full_name AS owner_name
     FROM leads l LEFT JOIN properties p ON p.id = l.property_id
     LEFT JOIN profiles pr ON pr.id = l.owner_id
     WHERE l.org_id = ? AND l.property_id = ? ORDER BY l.created_at DESC`,
    [orgId, id],
  ) as Lead[];
  const visits = many<Row>(
    `SELECT v.*, p.title AS property_title, l.name AS lead_name, pr.full_name AS agent_name
     FROM visits v LEFT JOIN properties p ON p.id = v.property_id
     LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN profiles pr ON pr.id = v.agent_id
     WHERE v.org_id = ? AND v.property_id = ? ORDER BY v.scheduled_at DESC`,
    [orgId, id],
  ) as Visit[];
  const documents = many<Row>(
    `SELECT d.*, pr.full_name AS uploaded_by_name FROM property_documents d
     LEFT JOIN profiles pr ON pr.id = d.uploaded_by
     WHERE d.org_id = ? AND d.property_id = ? ORDER BY d.created_at DESC`,
    [orgId, id],
  );
  const jobs = many<Row>(
    `SELECT * FROM ai_jobs WHERE org_id = ? AND property_id = ? ORDER BY created_at DESC LIMIT 20`,
    [orgId, id],
  ) as Job[];
  return { property, media, content, experience, leads, visits, documents, jobs, completion: computeCompletion(id, orgId) };
}

export function mapMedia(row: Row): PropertyMedia {
  return {
    id: row.id,
    property_id: row.property_id,
    file_name: row.file_name,
    public_path: row.public_path,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    kind: row.kind,
    room: row.room,
    caption: row.caption,
    tags: parseJson(row.tags, []),
    is_primary: row.is_primary,
    is_public: row.is_public,
    status: row.status,
    sort: row.sort,
    created_at: row.created_at,
  };
}

export function mapContent(row: Row): ContentRecord {
  return {
    id: row.id,
    property_id: row.property_id,
    kind: row.kind,
    locale: row.locale,
    variant: row.variant,
    title: row.title,
    body: row.body,
    payload: parseJson(row.payload, {}),
    provider: row.provider,
    status: row.status,
    approved_at: row.approved_at,
    updated_at: row.updated_at,
  };
}

export function mapExperience(row: Row): Experience {
  return {
    id: row.id,
    property_id: row.property_id,
    layout: row.layout,
    slug: row.slug,
    status: row.status,
    config: parseJson(row.config, {}) as Experience["config"],
    published_at: row.published_at,
    view_count: row.view_count,
    updated_at: row.updated_at,
  };
}

/** Public-facing lookup: only published experiences are resolvable. */
export function getPublicExperience(slug: string) {
  const row = one<Row>(
    `SELECT e.*, p.org_id FROM property_experiences e JOIN properties p ON p.id = e.property_id
     WHERE e.slug = ? AND e.status = 'published' AND p.status != 'archived'`,
    [slug],
  );
  if (!row) return null;
  const property = getProperty(row.org_id, row.property_id);
  if (!property) return null;
  const org = one<Row>(`SELECT * FROM organizations WHERE id = ?`, [row.org_id]);
  const experience = mapExperience(row);
  return { property, experience, org: org! };
}
