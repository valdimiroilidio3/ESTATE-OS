/**
 * Deterministic production engine.
 *
 * Every sentence is assembled from structured property data. Gaps are reported
 * explicitly instead of being filled with assumptions. The engine runs when no
 * external model is configured and doubles as the fallback when a provider call
 * fails, so the pipeline never depends on network availability.
 */
import type { KnowledgeBase } from "./knowledge";
import type { PropertyMedia } from "@/lib/types";

export interface GeneratedPiece {
  kind: "listing" | "audience" | "campaign" | "media_brief";
  locale: string;
  variant: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
}

export type VerificationIssue = {
  field: string;
  label: string;
  level: "error" | "warning" | "info";
  message: string;
  source: string;
};

export type MediaSuggestion = {
  media_id: string;
  file_name: string;
  suggested_room: string | null;
  suggested_caption: string | null;
  confidence: "confirmada pelo texto" | "sugestão automática" | "sem sinal";
  status: "pending";
  note: string;
};

export interface VerificationReport {
  issues: VerificationIssue[];
  missing: string[];
  mediaSuggestions: MediaSuggestion[];
}

const TYPE_PT: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  townhouse: "Moradia em banda",
  villa: "Villa",
  estate: "Quinta",
  land: "Terreno",
  commercial: "Imóvel comercial",
  other: "Imóvel",
};

const TYPE_EN: Record<string, string> = {
  apartment: "Apartment",
  house: "House",
  townhouse: "Townhouse",
  villa: "Villa",
  estate: "Estate",
  land: "Plot of land",
  commercial: "Commercial property",
  other: "Property",
};

const CONDITION_EN: Record<string, string> = {
  novo: "new condition",
  "como novo": "like-new condition",
  renovado: "recently renovated",
  bom: "good condition",
  "a recuperar": "in need of restoration",
  "para obras": "requiring works",
};

export function money(cents: number | null, currency = "EUR"): string {
  if (cents === null || cents <= 0) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents);
}

