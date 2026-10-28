/**
 * Grounded property assistant.
 *
 * Retrieval is a scored keyword match over the confirmed fact set (a few dozen
 * facts per property — a vector store would be unjustified at this volume).
 * The answer is composed only from retrieved facts. If nothing is retrieved the
 * assistant states that the information is not available.
 */
import { buildKnowledge, type KnowledgeBase } from "./knowledge";
import { money } from "./knowledge";
import { getExperience } from "../data/experiences";
import { one, type Row } from "../db";

export interface Citation {
  label: string;
  value: string;
  source: string;
}

export interface AssistantAnswer {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  intent: string;
  cta: "visit" | "contact" | null;
}

const SYNONYMS: Record<string, string[]> = {
  area: ["area", "metros", "m2", "tamanho", "size", "surface", "util", "bruta"],
  bedrooms: ["quarto", "quartos", "bedroom", "bedrooms", "dormitorio", "suites", "suite"],
  bathrooms: ["banho", "banheira", "bathroom", "bathrooms", "wc", "casas"],
  price: ["preco", "price", "custo", "cost", "valor", "quanto", "how much", "euros"],
  location: ["onde", "localiza", "localizacao", "location", "where", "zona", "cidade", "city", "morada"],
  parking: ["estacionamento", "garagem", "parking", "carro", "garage"],
  energy: ["energetic", "energetica", "energy", "certificado", "rating"],
  year_built: ["ano", "year", "construcao", "built", "construido"],
  condition: ["estado", "condition", "conservacao", "renovado"],
  amenities: ["comodidades", "amenities", "caracteristicas", "features", "piscina", "pool", "jardim", "garden", "vista", "view"],
  plot: ["terreno", "plot", "land", "lote"],
  visit: ["visita", "visitar", "viewing", "visit", "agendar", "marcar", "schedule", "appointment"],
  contact: ["contacto", "contact", "consultor", "agent", "telefone", "phone", "email", "falar", "speak"],
  legal: ["juridic", "legal", "contrato", "contract", "licenca", "licenca", "certidao", "escritura", "deed"],
  financial: ["financiamento", "financing", "credito", "mortgage", "banco", "bank", "rentabilidade", "yield", "imposto", "tax"],
  technical: ["estrutura", "structural", "tecnico", "technical", "obra", "renovation", "avaliacao", "survey"],
};

/**
 * Topics that visitors often ask about but that are NOT part of the property
 * fact base. When one of these is detected we say so explicitly instead of
 * stitching together a nearby fact and implying it answers the question.
 */
const UNSUPPORTED_ASPECTS: { key: string; label_pt: string; label_en: string; words: string[] }[] = [
  {
    key: "architect",
    label_pt: "autoria do projeto (arquiteto)",
    label_en: "project authorship (architect)",
    words: ["arquiteto", "architect", "autoria", "ateliê", "atelier"],
  },
  {
    key: "consumption",
    label_pt: "consumo energético em kWh",
    label_en: "energy consumption in kWh",
    words: ["kwh", "consumo anual", "consumo energetico", "annual consumption", "consumo de energia"],
  },
  {
    key: "condo",
    label_pt: "valor do condomínio",
    label_en: "condominium fee",
    words: ["condominio", "condo fee", "quota mensal", "taxa de condominio"],
  },
  {
    key: "furniture",
    label_pt: "mobiliário incluído",
    label_en: "furniture included",
    words: ["mobilia", "mobiliado", "furniture", "furnished"],
  },
  {
    key: "orientation",
    label_pt: "orientação solar",
    label_en: "solar orientation",
    words: ["orientacao solar", "exposicao solar", "sun exposure", "virado a sul", "south-facing"],
  },
  {
    key: "distances",
    label_pt: "distâncias a serviços e escolas",
    label_en: "distances to services and schools",
    words: ["distancia", "distance", "escola", "school", "metro", "supermercado", "supermarket"],
  },
  {
    key: "floor",
    label_pt: "piso ou andar",
    label_en: "floor level",
    words: ["piso", "andar", "floor level", "which floor"],
  },
  {
    key: "noise",
    label_pt: "ruído ou ambiente sonoro",
    label_en: "noise levels",
    words: ["ruido", "noise", "sossegado", "quiet"],
  },
];

