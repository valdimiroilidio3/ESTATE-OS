import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => (v && v.length ? v : undefined));

const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

const requiredNumber = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor numérico inválido." });
      return z.NEVER;
    }
    return n;
  });

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Indique o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  password: z.string().min(8, "A palavra-passe deve ter pelo menos 8 caracteres.").max(200),
  orgName: z.string().trim().min(2, "Indique o nome da organização.").max(120),
  acceptTerms: z.literal(true, { error: "É necessário aceitar os termos." }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido."),
  password: z.string().min(1, "Indique a palavra-passe."),
});

export const propertySpecsSchema = z.object({
  usable_area_m2: optionalNumber,
  plot_area_m2: optionalNumber,
  bedrooms: optionalNumber,
  bathrooms: optionalNumber,
  parking: optionalNumber,
  typology: optionalString,
  condition: optionalString,
  year_built: optionalNumber,
  energy_rating: optionalString,
  amenities: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  features: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  views: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const propertyInputSchema = z.object({
  title: z.string().trim().min(3, "Título demasiado curto.").max(160),
  property_type: z.string().trim().min(2).max(60),
  operation: z.enum(["sale", "rent"]),
  price: requiredNumber.refine((n) => n >= 0, "Preço inválido."),
  currency: z.enum(["EUR", "USD", "GBP", "CHF", "BRL"]).default("EUR"),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  location: optionalString,
  address_line: optionalString,
  address_private: z.boolean().default(true),
  summary: optionalString,
  internal_notes: optionalString,
  specs: propertySpecsSchema,
  mediaIds: z.array(z.string().uuid()).max(60).default([]),
  tasks: z.array(z.string()).default(["generate_listing"]),
});

export const propertyUpdateSchema = propertyInputSchema.partial().extend({
  status: z.enum(["draft", "in_preparation", "ready", "published", "archived"]).optional(),
});

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length ? v : undefined)),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true, { error: "É necessário aceitar a política de privacidade." }),
  kind: z.enum(["contact", "visit"]).default("contact"),
  preferred_date: optionalString,
  preferred_time: optionalString,
  website: z.string().max(0).optional(), // honeypot: must stay empty
});

export const assistantMessageSchema = z.object({
  message: z.string().trim().min(2, "Escreva uma pergunta.").max(600),
  sessionKey: z.string().uuid().optional(),
});

export const leadUpdateSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "visit_scheduled", "offer", "won", "lost"]).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  next_action: z.string().max(300).nullable().optional(),
  next_action_at: z.string().max(40).nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export const leadNoteSchema = z.object({
  note: z.string().trim().min(1, "Escreva uma nota.").max(2000),
  type: z.enum(["note", "call", "email", "whatsapp", "meeting", "status_change"]).default("note"),
});

export const visitInputSchema = z.object({
  property_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  agent_id: z.string().uuid().nullable().optional(),
  scheduled_at: optionalString,
  timezone: z.string().max(60).default("Europe/Lisbon"),
  status: z.enum(["requested", "confirmed", "completed", "cancelled", "rescheduled"]).default("requested"),
  notes: optionalString,
  outcome: optionalString,
});

export const visitUpdateSchema = visitInputSchema.partial();

export const experienceConfigSchema = z.object({
  hero: z.object({
    headline: z.string().max(180).default(""),
    subheadline: z.string().max(400).default(""),
    showPrice: z.boolean().default(true),
    locationLabel: z.string().max(160).default(""),
    primaryCta: z.string().max(60).default("Solicitar visita"),
    secondaryCta: z.string().max(60).default("Falar com o consultor"),
  }),
  sections: z.array(z.object({ id: z.string().max(40), enabled: z.boolean() })).max(20),
  contact: z.object({
    name: z.string().max(120).default(""),
    email: z.string().max(160).default(""),
    phone: z.string().max(60).default(""),
    role: z.string().max(120).default("Consultor"),
  }),
  map: z.object({
    enabled: z.boolean().default(false),
    lat: z.number().nullable().default(null),
    lng: z.number().nullable().default(null),
    showExactAddress: z.boolean().default(false),
  }),
  gallery: z
    .object({
      mode: z.enum(["masonry", "grid", "carousel"]).default("masonry"),
      mediaIds: z.array(z.string().uuid()).max(80).default([]),
      showCaptions: z.boolean().default(true),
    })
    .optional(),
  theme: z.object({
    accent: z.string().max(20).default("#C6A77A"),
    tone: z.enum(["light", "dark"]).default("light"),
  }),
});