export function joinList(items: string[], locale: "pt" | "en"): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} ${locale === "pt" ? "e" : "and"} ${clean[clean.length - 1]}`;
}

/** Normalised, read-only view over the knowledge base. */
export function facts(kb: KnowledgeBase) {
  const p = kb.property;
  const s = p.specs;
  const price = p.price_cents && p.price_cents > 0 ? p.price_cents / 100 : null;
  const conditionLabel = s?.condition ?? null;
  return {
    title: p.title,
    reference: p.reference,
    property_type: p.property_type,
    type_pt: TYPE_PT[p.property_type] ?? "Imóvel",
    type_en: TYPE_EN[p.property_type] ?? "Property",
    operation: p.operation,
    operation_pt: p.operation === "rent" ? "arrendamento" : "venda",
    operation_en: p.operation === "rent" ? "rent" : "sale",
    rent_period: "month" as const,
    price,
    currency: p.currency || "EUR",
    country: p.country,
    city: p.city,
    location: p.location,
    address_public: p.address_private ? null : p.address_line,
    usable_area_m2: s?.usable_area_m2 ?? null,
    plot_area_m2: s?.plot_area_m2 ?? null,
    bedrooms: s?.bedrooms ?? null,
    bathrooms: s?.bathrooms ?? null,
    parking: s?.parking ?? null,
    typology: s?.typology ?? null,
    condition: conditionLabel,
    condition_en: conditionLabel ? CONDITION_EN[conditionLabel.toLowerCase()] ?? null : null,
    year_built: s?.year_built ?? null,
    energy_rating: s?.energy_rating ?? null,
    amenities: kb.amenities,
    features: kb.features,
    views: s?.views ?? [],
    description: kb.approvedListing?.body ?? null,
    approvedPhotos: kb.approvedPhotos,
  };
}

type Facts = ReturnType<typeof facts>;

function detailLines(f: Facts, locale: "pt" | "en"): string[] {
  const lines: string[] = [];
  const add = (value: string | null) => {
    if (value && !lines.includes(value)) lines.push(value);
  };
  add(f.typology);
  if (f.bedrooms !== null) add(locale === "pt" ? `${f.bedrooms} quartos` : `${f.bedrooms} bedrooms`);
  if (f.bathrooms !== null) add(locale === "pt" ? `${f.bathrooms} casas de banho` : `${f.bathrooms} bathrooms`);
  if (f.usable_area_m2 !== null) add(locale === "pt" ? `${f.usable_area_m2} m² de área útil` : `${f.usable_area_m2} m² of living area`);
  if (f.plot_area_m2 !== null) add(locale === "pt" ? `${f.plot_area_m2} m² de terreno` : `${f.plot_area_m2} m² plot`);
  if (f.parking !== null)
    add(locale === "pt" ? `estacionamento para ${f.parking} ${f.parking === 1 ? "viatura" : "viaturas"}` : `parking spaces: ${f.parking}`);
  if (f.year_built !== null) add(locale === "pt" ? `construído em ${f.year_built}` : `built in ${f.year_built}`);
  if (f.energy_rating) add(locale === "pt" ? `certificado energético ${f.energy_rating}` : `energy rating ${f.energy_rating}`);
  if (f.condition) add(locale === "pt" ? f.condition.toLowerCase() : f.condition_en ?? f.condition);
  f.amenities.forEach((item) => add(item));
  f.features.forEach((item) => add(item));
  f.views.forEach((item) => add(locale === "pt" ? `vista de ${item.toLowerCase()}` : `${item.toLowerCase()} view`));
  return lines;
}

export function missingFacts(f: Facts): string[] {
  const missing: string[] = [];
  if (!f.city) missing.push("Cidade");
  if (f.price === null) missing.push("Preço");
  if (f.usable_area_m2 === null && f.plot_area_m2 === null) missing.push("Área útil ou de terreno");
  if (f.bedrooms === null) missing.push("Número de quartos");
  if (!f.condition) missing.push("Estado de conservação");
  if (!f.energy_rating && f.property_type !== "land") missing.push("Certificado energético");
  if (!f.description) missing.push("Descrição aprovada");
  if (!f.approvedPhotos) missing.push("Fotografia aprovada");
  return missing;
}

function priceLine(f: Facts, locale: "pt" | "en"): string | null {
  if (f.price === null) return null;
  const compact = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: f.currency,
    maximumFractionDigits: 0,
  }).format(f.price);
  if (locale === "pt") {
    return f.operation === "rent"
      ? `Disponível para arrendamento por ${compact} por mês.`
      : `Disponível para venda por ${compact}.`;
  }
  return f.operation === "rent"
    ? `Available for rent at ${compact} per month.`
    : `Available for sale at ${compact}.`;
}

function place(f: Facts): string {
  return [f.location, f.city].filter(Boolean).join(", ");
}

/* ─────────────── A. Listing writer ─────────────── */

export function generateListing(kb: KnowledgeBase, locale: "pt" | "en" = "pt"): GeneratedPiece {
  const f = facts(kb);
  const pt = locale === "pt";
  const type = pt ? f.type_pt : f.type_en;
  const where = place(f);
  const plotClause = f.plot_area_m2 !== null ? (pt ? `, inserida num terreno de ${f.plot_area_m2} m²` : `, on a ${f.plot_area_m2} m² plot`) : "";
  const qualifiers = pt
    ? [f.usable_area_m2 !== null ? `com ${f.usable_area_m2} m² de área útil` : null, f.bedrooms !== null ? `${f.bedrooms} quartos` : null].filter((item): item is string => Boolean(item))
    : [f.usable_area_m2 !== null ? `with ${f.usable_area_m2} m² of living area` : null, f.bedrooms !== null ? `${f.bedrooms} bedrooms` : null].filter((item): item is string => Boolean(item));
  const intro = pt
    ? `${type} para ${f.operation_pt}${where ? ` em ${where}` : ""}${qualifiers.length ? `, ${joinList(qualifiers, "pt")}` : ""}${plotClause}.`
    : `${type} for ${f.operation_en}${where ? ` in ${where}` : ""}${qualifiers.length ? `, ${joinList(qualifiers, "en")}` : ""}${plotClause}.`;

  const paragraphs: string[] = [intro];
  if (f.description) paragraphs.push(f.description.trim());

  const inIntro = (line: string) =>
    (f.usable_area_m2 !== null && line.startsWith(`${f.usable_area_m2} m²`)) ||
    (f.plot_area_m2 !== null && line.startsWith(`${f.plot_area_m2} m²`)) ||
    (f.bedrooms !== null && line.startsWith(`${f.bedrooms} quartos`)) ||
    (f.bedrooms !== null && line.startsWith(`${f.bedrooms} bedrooms`)) ||
    line === f.typology;
  const details = detailLines(f, locale).filter((line) => !inIntro(line));
  if (details.length) {
    paragraphs.push(
      pt
        ? `Os elementos confirmados do imóvel incluem ${joinList(details, "pt")}.`
        : `Confirmed property details include ${joinList(details, "en")}.`,
    );
  }

  const commercial = priceLine(f, locale);
  if (commercial) paragraphs.push(commercial);

  const gaps = missingFacts(f);
  if (gaps.length) {
    paragraphs.push(
      pt
        ? `Informação ainda não confirmada: ${joinList(gaps.map((gap) => gap.toLowerCase()), "pt")}. Estes dados não são inferidos nem apresentados como definitivos.`
        : `Not yet confirmed: ${joinList(gaps.map((gap) => gap.toLowerCase()), "en")}. These details are not inferred or presented as final.`,
    );
  }

  const headline = pt
    ? `${type}${f.bedrooms !== null ? ` T${f.bedrooms}` : ""}${f.city ? ` em ${f.city}` : ""}`
    : `${type}${f.bedrooms !== null ? ` · ${f.bedrooms} bed` : ""}${f.city ? ` in ${f.city}` : ""}`;

  const summary = pt
    ? `${type}${where ? ` em ${where}` : ""}${f.usable_area_m2 !== null ? `, ${f.usable_area_m2} m²` : ""}${f.price !== null ? `, ${money(kb.property.price_cents, f.currency)}` : ""}.`
    : `${type}${where ? ` in ${where}` : ""}${f.usable_area_m2 !== null ? `, ${f.usable_area_m2} m²` : ""}${f.price !== null ? `, ${money(kb.property.price_cents, f.currency)}` : ""}.`;

  return {
    kind: "listing",
    locale,
    variant: "default",
    title: headline,
    body: paragraphs.join("\n\n"),
    payload: {
      summary,
      features: detailLines(f, locale),
      metaTitle: `${f.title}${f.city ? ` · ${f.city}` : ""}`.slice(0, 62),
      metaDescription: `${summary} ${
        pt ? "Ficha completa, fotografias e pedido de visita." : "Full details, photography and viewing request."
      }`.slice(0, 158),
      ctas: pt ? ["Solicitar visita", "Pedir informações", "Partilhar imóvel"] : ["Request a viewing", "Ask for details", "Share property"],
      sources: kb.facts.map((fact) => `${fact.label}: ${fact.value} — ${fact.source}`),
      unconfirmed: gaps,
      language: locale,
      engine: "local-rules",
    },
  };
}

/* ─────────────── B. Audience adaptation ─────────────── */

export function generateAudienceVersions(kb: KnowledgeBase): GeneratedPiece[] {
  const basePt = generateListing(kb, "pt");
  const baseEn = generateListing(kb, "en");
  const f = facts(kb);

  const framing: Record<string, { locale: "pt" | "en"; label: string; note: string }> = {
    national: {
      locale: "pt",
      label: "Comprador nacional",
      note: "Leitura direta do imóvel e do seu enquadramento local. Todos os elementos indicados são os confirmados na ficha.",
    },
    international: {
      locale: "en",
      label: "International buyer",
      note: "All figures are stated in euros. Further documentation and answers to specific questions can be requested through the viewing form; the consultant confirms availability.",
    },
    families: {
      locale: "pt",
      label: "Procura familiar",
      note: "Elementos objetivos para comparar espaço e funcionalidade. Não são feitas suposições sobre o perfil de quem compra.",
    },
    investors: {
      locale: "pt",
      label: "Investidor",
      note: "Não são apresentadas projeções de rentabilidade, yields ou valorização: não existem dados confirmados que as sustentem. A análise financeira deve ser feita com o consultor.",
    },
  };

  return Object.entries(framing).map(([variant, config]) => {
    const base = config.locale === "pt" ? basePt : baseEn;
    const summaryPrefix = config.locale === "pt" ? base.payload.summary as string : base.payload.summary as string;
    return {
      kind: "audience" as const,
      locale: config.locale,
      variant,
      title: `${base.title} · ${config.label}`,
      body: `${base.body}\n\n${config.note}`,
      payload: {
        ...base.payload,
        summary: summaryPrefix,
        audience: variant,
        audience_label: config.label,
        adaptation_note: config.note,
        facts_used: detailLines(f, config.locale),
      },
    };
  });
}

/* ─────────────── C. Campaign generator ─────────────── */

export function generateCampaign(kb: KnowledgeBase, locale: "pt" | "en" = "pt"): GeneratedPiece {
  const f = facts(kb);
  const base = generateListing(kb, locale);
  const pt = locale === "pt";
  const details = detailLines(f, locale);
  const where = place(f);
  const agency = kb.property.reference ? "a agência" : "a agência";
  const price = f.price !== null ? money(kb.property.price_cents, f.currency) : null;
  const short = (base.payload.summary as string) ?? "";

  const social = pt
    ? `${f.title}\n\n${short}\n${details.length ? `${joinList(details.slice(0, 6), "pt")}.\n` : ""}${price ? `Valor: ${price}.\n` : ""}\nFicha completa e pedido de visita na página do imóvel partilhada por ${agency}.`
    : `${f.title}\n\n${short}\n${details.length ? `${joinList(details.slice(0, 6), "en")}.\n` : ""}${price ? `Price: ${price}.\n` : ""}\nFull details and viewings on the property page shared by ${agency}.`;

  const instagram = pt
    ? `${f.title} · ${where}\n\n${details.slice(0, 7).join(" · ")}${price ? `\nPreço: ${price}` : ""}\n\nDados confirmados pelo consultor. Peça a ficha completa ou marque visita no link da bio.`
    : `${f.title} · ${where}\n\n${details.slice(0, 7).join(" · ")}${price ? `\nPrice: ${price}` : ""}\n\nConfirmed details. Request the full file or book a viewing via link in bio.`;

  const ads = pt
    ? [
        `Título: ${f.title}${where ? ` — ${where}` : ""}`,
        `Descrição: ${short}${price ? ` ${price}.` : ""}`,
        "CTA: Solicitar visita",
        `Segmentação: ${[f.property_type, f.city, f.typology].filter(Boolean).join(" · ") || "por definir"}`,
        "Nota: sem alegações de resultados; criativos sujeitos a revisão humana.",
      ].join("\n")
    : [
        `Headline: ${f.title}${where ? ` — ${where}` : ""}`,
        `Description: ${short}${price ? ` ${price}.` : ""}`,
        "CTA: Request a viewing",
      ].join("\n");

  const emailSubject = pt ? `${f.title}${f.city ? ` em ${f.city}` : ""} — ficha e disponibilidade` : `${f.title}${f.city ? ` in ${f.city}` : ""} — details and availability`;
  const emailBody = pt
    ? `Bom dia,\n\nPartilhamos a ficha de ${f.title}${where ? `, em ${where}` : ""}.\n\n${base.body}\n\nSe quiser agendar uma visita, responda a este email ou utilize o formulário da página do imóvel.\n\nCom os melhores cumprimentos`
    : `Hello,\n\nSharing the file for ${f.title}${where ? `, ${where}` : ""}.\n\n${base.body}\n\nTo arrange a viewing, reply to this email or use the form on the property page.\n\nKind regards`;

  const whatsapp = pt
    ? `Olá! Partilho ${f.title}${f.city ? ` (${f.city})` : ""}. ${f.usable_area_m2 !== null ? `${f.usable_area_m2} m². ` : ""}${
        f.bedrooms !== null ? `${f.bedrooms} quartos. ` : ""
      }${price ? `${price}. ` : ""}Quer que envie a ficha completa ou marque visita?`
    : `Hi! Sharing ${f.title}${f.city ? ` (${f.city})` : ""}. ${f.usable_area_m2 !== null ? `${f.usable_area_m2} m². ` : ""}${
        price ? `${price}. ` : ""
      }Would you like the full file or to arrange a viewing?`;

  const argumentList = pt
    ? [
        f.usable_area_m2 !== null ? `Área útil confirmada de ${f.usable_area_m2} m².` : null,
        f.plot_area_m2 !== null ? `Terreno de ${f.plot_area_m2} m².` : null,
        f.bedrooms !== null ? `${f.bedrooms} quartos${f.bathrooms !== null ? ` e ${f.bathrooms} casas de banho` : ""}.` : null,
        f.energy_rating ? `Certificado energético ${f.energy_rating}.` : null,
        f.parking !== null ? `Estacionamento para ${f.parking}.` : null,
        f.amenities.length ? `Comodidades: ${joinList(f.amenities, "pt")}.` : null,
        f.views.length ? `Vistas confirmadas: ${joinList(f.views, "pt")}.` : null,
      ].filter(Boolean)
    : [
        f.usable_area_m2 !== null ? `Confirmed living area of ${f.usable_area_m2} m².` : null,
        f.plot_area_m2 !== null ? `${f.plot_area_m2} m² plot.` : null,
        f.bedrooms !== null ? `${f.bedrooms} bedrooms.` : null,
        f.energy_rating ? `Energy rating ${f.energy_rating}.` : null,
      ].filter(Boolean);

  const videoScript = pt
    ? [
        "00:00 — Plano de abertura: fachada ou enquadramento do imóvel (sem simulação de vistas).",
        `00:04 — Plano geral: ${f.title}${where ? `, ${where}` : ""}.`,
        "00:08 — Sequência de interiores pela ordem das fotografias aprovadas.",
        "00:20 — Detalhes de materiais e acabamentos apenas onde estão documentados.",
        "00:28 — Plano final com contacto da agência e convite ao pedido de visita.",
        "",
        "Nota: guião de planos a captar. Não representa um vídeo gerado.",
      ].join("\n")
    : [
        "00:00 — Opening shot: façade or property context (no simulated views).",
        `00:04 — Establishing shot: ${f.title}${where ? `, ${where}` : ""}.`,
        "00:08 — Interior sequence following approved photography.",
        "00:28 — Closing frame with agency contact and viewing CTA.",
        "",
        "Note: shot brief, not a generated video.",
      ].join("\n");

  return {
    kind: "campaign",
    locale,
    variant: "default",
    title: pt ? `Campanha · ${f.title}` : `Campaign · ${f.title}`,
    body: social,
    payload: {
      social,
      instagram,
      ads,
      email: { subject: emailSubject, body: emailBody },
      whatsapp,
      arguments: argumentList,
      faq: buildFaq(kb),
      video_script: videoScript,
      hashtags: [pt ? "#imobiliario" : "#realestate", "#portugal", f.city ? `#${f.city.replace(/\s+/g, "")}` : null].filter(Boolean),
      note: pt
        ? "Conteúdo gerado a partir de dados confirmados. Não contém testemunhos, números de resultados ou promessas de rentabilidade."
        : "Generated from confirmed data. No testimonials, performance figures or yield promises.",
      engine: "local-rules",
    },
  };
}

