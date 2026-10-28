export const PROPERTY_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "bg-stone-soft text-graphite" },
  in_preparation: { label: "Em preparação", tone: "bg-champagne/20 text-champagne-deep" },
  ready: { label: "Pronto a publicar", tone: "bg-forest/10 text-forest" },
  published: { label: "Publicado", tone: "bg-forest text-porcelain" },
  archived: { label: "Arquivado", tone: "bg-obsidian/10 text-graphite-dim" },
};

export const JOB_STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  queued: { label: "Em fila", tone: "text-graphite", dot: "bg-stone-deep" },
  processing: { label: "A processar", tone: "text-champagne-deep", dot: "bg-champagne animate-pulse" },
  needs_review: { label: "Requer revisão", tone: "text-champagne-deep", dot: "bg-champagne" },
  completed: { label: "Concluída", tone: "text-forest", dot: "bg-forest" },
  failed: { label: "Falhou", tone: "text-red-800", dot: "bg-red-700" },
};

export const LEAD_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Nova", tone: "bg-obsidian text-porcelain" },
  contacted: { label: "Contactada", tone: "bg-stone-soft text-graphite" },
  qualified: { label: "Qualificada", tone: "bg-champagne/25 text-champagne-deep" },
  visit_scheduled: { label: "Visita agendada", tone: "bg-forest/12 text-forest" },
  offer: { label: "Proposta", tone: "bg-forest/20 text-forest" },
  won: { label: "Ganha", tone: "bg-forest text-porcelain" },
  lost: { label: "Perdida", tone: "bg-obsidian/10 text-graphite-dim" },
};

export const VISIT_STATUS: Record<string, { label: string; tone: string }> = {
  requested: { label: "Solicitada", tone: "bg-champagne/20 text-champagne-deep" },
  confirmed: { label: "Confirmada", tone: "bg-forest/12 text-forest" },
  completed: { label: "Realizada", tone: "bg-stone-soft text-graphite" },
  cancelled: { label: "Cancelada", tone: "bg-red-900/10 text-red-900" },
  rescheduled: { label: "Remarcada", tone: "bg-obsidian/10 text-graphite" },
};

export const EXPERIENCE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "bg-stone-soft text-graphite" },
  published: { label: "Publicada", tone: "bg-forest text-porcelain" },
  unpublished: { label: "Despublicada", tone: "bg-obsidian/10 text-graphite-dim" },
};

export const LAYOUTS: Record<string, { label: string; description: string }> = {
  architectural: {
    label: "Architectural",
    description: "Minimalismo, grandes imagens, foco na arquitectura e na matéria.",
  },
  signature: {
    label: "Signature",
    description: "Apresentação editorial para imóveis premium, com narrativa e tipografia serifada.",
  },
  investment: {
    label: "Investment",
    description: "Estrutura orientada a especificações e leitura factual, orientada a análise.",
  },
};

export const PIPELINE_LABELS = LEAD_STATUS;

export const SOURCE_LABELS: Record<string, string> = {
  property_page: "Página do imóvel",
  instagram: "Instagram",
  campaign: "Campanha",
  referral: "Recomendação",
  direct: "Direto",
  google: "Pesquisa orgânica",
  visit_form: "Pedido de visita",
  manual: "Inserção manual",
  assistant: "Assistente",
};

export const TASK_LABELS: Record<string, string> = {
  validate_fields: "Validar campos",
  analyze_media: "Analisar media",
  generate_listing: "Gerar listagem",
  generate_multilingual: "Gerar multilingue",
  generate_audience_versions: "Adaptar audiências",
  generate_campaign: "Gerar campanha",
  generate_media_brief: "Briefing de vídeo",
  prepare_experience: "Preparar experiência",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  agent: "Consultor",
  viewer: "Leitura",
};

export const PROPERTY_TYPES = [
  { value: "villa", label: "Moradia" },
  { value: "apartment", label: "Apartamento" },
  { value: "townhouse", label: "Casa em banda" },
  { value: "estate", label: "Quinta / herdade" },
  { value: "land", label: "Terreno" },
  { value: "commercial", label: "Comercial" },
];

export const PROPERTY_TYPE_LABELS = Object.fromEntries(PROPERTY_TYPES.map((t) => [t.value, t.label]));

export const ROOM_OPTIONS = [
  "Exterior",
  "Sala",
  "Cozinha",
  "Quarto",
  "Suite",
  "Casa de banho",
  "Escritório",
  "Terraço",
  "Jardim",
  "Piscina",
  "Vista",
  "Entrada",
];
