import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeBase } from "../src/server/ai/knowledge";
import type { Property, PropertyMedia } from "../src/lib/types";
import {
  buildFaq,
  generateAudienceVersions,
  generateCampaign,
  generateListing,
  generateMediaBrief,
  validateProperty,
} from "../src/server/ai/engine";

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: "p1",
    org_id: "o1",
    reference: "ES-TEST-0001",
    title: "Casa da Ribeira",
    property_type: "townhouse",
    operation: "sale",
    price_cents: 62_500_000,
    currency: "EUR",
    country: "Portugal",
    city: "Porto",
    location: "Ribeira",
    address_line: "Rua Confidencial 4",
    address_private: 1,
    status: "ready",
    summary: null,
    internal_notes: null,
    completion: 80,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    specs: {
      property_id: "p1",
      usable_area_m2: 168,
      plot_area_m2: 210,
      bedrooms: 3,
      bathrooms: 2,
      parking: 1,
      typology: "T3",
      condition: "Bom",
      year_built: 1908,
      energy_rating: "D",
      amenities: ["Jardim"],
      features: ["Pé-direito alto"],
      views: [],
      extra_fields: [],
    },
    ...overrides,
  } as Property;
}

function knowledge(overrides: Partial<Property> = {}): KnowledgeBase {
  const p = property(overrides);
  const facts = [
    { key: "title", label: "Título interno", value: p.title, source: "Ficha do imóvel", status: "confirmed" as const },
    { key: "city", label: "Cidade", value: p.city ?? "", source: "Ficha do imóvel", status: "confirmed" as const },
    { key: "area", label: "Área útil", value: "168 m²", source: "Especificações", status: "confirmed" as const },
  ];
  return {
    property: p,
    facts,
    byKey: Object.fromEntries(facts.map((f) => [f.key, f])),
    amenities: p.specs?.amenities ?? [],
    features: p.specs?.features ?? [],
    listing: null,
    approvedListing: null,
    approvedPhotos: 2,
  };
}

const photo = (overrides: Partial<PropertyMedia> = {}): PropertyMedia => ({
  id: "m1",
  property_id: "p1",
  file_name: "sala-principal.jpg",
  public_path: null,
  mime_type: "image/jpeg",
  size_bytes: 1000,
  kind: "photo",
  room: null,
  caption: null,
  tags: [],
  is_primary: 1,
  is_public: 1,
  status: "approved",
  sort: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("listing uses only confirmed facts and never invents amenities", () => {
  const kb = knowledge();
  const piece = generateListing(kb, "pt");
  assert.match(piece.body, /168 m²/);
  assert.match(piece.body, /Porto/);
  assert.match(piece.body, /Jardim/);
  assert.doesNotMatch(piece.body.toLowerCase(), /piscina/);
  assert.doesNotMatch(piece.body.toLowerCase(), /vista/);
  assert.doesNotMatch(piece.body, /Rua Confidencial/, "private address must not leak");
});

test("listing reports missing data instead of guessing", () => {
  const kb = knowledge({ city: null, price_cents: 0 });
  const piece = generateListing(kb, "pt");
  assert.match(piece.body, /Informação ainda não confirmada/);
  assert.match(String(piece.payload.unconfirmed).toLowerCase(), /cidade|preço/);
});

test("english listing is generated from the same facts", () => {
  const piece = generateListing(knowledge(), "en");
  assert.match(piece.body, /For sale|for sale/);
  assert.match(piece.body, /Porto/);
  assert.match(piece.body, /168 m²/);
});

test("audience versions are distinct and never promise yields", () => {
  const versions = generateAudienceVersions(knowledge());
  assert.equal(versions.length, 4);
  assert.deepEqual(
    versions.map((v) => v.variant),
    ["national", "international", "families", "investors"],
  );
  const investors = versions.find((v) => v.variant === "investors")!;
  assert.match(investors.body, /Não são apresentadas projeções de rentabilidade/);
  versions.forEach((version) => {
    assert.doesNotMatch(version.body.toLowerCase(), /garantia de rentabilidade|yield of \d/);
  });
});

test("campaign has every requested channel and no fabricated social proof", () => {
  const piece = generateCampaign(knowledge(), "pt");
  const payload = piece.payload as Record<string, unknown>;
  ["social", "instagram", "ads", "email", "whatsapp", "arguments", "faq", "video_script"].forEach((key) => {
    assert.ok(payload[key], `missing ${key}`);
  });
  assert.match(String(payload.video_script), /Não representa um vídeo gerado/);
  assert.equal((payload.faq as unknown[]).length > 0, true);
  assert.doesNotMatch(piece.body.toLowerCase(), /testemunho|cliente satisfeito|melhor investimento/);
});

test("media brief is explicitly a brief, not a generated video", () => {
  const piece = generateMediaBrief(knowledge(), "pt", [photo()]);
  assert.equal(piece.payload.is_generated_video, false);
  assert.equal(piece.payload.video_provider_configured, false);
  assert.match(piece.body, /Não é um vídeo gerado/);
});

test("verification catches impossible combinations", () => {
  const kb = knowledge({ specs: { ...property().specs!, usable_area_m2: 400, plot_area_m2: 200 } });
  const report = validateProperty(kb, [photo()]);
  const areaIssue = report.issues.find((issue) => issue.field === "usable_area_m2" && issue.level === "error");
  assert.ok(areaIssue, "area greater than plot must be an error");

  const future = knowledge({ specs: { ...property().specs!, year_built: new Date().getFullYear() + 5 } });
  assert.ok(validateProperty(future, [photo()]).issues.some((i) => i.field === "year_built" && i.level === "error"));
});

test("verification warns when no approved photography exists", () => {
  const report = validateProperty(knowledge(), [photo({ status: "pending", is_public: 0 })]);
  assert.ok(report.issues.some((issue) => issue.field === "media" && issue.level === "warning"));
});

test("media suggestions stay pending and do not claim visual analysis", () => {
  const report = validateProperty(knowledge(), [photo({ file_name: "cozinha-01.jpg" })]);
  const suggestion = report.mediaSuggestions[0];
  assert.equal(suggestion.status, "pending");
  assert.equal(suggestion.suggested_room, "Cozinha");
  assert.match(suggestion.note, /Não interpreta o conteúdo da imagem/);
});

test("faq marks unknown answers as unknown", () => {
  const kb = knowledge({ specs: { ...property().specs!, energy_rating: null } });
  const faq = buildFaq(kb);
  const energy = faq.find((item) => /certificado/i.test(item.q))!;
  assert.equal(energy.known, false);
  assert.match(energy.a, /não disponível|Não/);
});