/* ─────────────── D. Cinematic media brief ─────────────── */

export function generateMediaBrief(kb: KnowledgeBase, locale: "pt" | "en" = "pt", media: PropertyMedia[] = []): GeneratedPiece {
  const f = facts(kb);
  const pt = locale === "pt";
  const approved = media.filter((item) => item.status === "approved");
  const sequence = (approved.length ? approved : media).filter((item) => item.kind === "photo" || item.kind === "video").slice(0, 8);
  const shots = sequence.map((item, index) => ({
    order: index + 1,
    subject: item.room ?? item.caption ?? item.file_name,
    direction: pt ? "Travelling lento, câmara estabilizada, sem cortes bruscos." : "Slow dolly, stabilised camera, no abrupt cuts.",
    duration_s: index === 0 ? 5 : 4,
    file: item.file_name,
  }));

  const body = pt
    ? [
        `Brief cinematográfico · ${f.title}`,
        "",
        "Objetivo: apresentar o imóvel com rigor documental, sem alterar a perceção do espaço.",
        "Duração alvo: 30–40 segundos. Formatos: 16:9 e 9:16. Som: ambiente natural; música apenas com licença confirmada.",
        "",
        "Sequência de planos:",
        ...shots.map((shot) => `${String(shot.order).padStart(2, "0")}. ${shot.subject} — ${shot.direction} (${shot.duration_s}s)`),
        "",
        "Regras: não simular vistas, áreas ou materiais; não gerar interiores inexistentes; qualquer imagem de arquivo tem de ser identificada.",
        "Este documento é um guião de produção. Não é um vídeo gerado.",
      ].join("\n")
    : [
        `Cinematic brief · ${f.title}`,
        "",
        "Goal: present the property with documentary accuracy, without altering the perception of the space.",
        "Target duration: 30–40 seconds. Formats 16:9 and 9:16. Sound: natural ambience, licensed music only.",
        "",
        "Shot sequence:",
        ...shots.map((shot) => `${String(shot.order).padStart(2, "0")}. ${shot.subject} — ${shot.direction} (${shot.duration_s}s)`),
        "",
        "Rules: never simulate views, areas or materials; never generate interiors that do not exist; label archive footage.",
        "This document is a production brief. It is not a generated video.",
      ].join("\n");

  return {
    kind: "media_brief",
    locale,
    variant: "default",
    title: pt ? `Brief de vídeo · ${f.title}` : `Video brief · ${f.title}`,
    body,
    payload: {
      shots,
      duration_target: "30-40s",
      formats: ["16:9", "9:16"],
      deliverables: pt
        ? ["Guião de planos", "Lista de material a captar", "Checklist de luz e som", "Notas de montagem"]
        : ["Shot script", "Capture checklist", "Light and sound notes", "Edit notes"],
      production_notes: pt
        ? "Nenhum plano pode ser gerado por IA para simular o imóvel. Imagens ilustrativas têm de ser identificadas como tal."
        : "No AI-generated shot may simulate the property. Illustrative imagery must be labelled.",
      is_generated_video: false,
      video_provider_configured: false,
    },
  };
}