function unsupportedAspects(kb: KnowledgeBase, question: string) {
  const q = normalize(question);
  return UNSUPPORTED_ASPECTS.filter((aspect) => {
    const mentioned = aspect.words.some((word) => q.includes(normalize(word)));
    if (!mentioned) return false;
    // If the fact base explicitly covers the topic, it is not unsupported.
    return !kb.facts.some((fact) => normalize(fact.label).includes(normalize(aspect.label_pt.split(" ")[0])));
  });
}

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function scoreFact(question: string, fact: { key: string; label: string; value: string }) {
  const q = normalize(question);
  const tokens = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const haystack = normalize(`${fact.label} ${fact.value} ${fact.key}`);
  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) score += 2;
  });
  for (const [key, words] of Object.entries(SYNONYMS)) {
    if (!words.some((w) => q.includes(normalize(w)))) continue;
    if (fact.key === key) score += 6;
    if (key === "amenities" && (fact.key === "amenity" || fact.key === "feature" || fact.key === "view")) score += 4;
    if (key === "bedrooms" && fact.key === "bedrooms") score += 4;
  }
  return score;
}

export function retrieve(kb: KnowledgeBase, question: string, limit = 6) {
  return kb.facts
    .map((fact) => ({ fact, score: scoreFact(question, fact) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.fact);
}

function consultantContact(orgId: string, propertyId: string) {
  const experience = getExperience(orgId, propertyId);
  const contact = experience?.config.contact;
  if (contact && (contact.name || contact.email || contact.phone)) return contact;
  const branding = one<Row>(`SELECT branding FROM organizations WHERE id = ?`, [orgId])?.branding;
  try {
    const parsed = JSON.parse(branding ?? "{}");
    if (parsed.email || parsed.phone) return { name: parsed.agencyName ?? "", email: parsed.email ?? "", phone: parsed.phone ?? "", role: "Consultor" };
  } catch {
    /* ignore */
  }
  return null;
}

const UNKNOWN_PT =
  "Não tenho essa informação confirmada nos dados deste imóvel. Prefiro não avançar com uma suposição — posso encaminhar a sua questão para o consultor responsável.";
const UNKNOWN_EN =
  "I don't have that information confirmed in this property's records. Rather than guessing, I can pass your question to the responsible consultant.";

export function answerQuestion(
  orgId: string,
  propertyId: string,
  question: string,
  locale: "pt" | "en" = "pt",
): AssistantAnswer {
  const kb = buildKnowledge(orgId, propertyId);
  const q = normalize(question);
  const has = (words: string[]) => words.some((w) => q.includes(normalize(w)));

  if (has(SYNONYMS.legal)) {
    return {
      answer:
        locale === "pt"
          ? "Questões jurídicas — licenças, certidões ou condições contratuais — devem ser tratadas pelo consultor responsável ou pelo advogado da operação. Não presto parecer jurídico. Posso encaminhar o seu contacto."
          : "Legal matters — permits, title deeds or contractual conditions — must be handled by the responsible consultant or the transaction lawyer. I do not provide legal advice. I can forward your contact.",
      citations: [],
      grounded: false,
      intent: "legal_redirect",
      cta: "contact",
    };
  }
  if (has(SYNONYMS.financial)) {
    return {
      answer:
        locale === "pt"
          ? "Não disponho de dados de financiamento, impostos ou rentabilidade confirmados para este imóvel, e não apresento estimativas sem base factual. O consultor pode indicar os profissionais adequados."
          : "I have no confirmed financing, tax or yield data for this property, and I don't produce estimates without a factual basis. The consultant can refer you to the appropriate professionals.",
      citations: [],
      grounded: false,
      intent: "financial_redirect",
      cta: "contact",
    };
  }
  if (has(SYNONYMS.technical)) {
    return {
      answer:
        locale === "pt"
          ? "Avaliações estruturais e técnicas exigem verificação presencial por um profissional habilitado. Os dados que tenho são os registados pela agência e não substituem essa avaliação."
          : "Structural and technical assessments require an on-site review by a qualified professional. My data is what the agency has registered and does not replace that assessment.",
      citations: [],
      grounded: false,
      intent: "technical_redirect",
      cta: "contact",
    };
  }

  if (has(SYNONYMS.visit)) {
    const schedule = one<Row>(
      `SELECT count(*) AS c FROM visits v JOIN property_experiences e ON e.property_id = v.property_id
       WHERE v.property_id = ? AND v.status = 'confirmed' AND v.scheduled_at >= datetime('now')`,
      [propertyId],
    );
    return {
      answer:
        locale === "pt"
          ? `Pode solicitar uma visita através do formulário nesta página. A visita fica no estado "solicitada" até o consultor confirmar a disponibilidade — não confirmo horários automaticamente.${schedule?.c ? "" : " Neste momento não tenho horários confirmados registados para este imóvel."}`
          : `You can request a viewing using the form on this page. The visit stays in "requested" status until the consultant confirms availability — I don't confirm slots automatically.${schedule?.c ? "" : " There are currently no confirmed slots recorded for this property."}`,
      citations: [],
      grounded: true,
      intent: "visit",
      cta: "visit",
    };
  }

  if (has(SYNONYMS.contact)) {
    const contact = consultantContact(orgId, propertyId);
    if (contact) {
      const bits = [contact.name, contact.role, contact.email, contact.phone].filter(Boolean);
      return {
        answer:
          locale === "pt"
            ? `O contacto responsável por este imóvel é: ${bits.join(" · ")}. Pode também submeter o formulário nesta página.`
            : `The contact responsible for this property is: ${bits.join(" · ")}. You can also submit the form on this page.`,
        citations: [{ label: "Contacto do consultor", value: bits.join(" · "), source: "Configuração da experiência" }],
        grounded: true,
        intent: "contact",
        cta: "contact",
      };
    }
    return {
      answer: locale === "pt" ? UNKNOWN_PT : UNKNOWN_EN,
      citations: [],
      grounded: false,
      intent: "contact",
      cta: null,
    };
  }

  const aspects = unsupportedAspects(kb, question);
  const facts = retrieve(kb, question);
  if (!facts.length) {
    const specific = aspects.length
      ? locale === "pt"
        ? `Não tenho informação confirmada sobre ${aspects.map((a) => a.label_pt).join(", ")}. Posso encaminhar a sua questão para o consultor responsável, sem apresentar suposições.`
        : `I have no confirmed information about ${aspects.map((a) => a.label_en).join(", ")}. I can forward your question to the responsible consultant rather than guess.`
      : null;
    return {
      answer: specific ?? (locale === "pt" ? UNKNOWN_PT : UNKNOWN_EN),
      citations: [],
      grounded: false,
      intent: "unknown",
      cta: "contact",
    };
  }

  const citations: Citation[] = facts.map((f) => ({ label: f.label, value: f.value, source: f.source }));
  const lead =
    locale === "pt"
      ? facts.length === 1
        ? `${facts[0].label}: ${facts[0].value}.`
        : `Com base nos dados confirmados: ${facts.map((f) => `${f.label.toLowerCase()} — ${f.value}`).join("; ")}.`
      : facts.length === 1
        ? `${facts[0].label}: ${facts[0].value}.`
        : `Based on the confirmed records: ${facts.map((f) => `${f.label.toLowerCase()} — ${f.value}`).join("; ")}.`;

  const tail =
    locale === "pt"
      ? "Esta informação tem origem na ficha do imóvel. Para detalhes adicionais, fale com o consultor."
      : "This information comes from the property file. For further details, speak with the consultant.";

  const unknownTail = aspects.length
    ? locale === "pt"
      ? `Não tenho informação confirmada sobre ${aspects.map((a) => a.label_pt).join(", ")}. Posso encaminhar essa questão para o consultor.`
      : `I have no confirmed information about ${aspects.map((a) => a.label_en).join(", ")}. I can forward that question to the consultant.`
    : "";

  return {
    answer: [lead, tail, unknownTail || null].filter(Boolean).join(" "),
    citations,
    grounded: true,
    intent: aspects.length ? "facts_with_gaps" : "facts",
    cta: "contact",
  };
}

export function suggestedQuestions(propertyId: string, orgId: string, locale: "pt" | "en" = "pt") {
  const kb = buildKnowledge(orgId, propertyId);
  const has = (key: string) => Boolean(kb.byKey[key]);
  const base =
    locale === "pt"
      ? [
          has("area") ? "Qual é a área útil?" : null,
          has("bedrooms") ? "Quantos quartos existem?" : null,
          has("price") ? "Qual é o preço?" : null,
          has("location") ? "Onde fica o imóvel?" : null,
          "Que características estão confirmadas?",
          "Posso marcar uma visita?",
          "Como contacto o consultor?",
        ]
      : [
          has("area") ? "What is the usable area?" : null,
          has("bedrooms") ? "How many bedrooms are there?" : null,
          has("price") ? "What is the price?" : null,
          has("location") ? "Where is it located?" : null,
          "Which features are confirmed?",
          "Can I book a viewing?",
          "How do I contact the consultant?",
        ];
  return base.filter(Boolean).slice(0, 4) as string[];
}

export function priceText(cents: number | null, currency: string) {
  return money(cents, currency);
}
