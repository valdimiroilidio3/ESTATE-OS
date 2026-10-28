import { many, type Row } from "../db";
import type { KnowledgeBase } from "./knowledge";
import type { PropertyInput } from "@/lib/schemas";
import { mapMedia } from "../data/properties";
import type { Property } from "@/lib/types";

/**
 * Builds a transient knowledge base from wizard input, before the property row
 * exists. Used only for the assisted verification preview — nothing is persisted.
 */
export function knowledgeFromDraft(input: PropertyInput, mediaRows: Row[]): KnowledgeBase {
  const nowIso = new Date().toISOString();
  const property: Property = {
    id: "draft",
    org_id: "draft",
    reference: "RASCUNHO",
    title: input.title,
    property_type: input.property_type,
    operation: input.operation,
    price_cents: Math.round((input.price ?? 0) * 100),
    currency: input.currency,
    country: input.country ?? null,
    city: input.city ?? null,
    location: input.location ?? null,
    address_line: input.address_line ?? null,
    address_private: input.address_private ? 1 : 0,
    status: "draft",
    summary: input.summary ?? null,
    internal_notes: null,
    completion: 0,
    created_at: nowIso,
    updated_at: nowIso,
    specs: {
      property_id: "draft",
      usable_area_m2: input.specs.usable_area_m2,
      plot_area_m2: input.specs.plot_area_m2,
      bedrooms: input.specs.bedrooms,
      bathrooms: input.specs.bathrooms,
      parking: input.specs.parking,
      typology: input.specs.typology ?? null,
      condition: input.specs.condition ?? null,
      year_built: input.specs.year_built,
      energy_rating: input.specs.energy_rating ?? null,
      amenities: input.specs.amenities,
      features: input.specs.features,
      views: input.specs.views,
      extra_fields: [],
    },
  };
  const facts = [] as KnowledgeBase["facts"];
  const add = (key: string, label: string, value: string | number | null | undefined, source: string) => {
    if (value === null || value === undefined || value === "") return;
    facts.push({ key, label, value: String(value), source, raw: value, status: "confirmed" });
  };
  add("title", "Título interno", property.title, "Ficha do imóvel");
  add("city", "Cidade", property.city, "Ficha do imóvel");
  add("country", "País", property.country, "Ficha do imóvel");
  add("location", "Zona", property.location, "Ficha do imóvel");
  add("price", "Preço", property.price_cents ? property.price_cents / 100 : null, "Ficha do imóvel");
  const s = property.specs!;
  add("area", "Área útil", s.usable_area_m2 ? `${s.usable_area_m2} m²` : null, "Especificações");
  add("plot", "Área do terreno", s.plot_area_m2 ? `${s.plot_area_m2} m²` : null, "Especificações");
  add("bedrooms", "Quartos", s.bedrooms, "Especificações");
  add("bathrooms", "Casas de banho", s.bathrooms, "Especificações");
  add("parking", "Estacionamento", s.parking, "Especificações");
  add("year_built", "Ano de construção", s.year_built, "Especificações");
  add("energy", "Certificado energético", s.energy_rating, "Especificações");
  add("condition", "Estado", s.condition, "Especificações");
  s.amenities.forEach((a) => facts.push({ key: "amenity", label: "Comodidade", value: a, source: "Especificações", status: "confirmed" }));
  s.features.forEach((f) => facts.push({ key: "feature", label: "Característica", value: f, source: "Especificações", status: "confirmed" }));
  s.views.forEach((v) => facts.push({ key: "view", label: "Vista", value: v, source: "Especificações", status: "confirmed" }));

  const approvedPhotos = mediaRows.filter((m) => m.kind === "photo").length;

  return {
    property,
    facts,
    byKey: Object.fromEntries(facts.map((f) => [f.key, f])),
    amenities: s.amenities,
    features: s.features,
    listing: null,
    approvedListing: null,
    approvedPhotos,
  };
}

export function stagedMedia(orgId: string, ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return many<Row>(
    `SELECT * FROM property_media WHERE org_id = ? AND property_id IS NULL AND id IN (${placeholders}) ORDER BY sort`,
    [orgId, ...ids],
  ).map(mapMedia);
}