/* ─────────────── Grounded FAQ ─────────────── */

export function buildFaq(kb: KnowledgeBase): { q: string; a: string; known: boolean }[] {
  const f = facts(kb);
  const items: { q: string; a: string; known: boolean }[] = [];
  const push = (q: string, a: string | null) => {
    items.push({
      q,
      a: a ?? "Informação não disponível na ficha aprovada. O consultor confirma este ponto.",
      known: Boolean(a),
    });
  };

  push(
    "Qual é a área do imóvel?",
    f.usable_area_m2 !== null
      ? `${f.usable_area_m2} m² de área útil${f.plot_area_m2 !== null ? ` e ${f.plot_area_m2} m² de terreno` : ""}.`
      : f.plot_area_m2 !== null
        ? `Terreno de ${f.plot_area_m2} m². A área útil ainda não está confirmada.`
        : null,
  );
  push(
    "Quantos quartos tem?",
    f.bedrooms !== null ? `${f.bedrooms} quartos${f.bathrooms !== null ? ` e ${f.bathrooms} casas de banho` : ""}.` : null,
  );
  push(
    "Qual é o preço?",
    f.price !== null ? `${money(kb.property.price_cents, f.currency)}${f.operation === "rent" ? " por mês" : ""}.` : null,
  );
  push("Qual é o estado de conservação?", f.condition ? `${f.condition}.` : null);
  push(
    "O imóvel tem certificado energético?",
    f.energy_rating ? `Certificado energético ${f.energy_rating}.` : null,
  );
  push(
    "Onde fica exatamente?",
    f.address_public
      ? `${f.address_public}.`
      : `Localização indicada: ${place(f) || "não confirmada"}. A morada exata é partilhada pelo consultor.${
          kb.property.address_private ? " A morada completa não é publicada por opção de privacidade." : ""
        }`,
  );

  return items;
}

