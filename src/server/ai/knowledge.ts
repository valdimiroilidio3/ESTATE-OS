import { many, one, parseJson, type Row } from "../db";
import { getProperty, mapMedia } from "../data/properties";
import type { Property } from "@/lib/types";

export type FactStatus = "confirmed" | "inferred" | "unknown";

export interface Fact {
  key: string;
  label: string;
  value: string;
  raw?: string | number | null;
  source: string;
  status: FactStatus;
}

export interface KnowledgeBase {
  property: Property;
  facts: Fact[];
  byKey: Record<string, Fact>;
  amenities: string[];
  features: string[];
  listing: { locale: string; title: string | null; body: string | null; status: string } | null;
  approvedListing: { locale: string; title: string | null; body: string | null } | null;
  approvedPhotos: number;
}

const TYPE_LABELS: Record<string, { pt: string; en: string }> = {
  villa: { pt: "moradia", en: "villa" },
  apartment: { pt: "apartamento", en: "apartment" },
  townhouse: { pt: "casa em banda", en: "townhouse" },
  estate: { pt: "quinta", en: "estate" },
  land: { pt: "terreno", en: "land" },
  commercial: { pt: "espaço comercial", en: "commercial space" },
};

export function typeLabel(type: string, locale: "pt" | "en" = "pt") {
  return TYPE_LABELS[type]?.[locale] ?? type;
}

export function money(cents: number | null, currency: string) {
  if (cents === null) return null;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function buildKnowledge(orgId: string, propertyId: string): KnowledgeBase {
  const property = getProperty(orgId, propertyId);
  if (!property) throw new Error("property not found");
  const specs = property.specs;
  const facts: Fact[] = [];
  const add = (
    key: string,
    label: string,
    value: string | null | undefined,
    source: string,
    raw?: string | number | null,
  ) => {
    if (value === null || value === undefined || value === "") return;
    facts.push({ key, label, value, source, raw: raw ?? value, status: "confirmed" });
  };

  add("title", "Título interno", property.title, "Ficha do imóvel");
  add("reference", "Referência", property.reference, "Ficha do imóvel");
  add("type", "Tipologia de imóvel", typeLabel(property.property_type), "Ficha do imóvel", property.property_type);
  add("operation", "Operação", property.operation === "sale" ? "Venda" : "Arrendamento", "Ficha do imóvel");
  add("price", "Preço", money(property.price_cents, property.currency), "Ficha do imóvel", property.price_cents);
  add("city", "Cidade", property.city, "Ficha do imóvel");
  add("country", "País", property.country, "Ficha do imóvel");
  add("location", "Zona", property.location, "Ficha do imóvel");
  if (specs) {
    if (specs.usable_area_m2) add("area", "Área útil", `${specs.usable_area_m2} m²`, "Especificações");
    if (specs.plot_area_m2) add("plot", "Área do terreno", `${specs.plot_area_m2} m²`, "Especificações");
    if (specs.bedrooms !== null) add("bedrooms", "Quartos", String(specs.bedrooms), "Especificações");
    if (specs.bathrooms !== null) add("bathrooms", "Casas de banho", String(specs.bathrooms), "Especificações");
    if (specs.parking !== null) add("parking", "Estacionamento", String(specs.parking), "Especificações");
    if (specs.typology) add("typology", "Tipologia", specs.typology, "Especificações");
    if (specs.condition) add("condition", "Estado", specs.condition, "Especificações");
    if (specs.year_built) add("year_built", "Ano de construção", String(specs.year_built), "Especificações");
    if (specs.energy_rating) add("energy", "Certificado energético", specs.energy_rating, "Especificações");
    specs.amenities.forEach((a) =>
      facts.push({ key: "amenity", label: "Comodidade", value: a, source: "Especificações", status: "confirmed" }),
    );
    specs.features.forEach((f) =>
      facts.push({ key: "feature", label: "Característica", value: f, source: "Especificações", status: "confirmed" }),
    );
    specs.views.forEach((v) =>
      facts.push({ key: "view", label: "Vista", value: v, source: "Especificações", status: "confirmed" }),
    );
  }

  const listingRow = one<Row>(
    `SELECT * FROM property_content WHERE property_id = ? AND kind = 'listing' AND locale = 'pt'
     ORDER BY updated_at DESC LIMIT 1`,
    [propertyId],
  );
  const approvedRow = one<Row>(
    `SELECT * FROM property_content WHERE property_id = ? AND kind = 'listing' AND status = 'approved'
     ORDER BY updated_at DESC LIMIT 1`,
    [propertyId],
  );
  const approvedPhotos =
    one<{ c: number }>(
      `SELECT count(*) AS c FROM property_media WHERE property_id = ? AND status = 'approved' AND kind = 'photo'`,
      [propertyId],
    )?.c ?? 0;

  return {
    property,
    facts,
    byKey: Object.fromEntries(facts.map((f) => [f.key, f])),
    amenities: specs?.amenities ?? [],
    features: specs?.features ?? [],
    listing: listingRow
      ? { locale: listingRow.locale, title: listingRow.title, body: listingRow.body, status: listingRow.status }
      : null,
    approvedListing: approvedRow
      ? { locale: approvedRow.locale, title: approvedRow.title, body: approvedRow.body }
      : null,
    approvedPhotos,
  };
}

export function factsDigest(kb: KnowledgeBase) {
  return kb.facts
    .filter((f) => f.key !== "title" && f.key !== "reference")
    .map((f) => `- ${f.label}: ${f.value} (fonte: ${f.source})`)
    .join("\n");
}

/** Media-level analysis inputs (approved + pending) for the vision/analysis step. */
export function mediaInventory(orgId: string, propertyId: string) {
  return many<Row>(
    `SELECT * FROM property_media WHERE org_id = ? AND property_id = ? ORDER BY sort, created_at`,
    [orgId, propertyId],
  ).map(mapMedia);
}

export function orgBranding(orgId: string) {
  const row = one<Row>(`SELECT branding FROM organizations WHERE id = ?`, [orgId]);
  return parseJson<Record<string, string>>(row?.branding, {});
}