export const experienceInputSchema = z.object({
  property_id: z.string().uuid(),
  layout: z.enum(["architectural", "signature", "investment"]).default("architectural"),
  config: experienceConfigSchema,
});

export const experienceUpdateSchema = z.object({
  layout: z.enum(["architectural", "signature", "investment"]).optional(),
  config: experienceConfigSchema.optional(),
  status: z.enum(["draft", "published", "unpublished"]).optional(),
});

export const mediaUpdateSchema = z.object({
  caption: z.string().max(400).nullable().optional(),
  room: z.string().max(80).nullable().optional(),
  kind: z.enum(["photo", "floorplan", "video", "document"]).optional(),
  is_primary: z.boolean().optional(),
  is_public: z.boolean().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  sort: z.number().int().min(0).max(9999).optional(),
  property_id: z.string().uuid().nullable().optional(),
});

export const jobCreateSchema = z.object({
  property_id: z.string().uuid(),
  task_type: z.enum([
    "validate_fields",
    "analyze_media",
    "generate_listing",
    "generate_multilingual",
    "generate_audience_versions",
    "generate_campaign",
    "generate_media_brief",
    "prepare_experience",
  ]),
  locale: z.string().max(10).optional(),
  variant: z.string().max(40).optional(),
  input: z.record(z.string(), z.any()).default({}),
});

export const contentUpdateSchema = z.object({
  title: z.string().max(220).nullable().optional(),
  body: z.string().max(12000).nullable().optional(),
  payload: z.record(z.string(), z.any()).optional(),
  status: z.enum(["draft", "approved", "archived"]).optional(),
});

export const teamInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido."),
  role: z.enum(["admin", "agent", "viewer"]),
  title: z.string().max(80).optional(),
});

export const memberRoleSchema = z.object({
  role: z.enum(["owner", "admin", "agent", "viewer"]),
});

export const orgSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  plan_code: z.enum(["starter", "pro", "agency"]).optional(),
  branding: z
    .object({
      agencyName: z.string().max(120).optional(),
      tagline: z.string().max(200).optional(),
      accent: z.string().max(20).optional(),
      phone: z.string().max(60).optional(),
      email: z.string().max(160).optional(),
      website: z.string().max(200).optional(),
    })
    .optional(),
  settings: z
    .object({
      retentionMonths: z.number().int().min(1).max(120).optional(),
      assistantEnabled: z.boolean().optional(),
      showAssistantTranscripts: z.boolean().optional(),
      dataController: z.string().max(200).optional(),
    })
    .optional(),
});

export const planUpdateSchema = z.object({
  price_monthly_cents: z.number().int().min(0).max(10_000_000).optional(),
  limits: z
    .object({
      properties: z.number().int().min(1).max(100000).optional(),
      ai_jobs_month: z.number().int().min(1).max(1000000).optional(),
      seats: z.number().int().min(1).max(10000).optional(),
      experiences: z.number().int().min(1).max(100000).optional(),
    })
    .optional(),
  features: z.array(z.string().max(120)).max(20).optional(),
  tagline: z.string().max(200).optional(),
  is_public: z.number().int().min(0).max(1).optional(),
});

export const conversationReviewSchema = z.object({
  review_status: z.enum(["unreviewed", "reviewed", "flagged"]),
});

export const privacyRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido."),
  kind: z.enum(["access", "rectification", "erasure", "portability", "objection"]),
  note: z.string().max(1000).optional(),
});

export type PropertyInput = z.infer<typeof propertyInputSchema>;
export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
export type ExperienceConfigInput = z.infer<typeof experienceConfigSchema>;
