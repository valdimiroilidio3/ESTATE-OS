/**
 * Demo seed. Creates two isolated organisations so that multi-tenant isolation
 * can be verified end-to-end, plus a realistic property pipeline.
 *
 * All records are clearly fictional demonstration data.
 */
import fs from "node:fs";
import path from "node:path";
import { db, run, one, uid, now } from "../src/server/db";
import { hashPassword } from "../src/server/auth";
import { ensurePlans } from "../src/server/plans";

function reset() {
  const tables = [
    "conversation_messages",
    "conversations",
    "analytics_events",
    "audit_logs",
    "privacy_requests",
    "lead_events",
    "visits",
    "leads",
    "ai_usage",
    "ai_jobs",
    "property_content",
    "property_experiences",
    "property_documents",
    "property_media",
    "property_specs",
    "properties",
    "invitations",
    "sessions",
    "organization_members",
    "subscriptions",
    "organizations",
    "profiles",
  ];
  db.pragma("foreign_keys = OFF");
  tables.forEach((t) => run(`DELETE FROM ${t}`));
  db.pragma("foreign_keys = ON");
}

const PHOTOS = [
  { file: "villa-exterior.jpg", room: "Exterior", caption: "Fachada principal ao final do dia" },
  { file: "villa-living.jpg", room: "Sala", caption: "Sala de estar com acesso ao terraço" },
  { file: "villa-kitchen.jpg", room: "Cozinha", caption: "Cozinha em carvalho e pedra" },
  { file: "villa-pool.jpg", room: "Piscina", caption: "Piscina exterior virada a poente" },
  { file: "villa-bedroom.jpg", room: "Quarto", caption: "Suite principal" },
];

function propertiesSeed() {
  return [
    {
      id: uid(),
      reference: "ES-2026-0001",
      title: "Villa Atlântica",
      type: "villa",
      operation: "sale",
      price: 245_000_000,
      city: "Cascais",
      country: "Portugal",
      location: "Guia",
      address: "Rua das Gaivotas 24",
      summary:
        "Moradia contemporânea com 245 m² de área útil, cinco minutos da praia da Guia. Piscina exterior, jardim maduro e garagem para dois automóveis.",
      status: "published",
      completion: 95,
      specs: {
        usable: 245,
        plot: 620,
        bedrooms: 4,
        bathrooms: 4,
        parking: 2,
        typology: "T4",
        condition: "Novo",
        year: 2021,
        energy: "A",
        amenities: ["Piscina", "Jardim", "Garagem", "Ar condicionado", "Domótica", "Painéis solares"],
        features: ["Grandes vãos envidraçados", "Pé-direito duplo na sala", "Cozinha equipada em carvalho"],
        views: ["Mar"],
      },
      photos: PHOTOS,
    },
    {
      id: uid(),
      reference: "ES-2026-0002",
      title: "Apartamento Chiado",
      type: "apartment",
      operation: "sale",
      price: 895_000_00,
      city: "Lisboa",
      country: "Portugal",
      location: "Chiado",
      address: "Rua Nova da Trindade 18",
      summary: "Apartamento renovado de 112 m² no Chiado, com dois quartos e pé-direito alto.",
      status: "in_preparation",
      completion: 55,
      specs: {
        usable: 112,
        plot: null,
        bedrooms: 2,
        bathrooms: 2,
        parking: null,
        typology: "T2",
        condition: "Renovado",
        year: 1908,
        energy: "C",
        amenities: ["Elevador", "Ar condicionado"],
        features: ["Pé-direito de 3,4 m", "Janelas originais restauradas"],
        views: [],
      },
      photos: [{ file: "apt-lisbon.jpg", room: "Sala", caption: "Sala com janelas altas" }],
    },
    {
      id: uid(),
      reference: "ES-2026-0003",
      title: "Casa da Foz",
      type: "townhouse",
      operation: "rent",
      price: 420_000,
      city: "Porto",
      country: "Portugal",
      location: "Foz do Douro",
      address: null,
      summary: null,
      status: "draft",
      completion: 20,
      specs: {
        usable: null,
        plot: null,
        bedrooms: 3,
        bathrooms: null,
        parking: 1,
        typology: null,
        condition: null,
        year: null,
        energy: null,
        amenities: [],
        features: [],
        views: [],
      },
      photos: [{ file: "townhouse-porto.jpg", room: "Exterior", caption: "Fachada em granito" }],
    },
  ];
}

