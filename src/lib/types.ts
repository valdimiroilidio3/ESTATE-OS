// Shared domain types. These mirror the relational schema in src/server/schema.sql
// and are safe to import from both server and client components.

export type Role = "owner" | "admin" | "agent" | "viewer";
export type Operation = "sale" | "rent";
export type PropertyStatus = "draft" | "in_preparation" | "ready" | "published" | "archived";
export type JobStatus = "queued" | "processing" | "needs_review" | "completed" | "failed";
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "visit_scheduled"
  | "offer"
  | "won"
  | "lost";
export type VisitStatus = "requested" | "confirmed" | "completed" | "cancelled" | "rescheduled";
export type ExperienceLayout = "architectural" | "signature" | "investment";
export type ExperienceStatus = "draft" | "published" | "unpublished";
export type MediaKind = "photo" | "floorplan" | "video" | "document";
export type ContentStatus = "draft" | "approved" | "archived";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  avatar_url: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_code: string;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface Session {
  profile: Profile;
  org: Organization;
  role: Role;
  sessionId: string;
}

export interface PropertySpecs {
  property_id: string;
  usable_area_m2: number | null;
  plot_area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  typology: string | null;
  condition: string | null;
  year_built: number | null;
  energy_rating: string | null;
  amenities: string[];
  features: string[];
  views: string[];
  extra_fields: { label: string; value: string }[];
}

export interface Property {
  id: string;
  org_id: string;
  reference: string;
  title: string;
  property_type: string;
  operation: Operation;
  price_cents: number | null;
  currency: string;
  country: string | null;
  city: string | null;
  location: string | null;
  address_line: string | null;
  address_private: number;
  status: PropertyStatus;
  summary: string | null;
  internal_notes: string | null;
  completion: number;
  created_at: string;
  updated_at: string;
  specs: PropertySpecs | null;
}

export interface PropertyMedia {
  id: string;
  property_id: string | null;
  file_name: string;
  public_path: string | null;
  mime_type: string;
  size_bytes: number;
  kind: MediaKind;
  room: string | null;
  caption: string | null;
  tags: string[];
  is_primary: number;
  is_public: number;
  status: "pending" | "approved" | "rejected";
  sort: number;
  created_at: string;
}

export interface ContentRecord {
  id: string;
  property_id: string;
  kind: string;
  locale: string;
  variant: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  provider: string;
  status: ContentStatus;
  approved_at: string | null;
  updated_at: string;
}

export interface ExperienceConfig {
  hero: {
    headline: string;
    subheadline: string;
    showPrice: boolean;
    locationLabel: string;
    primaryCta: string;
    secondaryCta: string;
  };
  sections: { id: string; enabled: boolean }[];
  gallery?: { mode: "masonry" | "grid" | "carousel"; mediaIds: string[]; showCaptions: boolean };
  contact: { name: string; email: string; phone: string; role: string };
  map: { enabled: boolean; lat: number | null; lng: number | null; showExactAddress: boolean };
  theme: { accent: string; tone: "light" | "dark" };
}

export interface Experience {
  id: string;
  property_id: string;
  layout: ExperienceLayout;
  slug: string;
  status: ExperienceStatus;
  config: ExperienceConfig;
  published_at: string | null;
  view_count: number;
  updated_at: string;
}

export interface Job {
  id: string;
  property_id: string | null;
  task_type: string;
  status: JobStatus;
  provider: string | null;
  attempts: number;
  max_attempts: number;
  output: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Lead {
  id: string;
  property_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  message: string | null;
  status: LeadStatus;
  priority: "low" | "normal" | "high";
  owner_id: string | null;
  owner_name?: string | null;
  next_action: string | null;
  next_action_at: string | null;
  consent_marketing: number;
  consent_terms: number;
  created_at: string;
  updated_at: string;
  property_title?: string | null;
  property_reference?: string | null;
}

export interface Visit {
  id: string;
  property_id: string;
  lead_id: string | null;
  agent_id: string | null;
  scheduled_at: string | null;
  timezone: string;
  status: VisitStatus;
  notes: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
  property_title?: string;
  lead_name?: string | null;
  agent_name?: string | null;
}

export interface Plan {
  code: string;
  name: string;
  tagline: string | null;
  price_monthly_cents: number;
  currency: string;
  limits: { properties?: number; ai_jobs_month?: number; seats?: number; experiences?: number };
  features: string[];
  is_public: number;
  sort: number;
}

export interface AuditEntry {
  id: string;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AnalyticsSummary {
  pageViews: number;
  ctaClicks: number;
  leads: number;
  visitRequests: number;
  assistantMessages: number;
  shares: number;
  conversionRate: number | null;
  byProperty: {
    property_id: string;
    title: string;
    views: number;
    cta: number;
    leads: number;
    visits: number;
  }[];
  bySource: { source: string; count: number }[];
  daily: { date: string; views: number; leads: number }[];
}
