import assert from "node:assert/strict";
import test from "node:test";
import {
  contactRequestSchema,
  loginSchema,
  propertyInputSchema,
  propertyUpdateSchema,
  visitInputSchema,
} from "../src/lib/schemas";

const baseProperty = {
  title: "Apartamento no Chiado",
  property_type: "apartment",
  operation: "sale" as const,
  price: 850000,
  country: "Portugal",
  city: "Lisboa",
  specs: {
    usable_area_m2: 120,
    plot_area_m2: null,
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    typology: "T2",
    condition: "Bom",
    year_built: 1954,
    energy_rating: "C",
    amenities: ["Elevador"],
    features: [],
    views: [],
  },
};

test("property input accepts the wizard payload and normalises numbers", () => {
  const parsed = propertyInputSchema.parse({ ...baseProperty, price: "850.000" });
  assert.equal(parsed.specs.usable_area_m2, 120);
  assert.equal(parsed.address_private, true);
  assert.deepEqual(parsed.tasks, ["generate_listing"]);
});

test("property input rejects negative prices", () => {
  assert.throws(() => propertyInputSchema.parse({ ...baseProperty, price: -10 }));
});

test("partial property updates do not require every field", () => {
  const parsed = propertyUpdateSchema.parse({ title: "Novo título do imóvel" });
  assert.equal(parsed.title, "Novo título do imóvel");
});

test("contact requests require explicit consent", () => {
  const payload = { name: "Ana Silva", email: "ana@example.com", consent: false };
  assert.throws(() => contactRequestSchema.parse(payload));
  const ok = contactRequestSchema.parse({ ...payload, consent: true });
  assert.equal(ok.consent, true);
  assert.equal(ok.kind, "contact");
});

test("honeypot submissions are rejected", () => {
  assert.throws(() =>
    contactRequestSchema.parse({
      name: "Bot",
      email: "bot@example.com",
      consent: true,
      website: "http://spam.example",
    }),
  );
});

test("visit creation requires a valid property id and state", () => {
  assert.throws(() => visitInputSchema.parse({ property_id: "not-a-uuid" }));
  const parsed = visitInputSchema.parse({
    property_id: "6a8f1c1e-0f34-4d0c-9a58-2a6c7b1f0a11",
    status: "requested",
  });
  assert.equal(parsed.timezone, "Europe/Lisbon");
});

test("login validates email shape", () => {
  assert.throws(() => loginSchema.parse({ email: "nope", password: "x" }));
});