function seed() {
  console.log("· a reiniciar base de dados…");
  reset();
  ensurePlans();

  const demoOrg = uid();
  const otherOrg = uid();
  run(
    `INSERT INTO organizations (id, name, slug, plan_code, branding, settings, created_at) VALUES (?,?,?,?,?,?,?)`,
    [
      demoOrg,
      "Atlântico Prime",
      "atlantico-prime",
      "pro",
      JSON.stringify({
        agencyName: "Atlântico Prime",
        tagline: "Propriedades com arquitectura e carácter.",
        email: "consultores@atlanticoprime.pt",
        phone: "+351 210 000 000",
        accent: "#C6A77A",
      }),
      JSON.stringify({ demo: true, assistantEnabled: true, showAssistantTranscripts: true, retentionMonths: 24, dataController: "Atlântico Prime — Mediação Imobiliária, Lda." }),
      now(),
    ],
  );
  run(
    `INSERT INTO organizations (id, name, slug, plan_code, branding, settings, created_at) VALUES (?,?,?,?,?,?,?)`,
    [otherOrg, "Heritage Lisbon", "heritage-lisbon", "starter", "{}", JSON.stringify({ demo: true }), now()],
  );

  const demoOwner = uid();
  const demoAgent = uid();
  const otherOwner = uid();
  const password = hashPassword("EstateDemo2026!");
  run(`INSERT INTO profiles (id, email, full_name, password_hash, created_at) VALUES (?,?,?,?,?)`, [
    demoOwner,
    "helena@estateos.demo",
    "Helena Marques",
    password,
    now(),
  ]);
  run(`INSERT INTO profiles (id, email, full_name, password_hash, created_at) VALUES (?,?,?,?,?)`, [
    demoAgent,
    "tomas@estateos.demo",
    "Tomás Ferreira",
    password,
    now(),
  ]);
  run(`INSERT INTO profiles (id, email, full_name, password_hash, created_at) VALUES (?,?,?,?,?)`, [
    otherOwner,
    "rui@heritage.demo",
    "Rui Almeida",
    password,
    now(),
  ]);
  run(`INSERT INTO organization_members (org_id, profile_id, role, title, created_at) VALUES (?,?,?,?,?)`, [
    demoOrg,
    demoOwner,
    "owner",
    "Sócia-gerente",
    now(),
  ]);
  run(`INSERT INTO organization_members (org_id, profile_id, role, title, created_at) VALUES (?,?,?,?,?)`, [
    demoOrg,
    demoAgent,
    "agent",
    "Consultor sénior",
    now(),
  ]);
  run(`INSERT INTO organization_members (org_id, profile_id, role, title, created_at) VALUES (?,?,?,?,?)`, [
    otherOrg,
    otherOwner,
    "owner",
    "Proprietário",
    now(),
  ]);
  run(`INSERT INTO subscriptions (id, org_id, plan_code, status, created_at) VALUES (?,?,?,?,?)`, [
    uid(),
    demoOrg,
    "pro",
    "unconfigured",
    now(),
  ]);
  run(`INSERT INTO subscriptions (id, org_id, plan_code, status, created_at) VALUES (?,?,?,?,?)`, [
    uid(),
    otherOrg,
    "starter",
    "unconfigured",
    now(),
  ]);

  const seeded = propertiesSeed();
  const mediaIds: Record<string, string[]> = {};

  seeded.forEach((p, index) => {
    run(
      `INSERT INTO properties (id, org_id, reference, title, property_type, operation, price_cents, currency, country, city,
        location, address_line, address_private, status, summary, completion, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id,
        demoOrg,
        p.reference,
        p.title,
        p.type,
        p.operation,
        p.price,
        "EUR",
        p.country,
        p.city,
        p.location,
        p.address,
        1,
        p.status,
        p.summary,
        p.completion,
        demoOwner,
        new Date(Date.now() - (index + 3) * 86400000).toISOString(),
        new Date(Date.now() - index * 3600000).toISOString(),
      ],
    );
    const s = p.specs;
    run(
      `INSERT INTO property_specs (property_id, org_id, usable_area_m2, plot_area_m2, bedrooms, bathrooms, parking, typology,
        condition, year_built, energy_rating, amenities, features, views, extra_fields)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id,
        demoOrg,
        s.usable,
        s.plot,
        s.bedrooms,
        s.bathrooms,
        s.parking,
        s.typology,
        s.condition,
        s.year,
        s.energy,
        JSON.stringify(s.amenities),
        JSON.stringify(s.features),
        JSON.stringify(s.views),
        "[]",
      ],
    );
    mediaIds[p.id] = [];
    p.photos.forEach((photo, i) => {
      const id = uid();
      mediaIds[p.id].push(id);
      run(
        `INSERT INTO property_media (id, org_id, property_id, public_path, file_name, mime_type, size_bytes, kind, room,
          caption, tags, is_primary, is_public, status, sort, uploaded_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          demoOrg,
          p.id,
          `/media/${photo.file}`,
          photo.file,
          "image/jpeg",
          240000,
          "photo",
          photo.room,
          photo.caption,
          JSON.stringify(["arquitectura"]),
          i === 0 ? 1 : 0,
          1,
          "approved",
          i,
          demoOwner,
          now(),
          now(),
        ],
      );
    });
  });

  const [villa, chiado, foz] = seeded;

  // ── content for the published villa
  const listingPtId = uid();
  run(
    `INSERT INTO property_content (id, org_id, property_id, kind, locale, variant, title, body, payload, provider, status,
      approved_by, approved_at, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      listingPtId,
      demoOrg,
      villa.id,
      "listing",
      "pt",
      "default",
      "Moradia T4 em Cascais · 245 m²",
      `Moradia para venda em Cascais, Guia, com 245 m² de área útil e 605 m² de terreno.\n\nO imóvel integra grandes vãos envidraçados, pé-direito duplo na sala e cozinha equipada em carvalho. Entre as comodidades confirmadas contam-se piscina, jardim, garagem, ar condicionado, domótica e painéis solares.\n\nConstruída em 2021, com certificado energético A. Estacionamento para dois automóveis.\n\nDisponível para venda por 2 450 000 €. Toda a informação tem origem nos dados registados pela agência.`,
      JSON.stringify({
        summary:
          "Moradia contemporânea com 245 m² de área útil junto à praia da Guia. Piscina, jardim maduro e garagem para dois automóveis.",
        features: [
          "Área útil: 245 m²",
          "Terreno: 605 m²",
          "4 quartos",
          "4 casas de banho",
          "2 lugares de estacionamento",
          "Certificado energético A",
          "Piscina",
          "Jardim",
          "Domótica",
        ],
        metaTitle: "Villa Atlântica | Moradia T4 em Cascais",
        metaDescription:
          "Moradia T4 em Cascais com 245 m², piscina e jardim. Apresentação completa, fotografias e pedido de visita.",
        ctas: ["Solicitar visita", "Falar com o consultor", "Pedir informações"],
        sources: ["Ficha do imóvel", "Especificações"],
      }),
      "local-rules",
      "approved",
      demoOwner,
      now(),
      demoOwner,
      now(),
      now(),
    ],
  );
  run(
    `INSERT INTO property_content (id, org_id, property_id, kind, locale, variant, title, body, payload, provider, status, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      demoOrg,
      villa.id,
      "campaign",
      "pt",
      "default",
      "Pacote de campanha",
      "Villa Atlântica — Cascais · 2 450 000 €\n\nPiscina · Jardim · 245 m²\n\nApresentação completa e pedido de visita no link.",
      JSON.stringify({
        social: "Villa Atlântica — Cascais · 2 450 000 €\n\nPiscina · Jardim · 245 m²\n\nApresentação completa e pedido de visita no link.",
        instagram: "Villa Atlântica\n\n◦ 245 m² de área útil\n◦ 4 quartos\n◦ Piscina e jardim\n◦ Certificado A\n\nToda a informação na página do imóvel.",
        ads: { headline: "Moradia T4 em Cascais", description: "245 m², piscina e jardim. Pedido de visita online.", keywords: ["villa", "Cascais", "comprar casa", "piscina"] },
        email: "Assunto: Villa Atlântica\n\nMoradia T4 em Cascais, 245 m², piscina e jardim.",
        whatsapp: "Olá! Partilho-lhe Villa Atlântica — Cascais · 2 450 000 €. Interessa-lhe agendar visita?",
        salesArguments: ["245 m² de área útil", "Certificado energético A", "Piscina e jardim maduro"],
        faq: [],
        videoScript: ["0:00 — Fachada ao final do dia", "0:08 — Sala e cozinha", "0:48 — Piscina"],
      }),
      "local-rules",
      "draft",
      demoOwner,
      now(),
      now(),
    ],
  );

  const experienceId = uid();
  const slug = "villa-atlantica-cascais";
  run(
    `INSERT INTO property_experiences (id, org_id, property_id, layout, slug, status, config, published_at, view_count, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      experienceId,
      demoOrg,
      villa.id,
      "signature",
      slug,
      "published",
      JSON.stringify({
        hero: {
          headline: "Villa Atlântica",
          subheadline:
            "Arquitetura contemporânea sobre a Guia, a poucos minutos do mar. Quatro quartos, luz a poente e piscina exterior.",
          showPrice: true,
          locationLabel: "Guia, Cascais",
          primaryCta: "Solicitar visita",
          secondaryCta: "Falar com o consultor",
        },
        sections: [
          { id: "story", enabled: true },
          { id: "gallery", enabled: true },
          { id: "specifications", enabled: true },
          { id: "highlights", enabled: true },
          { id: "location", enabled: true },
          { id: "assistant", enabled: true },
          { id: "visit", enabled: true },
        ],
        contact: {
          name: "Tomás Ferreira",
          email: "tomas@estateos.demo",
          phone: "+351 912 000 000",
          role: "Consultor sénior",
        },
        map: { enabled: true, lat: 38.6968, lng: -9.4265, showExactAddress: false },
        theme: { accent: "#C6A77A", tone: "light" },
      }),
      now(),
      0,
      demoOwner,
      now(),
      now(),
    ],
  );

  run(
    `INSERT INTO property_experiences (id, org_id, property_id, layout, slug, status, config, view_count, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      demoOrg,
      chiado.id,
      "architectural",
      "apartamento-chiado-lisboa",
      "draft",
      JSON.stringify({
        hero: {
          headline: "Apartamento Chiado",
          subheadline: "Pé-direito alto e luz de Lisboa, num apartamento renovado de 112 m².",
          showPrice: true,
          locationLabel: "Chiado, Lisboa",
          primaryCta: "Solicitar visita",
          secondaryCta: "Falar com o consultor",
        },
        sections: [
          { id: "story", enabled: true },
          { id: "gallery", enabled: true },
          { id: "specifications", enabled: true },
          { id: "highlights", enabled: true },
          { id: "location", enabled: false },
          { id: "assistant", enabled: true },
          { id: "visit", enabled: true },
        ],
        contact: { name: "Helena Marques", email: "helena@estateos.demo", phone: "+351 210 000 000", role: "Sócia-gerente" },
        map: { enabled: false, lat: null, lng: null, showExactAddress: false },
        theme: { accent: "#C6A77A", tone: "light" },
      }),
      0,
      demoOwner,
      now(),
      now(),
    ],
  );

  // ── leads
  const leadSpecs = [
    { name: "Sofia Bettencourt", email: "sofia.b@example.com", phone: "+351 913 111 222", status: "visit_scheduled", source: "property_page", property: villa.id, message: "Gostaria de visitar no próximo sábado.", priority: "high", owner: demoAgent },
    { name: "James Whitfield", email: "j.whitfield@example.com", phone: null, status: "contacted", source: "property_page", property: villa.id, message: "Is the villa suitable for remote viewing first?", priority: "normal", owner: demoAgent },
    { name: "Marta Oliveira", email: "marta.o@example.com", phone: "+351 966 444 555", status: "new", source: "instagram", property: chiado.id, message: "Qual é o valor do condomínio?", priority: "normal", owner: null },
    { name: "Pedro Nunes", email: "pedro.n@example.com", phone: null, status: "qualified", source: "referral", property: villa.id, message: null, priority: "high", owner: demoOwner },
    { name: "Ana Rita Lopes", email: "ana.lopes@example.com", phone: "+351 933 777 888", status: "won", source: "property_page", property: villa.id, message: "Pretendemos avançar com proposta.", priority: "high", owner: demoOwner },
    { name: "Investidor Silva", email: "invest.silva@example.com", phone: null, status: "lost", source: "campaign", property: null, message: "Procurava rentabilidade garantida.", priority: "low", owner: null },
  ];
  leadSpecs.forEach((l, i) => {
    const id = uid();
    run(
      `INSERT INTO leads (id, org_id, property_id, name, email, phone, source, message, status, priority, owner_id,
        consent_marketing, consent_terms, consent_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        demoOrg,
        l.property,
        l.name,
        l.email,
        l.phone,
        l.source,
        l.message,
        l.status,
        l.priority,
        l.owner,
        0,
        1,
        now(),
        new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        now(),
      ],
    );
    run(
      `INSERT INTO lead_events (id, org_id, lead_id, type, note, actor_id, meta, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [uid(), demoOrg, id, "created", `Origem: ${l.source}`, null, "{}", now()],
    );
  });

  // ── visits
  const upcoming = new Date(Date.now() + 2 * 86400000);
  upcoming.setHours(11, 0, 0, 0);
  const visitLead = one<{ id: string }>(`SELECT id FROM leads WHERE org_id = ? AND status = 'visit_scheduled'`, [demoOrg]);
  run(
    `INSERT INTO visits (id, org_id, property_id, lead_id, agent_id, scheduled_at, timezone, status, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      demoOrg,
      villa.id,
      visitLead?.id ?? null,
      demoAgent,
      upcoming.toISOString(),
      "Europe/Lisbon",
      "confirmed",
      "Visita confirmada por telefone. Cliente quer ver a garagem e a piscina.",
      now(),
      now(),
    ],
  );
  run(
    `INSERT INTO visits (id, org_id, property_id, lead_id, agent_id, scheduled_at, timezone, status, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      demoOrg,
      chiado.id,
      null,
      demoOwner,
      null,
      "Europe/Lisbon",
      "requested",
      "Pedido recebido pelo formulário. Aguarda confirmação de disponibilidade.",
      now(),
      now(),
    ],
  );

  // ── conversations
  const conversationId = uid();
  const visitorKey = uid();
  run(
    `INSERT INTO conversations (id, org_id, property_id, visitor_key, channel, review_status, created_at, last_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [conversationId, demoOrg, villa.id, visitorKey, "property_assistant", "reviewed", now(), now()],
  );
  const messages = [
    { role: "user", content: "Qual é a área útil da moradia?" },
    {
      role: "assistant",
      content:
        "Com base nos dados confirmados: área útil — 245 m²; terreno — 605 m². Esta informação tem origem na ficha do imóvel. Para detalhes adicionais, fale com o consultor.",
      citations: [
        { label: "Área útil", value: "245 m²", source: "Especificações" },
        { label: "Área do terreno", value: "605 m²", source: "Especificações" },
      ],
    },
    { role: "user", content: "Tem vista de mar?" },
    {
      role: "assistant",
      content:
        "Com base nos dados confirmados: vista — Mar. Esta informação tem origem na ficha do imóvel. Para detalhes adicionais, fale com o consultor.",
      citations: [{ label: "Vista", value: "Mar", source: "Especificações" }],
    },
  ];
  messages.forEach((m) => {
    run(
      `INSERT INTO conversation_messages (id, org_id, conversation_id, role, content, citations, provider, grounded, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uid(), demoOrg, conversationId, m.role, m.content, JSON.stringify(m.citations ?? []), "local-rules", m.role === "assistant" ? 1 : 1, now()],
    );
  });

  // ── jobs
  run(
    `INSERT INTO ai_jobs (id, org_id, property_id, task_type, status, provider, attempts, max_attempts, input, output, created_by, created_at, started_at, completed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      demoOrg,
      villa.id,
      "generate_listing",
      "completed",
      "local",
      1,
      2,
      "{}",
      JSON.stringify({ summary: "Rascunho de listagem aprovado por Helena Marques.", contentId: listingPtId, provider: "local-rules" }),
      demoOwner,
      new Date(Date.now() - 3 * 3600000).toISOString(),
      new Date(Date.now() - 3 * 3600000).toISOString(),
      new Date(Date.now() - 3 * 3600000).toISOString(),
    ],
  );
  run(
    `INSERT INTO ai_jobs (id, org_id, property_id, task_type, status, provider, attempts, max_attempts, input, output, created_by, created_at, started_at, completed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      demoOrg,
      chiado.id,
      "generate_campaign",
      "needs_review",
      "local",
      1,
      2,
      "{}",
      JSON.stringify({ summary: "Pacote de campanha gerado para o Chiado. Aguarda revisão." }),
      demoOwner,
      new Date(Date.now() - 40 * 60000).toISOString(),
      new Date(Date.now() - 40 * 60000).toISOString(),
      new Date(Date.now() - 39 * 60000).toISOString(),
    ],
  );
  run(
    `INSERT INTO ai_jobs (id, org_id, property_id, task_type, status, provider, attempts, max_attempts, input, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [uid(), demoOrg, foz.id, "validate_fields", "queued", "local", 0, 2, "{}", demoOwner, now()],
  );

  // ── analytics (demo traffic)
  const events: [string, string | null, number][] = [
    ["page_view", villa.id, 26],
    ["page_view", chiado.id, 11],
    ["page_view", foz.id, 4],
    ["cta_click", villa.id, 9],
    ["cta_click", chiado.id, 3],
    ["visit_request", villa.id, 3],
    ["contact_request", chiado.id, 1],
    ["assistant_message", villa.id, 6],
    ["gallery_open", villa.id, 12],
  ];
  let dayOffset = 0;
  events.forEach(([type, propertyId, count]) => {
    for (let i = 0; i < count; i += 1) {
      dayOffset = (dayOffset + 1) % 13;
      run(
        `INSERT INTO analytics_events (id, org_id, property_id, experience_id, event_type, session_key, path, referrer, meta, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(),
          demoOrg,
          propertyId,
          propertyId === villa.id ? experienceId : null,
          type,
          `demo-${i % 7}`,
          propertyId === villa.id ? `/p/${slug}` : "/p/apartamento-chiado-lisboa",
          i % 3 === 0 ? "instagram" : i % 3 === 1 ? "direct" : "google",
          "{}",
          new Date(Date.now() - dayOffset * 86400000 - i * 600000).toISOString(),
        ],
      );
    }
  });

  // ── audit trail
  const audits = [
    ["property.created", "property", villa.id, "Imóvel criado"],
    ["content.approved", "property_content", listingPtId, "Descrição aprovada"],
    ["experience.published", "experience", experienceId, "Experiência publicada"],
    ["lead.created", "lead", null, "Nova lead via página pública"],
  ];
  audits.forEach(([action, entity, entityId, note], i) => {
    run(
      `INSERT INTO audit_logs (id, org_id, actor_id, action, entity, entity_id, meta, ip, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uid(), demoOrg, demoOwner, action, entity, entityId, JSON.stringify({ note }), null, new Date(Date.now() - (i + 1) * 7200000).toISOString()],
    );
  });

  // ── other org data (isolation fixture)
  const otherPropertyId = uid();
  run(
    `INSERT INTO properties (id, org_id, reference, title, property_type, operation, price_cents, currency, country, city, status, completion, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [otherPropertyId, otherOrg, "ES-2026-0001", "Prédio Heritage", "commercial", "sale", 1_900_000_00, "EUR", "Portugal", "Lisboa", "draft", 10, otherOwner, now(), now()],
  );
  run(
    `INSERT INTO property_specs (property_id, org_id, amenities, features, views, extra_fields) VALUES (?,?,?,?,?,?)`,
    [otherPropertyId, otherOrg, "[]", "[]", "[]", "[]"],
  );

  const mediaDir = path.join(process.cwd(), "public", "media");
  if (!fs.existsSync(mediaDir)) {
    console.warn("· aviso: /public/media ausente — as fotografias de demonstração não serão servidas.");
  }

  console.log("✓ seed concluído");
  console.log("  Conta demo  : helena@estateos.demo / EstateDemo2026!");
  console.log("  Consultor   : tomas@estateos.demo / EstateDemo2026!");
  console.log("  Outra org   : rui@heritage.demo / EstateDemo2026!");
  console.log(`  Página pública: /p/${slug}`);
}

seed();