/* ─────────────── Assisted verification ─────────────── */

const ROOM_HINTS: { room: string; words: string[] }[] = [
  { room: "Sala", words: ["sala", "living", "lounge"] },
  { room: "Cozinha", words: ["cozinha", "kitchen"] },
  { room: "Quarto", words: ["quarto", "bedroom", "suite", "suíte"] },
  { room: "Casa de banho", words: ["banho", "bath", "wc"] },
  { room: "Exterior", words: ["exterior", "fachada", "facade", "outside"] },
  { room: "Piscina", words: ["piscina", "pool"] },
  { room: "Jardim", words: ["jardim", "garden", "terrace", "terraço", "terraco"] },
  { room: "Vista", words: ["vista", "view"] },
  { room: "Hall", words: ["hall", "entrada", "corridor"] },
  { room: "Escritório", words: ["escritório", "escritorio", "office", "study"] },
];

export function suggestMedia(media: PropertyMedia[]): MediaSuggestion[] {
  return media
    .filter((item) => item.kind === "photo")
    .map((item) => {
      const captionText = (item.caption ?? "").toLowerCase();
      const fileNameText = item.file_name.toLowerCase();
      const captionHit = ROOM_HINTS.find((hint) => hint.words.some((word) => captionText.includes(word)));
      const fileHit = ROOM_HINTS.find((hint) => hint.words.some((word) => fileNameText.includes(word)));
      const best = captionHit ?? fileHit;
      return {
        media_id: item.id,
        file_name: item.file_name,
        suggested_room: best?.room ?? null,
        suggested_caption: item.caption ?? null,
        confidence: captionHit ? "confirmada pelo texto" : fileHit ? "sugestão automática" : "sem sinal",
        status: "pending" as const,
        note: "Sugestão a partir do nome do ficheiro e da legenda. Não interpreta o conteúdo da imagem nem infere vistas, materiais ou áreas.",
      };
    });
}

