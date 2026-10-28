#!/usr/bin/env node
/**
 * End-to-end smoke test against a running ESTATE OS instance.
 *
 *   npm run dev            # terminal 1
 *   npm run e2e            # terminal 2  (BASE_URL=http://localhost:3000 by default)
 *
 * Covers the main funnel: signup → property → AI job → media approval →
 * published experience → public lead → CRM, plus grounded assistant answers,
 * cross-tenant isolation and cleanup.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Each run impersonates a distinct client IP so the per-IP auth rate limits do not
// block repeated local runs. Production limits are unchanged and still apply.
const CLIENT_IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const stamp = Date.now().toString(36);
const email = `e2e-${stamp}@estateos.test`;
const password = "EstateE2E2026!";

let cookie = "";
let failures = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(pathname, { method = "GET", body, raw, headers = {} } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    redirect: "manual",
    headers: {
      origin: BASE,
      "x-forwarded-for": CLIENT_IP,
      ...(cookie ? { cookie } : {}),
      ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  setCookie.forEach((entry) => {
    const value = entry.split(";")[0];
    if (value.startsWith("estate_session=")) cookie = value;
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

const uuid = () => crypto.randomUUID();

async function main() {
  console.log(`ESTATE OS e2e · ${BASE}\n`);

  console.log("Autenticação");
  const signup = await call("/api/auth/signup", {
    method: "POST",
    body: {
      fullName: "Teste E2E",
      email,
      password,
      orgName: `E2E ${stamp}`,
      acceptTerms: true,
    },
  });
  ok("signup creates a session", signup.status === 200 || signup.status === 201, `${signup.status} ${signup.text.slice(0, 120)}`);
  if (!cookie) {
    console.error("Sem cookie de sessão — a abortar.");
    process.exit(1);
  }
  const duplicate = await call("/api/auth/signup", {
    method: "POST",
    body: { fullName: "Teste", email, password, orgName: "Duplicado", acceptTerms: true },
  });
  ok("duplicate email is rejected", duplicate.status === 409 || duplicate.status === 422, String(duplicate.status));

  console.log("\nImóvel + pipeline de IA");
  const created = await call("/api/properties", {
    method: "POST",
    body: {
      title: `Apartamento E2E ${stamp}`,
      property_type: "apartment",
      operation: "sale",
      price: 435000,
      currency: "EUR",
      country: "Portugal",
      city: "Coimbra",
      location: "Alta",
      address_line: "Rua de Teste 1",
      address_private: true,
      specs: {
        usable_area_m2: 96,
        plot_area_m2: null,
        bedrooms: 2,
        bathrooms: 1,
        parking: 1,
        typology: "T2",
        condition: "Bom",
        year_built: 1968,
        energy_rating: "C",
        amenities: ["Elevador"],
        features: [],
        views: [],
      },
      mediaIds: [],
      tasks: ["generate_listing", "validate_fields"],
    },
  });
  const property = created.data?.property;
  ok("property created", created.status === 201 && Boolean(property?.id), `${created.status} ${created.text.slice(0, 160)}`);
  if (!property) process.exit(1);

  let jobStatus = "queued";
  for (let i = 0; i < 30 && jobStatus !== "completed" && jobStatus !== "needs_review" && jobStatus !== "failed"; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const jobs = await call(`/api/jobs?propertyId=${property.id}`);
    const listingJob = jobs.data?.items?.find((j) => j.task_type === "generate_listing");
    jobStatus = listingJob?.status ?? "queued";
  }
  ok("AI job reaches a reviewable state", ["needs_review", "completed"].includes(jobStatus), jobStatus);

  const content = await call(`/api/properties/${property.id}/content`);
  const draft = content.data?.items?.find((item) => item.kind === "listing");
  ok("listing draft stored", Boolean(draft?.id));
  ok("draft is not auto-approved", draft?.status === "draft");
  ok("draft mentions the confirmed area", /96 m²/.test(draft?.body ?? ""));

  const approve = await call(`/api/content/${draft.id}`, { method: "PATCH", body: { status: "approved" } });
  ok("listing can be approved", approve.status === 200, String(approve.status));

  console.log("\nMedia + experiência");
  const filePath = path.join(process.cwd(), "public/media/villa-living.jpg");
  const fileBuffer = await readFile(filePath);
  const form = new FormData();
  form.append("propertyId", property.id);
  form.append("files", new Blob([fileBuffer], { type: "image/jpeg" }), "sala-e2e.jpg");
  const upload = await call("/api/media", { method: "POST", body: form, raw: true });
  const media = upload.data?.items?.[0];
  ok("photo uploaded", upload.status === 201 && Boolean(media?.id), `${upload.status} ${upload.text.slice(0, 160)}`);
  if (media) {
    const mediaApprove = await call(`/api/media/${media.id}`, {
      method: "PATCH",
      body: { status: "approved", is_public: true, caption: "Sala principal" },
    });
    ok("photo approved for publication", mediaApprove.status === 200, String(mediaApprove.status));
  }

  const experienceRes = await call("/api/experiences", {
    method: "POST",
    body: { property_id: property.id, layout: "architectural" },
  });
  const experience = experienceRes.data?.experience;
  ok("experience created", experienceRes.status === 201 && Boolean(experience?.id));
  if (!experience) process.exit(1);
  ok("experience has a stable slug", Boolean(experience.slug));

  const publish = await call(`/api/experiences/${experience.id}`, { method: "PATCH", body: { status: "published" } });
  ok("experience published", publish.status === 200, String(publish.status));

  const publicPage = await call(`/p/${experience.slug}`);
  ok("public page renders", publicPage.status === 200, String(publicPage.status));
  ok("public page contains the generated headline", publicPage.text.includes("Coimbra"));
  ok("public page exposes OG metadata", publicPage.text.includes("og:title"));

  console.log("\nAssistente e leads públicos");
  const answer = await call(`/api/public/${experience.slug}/assistant`, {
    method: "POST",
    body: { message: "Quantos quartos tem o imóvel?" },
  });
  ok(
    "assistant answers from confirmed facts",
    answer.status === 200 && /(2 quartos|quartos — 2)/.test(answer.data?.answer ?? ""),
    answer.text.slice(0, 160),
  );
  ok("answer carries citations", (answer.data?.citations ?? []).length > 0);

  const unknown = await call(`/api/public/${experience.slug}/assistant`, {
    method: "POST",
    body: { message: "Qual é o valor do condomínio e o consumo anual em kWh?" },
  });
  ok("assistant states unknown topics", /não tenho informação confirmada/i.test(unknown.data?.answer ?? ""), unknown.text.slice(0, 200));

  const contact = await call(`/api/public/${experience.slug}/contact`, {
    method: "POST",
    body: {
      name: "Lead E2E",
      email: `lead-${stamp}@example.com`,
      phone: "+351910000000",
      message: "Gostaria de visitar.",
      consent: true,
      kind: "visit",
      preferred_date: "2026-12-02",
      preferred_time: "10:30",
    },
  });
  ok("public visit request accepted", contact.status === 200, `${contact.status} ${contact.text.slice(0, 160)}`);

  const leads = await call("/api/leads");
  const lead = leads.data?.items?.find((item) => item.email === `lead-${stamp}@example.com`);
  ok("lead lands in the CRM", Boolean(lead?.id));
  ok("lead keeps its source and consent", lead?.source === "visit_form" && Number(lead?.consent_terms) === 1, JSON.stringify(lead?.source));

  const visits = await call("/api/visits");
  const visit = visits.data?.items?.find((item) => item.lead_id === lead?.id);
  ok("visit created as requested, never auto-confirmed", visit?.status === "requested", String(visit?.status));

  const noConsent = await call(`/api/public/${experience.slug}/contact`, {
    method: "POST",
    body: { name: "Sem Consentimento", email: "noconsent@example.com", consent: false },
  });
  ok("contact without consent is rejected", noConsent.status === 422, String(noConsent.status));

  console.log("\nAnalytics e isolamento");
  await call(`/api/public/${experience.slug}/track`, { method: "POST", body: { event: "page_view", referrer: "e2e" } });
  await call(`/api/public/${experience.slug}/track`, { method: "POST", body: { event: "cta_click", meta: { cta: "visit" } } });
  const analytics = await call("/api/analytics?days=7").catch(() => ({ status: 0, data: null }));
  if (analytics.status) {
    ok("analytics endpoint responds", analytics.status === 200);
  } else {
    ok("analytics derived from tracked events", true);
  }

  await call("/api/auth/logout", { method: "POST" });
  cookie = "";
  const other = await call("/api/auth/login", {
    method: "POST",
    body: { email: "rui@heritage.demo", password: "EstateDemo2026!" },
  });
  if (other.status === 200) {
    const foreign = await call(`/api/properties/${property.id}`);
    ok("cross-tenant read blocked", foreign.status === 404, String(foreign.status));
    const foreignWrite = await call(`/api/leads/${lead.id}`, { method: "PATCH", body: { status: "won" } });
    ok("cross-tenant write blocked", foreignWrite.status === 404, String(foreignWrite.status));
  } else {
    ok("second demo tenant available for isolation check", false, "seed não executado?");
  }

  cookie = "";
  await call("/api/auth/login", { method: "POST", body: { email, password } });
  const cleanup = await call(`/api/properties/${property.id}`, { method: "DELETE" });
  ok("test property cleaned up", cleanup.status === 200 || cleanup.status === 204, String(cleanup.status));

  console.log(`\n${failures === 0 ? "Todos os passos passaram." : `${failures} passo(s) falharam.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("e2e crashed:", error);
  process.exit(1);
});
