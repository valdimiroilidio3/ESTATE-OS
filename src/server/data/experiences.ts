import { many, one, run, uid, now, parseJson, type Row } from "../db";
import { ApiError } from "../http";
import { assertIdentifiers } from "../security";
import { getProperty, mapExperience } from "./properties";
import type { Experience, ExperienceConfig, ExperienceLayout } from "@/lib/types";
import type { ExperienceConfigInput } from "@/lib/schemas";

export const DEFAULT_SECTIONS: { id: string; label: string }[] = [
  { id: "story", label: "Property story" },
  { id: "gallery", label: "Galeria" },
  { id: "specifications", label: "Especificações" },
  { id: "highlights", label: "Destaques" },
  { id: "location", label: "Localização" },
  { id: "assistant", label: "Property assistant" },
  { id: "visit", label: "Pedido de visita" },
];

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string) {
  let slug = base || "imovel";
  let attempt = 1;
  while (await one<Row>(`SELECT id FROM property_experiences WHERE slug = ?`, [slug])) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

export async function defaultConfig(propertyId: string, orgId: string, layout: ExperienceLayout): Promise<ExperienceConfig> {
  const property = await getProperty(orgId, propertyId);
  const contactSettings = parseJson<Record<string, string>>(
    (await one<Row>(`SELECT settings FROM organizations WHERE id = ?`, [orgId]))?.settings,
    {},
  );
  const defaultSections = DEFAULT_SECTIONS.map((s) => ({
    id: s.id,
    enabled: layout === "investment" ? s.id !== "story" || true : true,
  }));
  return {
    hero: {
      headline: property?.title ?? "",
      subheadline:
        layout === "signature"
          ? "Uma apresentação editorial para um imóvel excecional."
          : "Arquitetura, luz e matéria — apresentados com precisão.",
      showPrice: true,
      locationLabel: [property?.location, property?.city].filter(Boolean).join(", "),
      primaryCta: "Solicitar visita",
      secondaryCta: "Falar com o consultor",
    },
    sections:
      layout === "investment"
        ? defaultSections.map((s) => ({ ...s, enabled: s.id !== "story" }))
        : defaultSections,
    contact: {
      name: contactSettings.agencyName ?? "",
      email: contactSettings.email ?? "",
      phone: contactSettings.phone ?? "",
      role: "Consultor",
    },
    map: { enabled: false, lat: null, lng: null, showExactAddress: false },
    gallery: { mode: layout === "investment" ? "grid" : "masonry", mediaIds: [], showCaptions: true },
    theme: { accent: "#C6A77A", tone: "light" },
  };
}

export async function getExperience(orgId: string, propertyId: string): Promise<Experience | null >{
  const row = await one<Row>(`SELECT * FROM property_experiences WHERE org_id = ? AND property_id = ?`, [
    orgId,
    propertyId,
  ]);
  return row ? mapExperience(row) : null;
}

export async function createExperience(orgId: string, userId: string, propertyId: string, layout: ExperienceLayout) {
  const property = await getProperty(orgId, propertyId);
  if (!property) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  const existing = await getExperience(orgId, propertyId);
  if (existing) return existing;
  const id = uid();
  const slug = await uniqueSlug(slugify(`${property.city ?? ""} ${property.title} ${property.reference}`));
  await run(
    `INSERT INTO property_experiences (id, org_id, property_id, layout, slug, status, config, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      propertyId,
      layout,
      slug,
      "draft",
      JSON.stringify(await defaultConfig(propertyId, orgId, layout)),
      userId,
      now(),
      now(),
    ],
  );
  return mapExperience((await one<Row>(`SELECT * FROM property_experiences WHERE id = ?`, [id]))!);
}

export async function updateExperience(
  orgId: string,
  id: string,
  patch: { layout?: ExperienceLayout; config?: ExperienceConfigInput; status?: "draft" | "published" | "unpublished" },
) {
  const row = await one<Row>(`SELECT * FROM property_experiences WHERE id = ? AND org_id = ?`, [id, orgId]);
  if (!row) throw new ApiError("Experiência inexistente.", 404, "not_found");
  const set: Record<string, unknown> = {};
  if (patch.layout) set.layout = patch.layout;
  if (patch.config) set.config = JSON.stringify(patch.config);
  if (patch.status) {
    if (patch.status === "published") {
      const property = await getProperty(orgId, row.property_id);
      const photos = (await one<{ c: number }>(
        `SELECT count(*) AS c FROM property_media WHERE property_id = ? AND is_public = 1 AND status = 'approved'`,
        [row.property_id],
      ))?.c;
      if (!property) throw new ApiError("Imóvel inexistente.", 404, "not_found");
      if (!photos) {
        throw new ApiError(
          "Publique pelo menos uma imagem aprovada antes de publicar a experiência.",
          409,
          "incomplete_experience",
          { field: "media" },
        );
      }
      set.published_at = row.published_at ?? now();
    }
    set.status = patch.status;
  }
  set.updated_at = now();
  const keys = Object.keys(set);
  assertIdentifiers(keys);
  await run(
    `UPDATE property_experiences SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND org_id = ?`,
    [...keys.map((k) => set[k]), id, orgId],
  );
  if (patch.status === "published") {
    await run(`UPDATE properties SET status = CASE WHEN status = 'draft' THEN 'published' ELSE status END, updated_at = ? WHERE id = ? AND org_id = ?`, [now(), row.property_id, orgId]);
  }
  return mapExperience((await one<Row>(`SELECT * FROM property_experiences WHERE id = ?`, [id]))!);
}

export async function listExperiences(orgId: string) {
  const rows = await many<Row>(
    `SELECT e.*, p.title AS property_title, p.reference, p.city, p.price_cents, p.currency,
       (SELECT count(*) FROM leads l WHERE l.property_id = e.property_id) AS lead_count,
       (SELECT public_path FROM property_media m WHERE m.property_id = e.property_id AND m.status = 'approved'
         ORDER BY m.is_primary DESC, m.sort LIMIT 1) AS cover
     FROM property_experiences e JOIN properties p ON p.id = e.property_id
     WHERE e.org_id = ? ORDER BY e.updated_at DESC`,
    [orgId],
  );
  return rows.map((r) => ({
    ...mapExperience(r),
    property_title: r.property_title,
    city: r.city,
    cover: r.cover,
    lead_count: r.lead_count,
  }));
}

export function toggleSection(config: ExperienceConfig, id: string, enabled: boolean): ExperienceConfig {
  return {
    ...config,
    sections: config.sections.map((s) => (s.id === id ? { ...s, enabled } : s)),
  };
}

/**
 * The most recently published, non-demo experience — used by the public landing
 * page so that it links to something real on this instance instead of a fixture.
 */
export async function featuredExperience() {
  const rows = await many<Row>(
    `SELECT e.slug, e.layout, e.updated_at, p.id AS property_id, p.title, p.city, p.location,
            p.price_cents, p.currency, o.settings
     FROM property_experiences e
     JOIN properties p ON p.id = e.property_id
     JOIN organizations o ON o.id = e.org_id
     WHERE e.status = 'published' AND p.status != 'archived'
     ORDER BY e.updated_at DESC LIMIT 10`,
  );
  const row = rows.find((item) => !parseJson<{ demo?: boolean }>(item.settings, {}).demo);
  if (!row) return null;

  const cover = await one<Row>(
    `SELECT id, public_path FROM property_media
     WHERE property_id = ? AND kind = 'photo' AND status = 'approved' AND is_public = 1
     ORDER BY is_primary DESC, sort LIMIT 1`,
    [row.property_id],
  );
  const specs = await one<Row>(`SELECT usable_area_m2, bedrooms FROM property_specs WHERE property_id = ?`, [
    row.property_id,
  ]);

  return {
    slug: String(row.slug),
    layout: String(row.layout),
    title: String(row.title),
    location: [row.location, row.city].filter(Boolean).join(", "),
    price_cents: row.price_cents as number | null,
    currency: String(row.currency ?? "EUR"),
    area: (specs?.usable_area_m2 as number | null) ?? null,
    bedrooms: (specs?.bedrooms as number | null) ?? null,
    cover: cover ? (cover.public_path as string | null) || `/api/media/${cover.id}/file` : null,
  };
}