export function validateProperty(kb: KnowledgeBase, media: PropertyMedia[]): VerificationReport {
  const f = facts(kb);
  const issues: VerificationIssue[] = [];
  const add = (issue: VerificationIssue) => issues.push(issue);
  const year = new Date().getFullYear();

  if (!f.title || f.title.trim().length < 5)
    add({ field: "title", label: "Título", level: "error", message: "O título deve ter pelo menos 5 caracteres.", source: "Validação de campos" });
  if (!f.city)
    add({ field: "city", label: "Cidade", level: "error", message: "Indique a cidade ou concelho.", source: "Validação de campos" });
  if (f.price === null)
    add({ field: "price", label: "Preço", level: "error", message: "Sem preço não é possível publicar uma experiência completa.", source: "Validação de campos" });
  else if (f.price <= 0)
    add({ field: "price", label: "Preço", level: "error", message: "O preço deve ser superior a zero.", source: "Validação de campos" });
  else if (f.operation === "rent" && f.price > 100_000)
    add({
      field: "price",
      label: "Preço",
      level: "warning",
      message: "Valor mensal invulgarmente alto. Confirme a unidade (mensal ou anual).",
      source: "Verificação de coerência",
    });
  else if (f.operation === "sale" && f.price < 10_000)
    add({ field: "price", label: "Preço", level: "warning", message: "Valor de venda invulgarmente baixo. Confirme o valor introduzido.", source: "Verificação de coerência" });
  if (f.usable_area_m2 !== null && f.usable_area_m2 > 5000)
    add({ field: "usable_area_m2", label: "Área útil", level: "warning", message: "Área útil pouco comum. Confirme a unidade (m²).", source: "Verificação de coerência" });
  if (f.usable_area_m2 !== null && f.plot_area_m2 !== null && f.usable_area_m2 > f.plot_area_m2)
    add({
      field: "usable_area_m2",
      label: "Área",
      level: "error",
      message: "A área útil é superior à área do terreno. Reveja os valores.",
      source: "Verificação de coerência",
    });
  if (f.bedrooms === 0 && f.property_type !== "land" && f.property_type !== "commercial")
    add({ field: "bedrooms", label: "Quartos", level: "warning", message: "Imóvel residencial com zero quartos. Confirme o valor.", source: "Verificação de coerência" });
  if (f.year_built !== null && f.year_built > year)
    add({ field: "year_built", label: "Ano de construção", level: "error", message: "O ano de construção está no futuro.", source: "Verificação de coerência" });
  if (f.year_built !== null && f.year_built < 1800)
    add({ field: "year_built", label: "Ano de construção", level: "warning", message: "Ano anterior a 1800 — confirme o valor.", source: "Verificação de coerência" });
  if (!f.condition && f.property_type !== "land")
    add({ field: "condition", label: "Estado", level: "warning", message: "Estado de conservação em falta. Não é deduzido a partir de fotografias.", source: "Validação de campos" });
  if (!f.energy_rating && f.property_type !== "land")
    add({
      field: "energy_rating",
      label: "Certificado energético",
      level: "warning",
      message: "Certificado em falta — obrigatório para comercialização em Portugal. A confirmar antes de publicar.",
      source: "Validação de campos",
    });
  if (!media.length)
    add({ field: "media", label: "Media", level: "warning", message: "Sem fotografias carregadas. A galeria pública ficará vazia.", source: "Validação de campos" });
  else if (!media.some((item) => item.status === "approved"))
    add({ field: "media", label: "Media", level: "warning", message: "Nenhuma fotografia aprovada. Só ficheiros aprovados são publicados.", source: "Validação de campos" });
  if (media.length && !media.some((item) => item.status === "approved" && item.is_public))
    add({ field: "media", label: "Media pública", level: "info", message: "Nenhuma fotografia marcada como pública para a página.", source: "Validação de campos" });
  if (media.some((item) => !item.room && item.kind === "photo"))
    add({
      field: "media",
      label: "Divisões das fotografias",
      level: "info",
      message: "Existem fotografias sem divisão identificada. As sugestões automáticas ficam pendentes até confirmação.",
      source: "Análise assistida de media",
    });
  if (!f.description)
    add({ field: "description", label: "Descrição", level: "info", message: "Sem descrição aprovada — a geração usa apenas características estruturadas.", source: "Validação de campos" });

  const missing = missingFacts(f);
  return { issues, missing, mediaSuggestions: suggestMedia(media) };
}

/** Alias used by the job pipeline. */
export function mediaRoomSuggestions(media: PropertyMedia[]): MediaSuggestion[] {
  return suggestMedia(media);
}
