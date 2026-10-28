-- ESTATE OS — relational schema (SQLite implementation of the domain model).
-- Every business entity is scoped to an organization; all server queries are
-- executed through org-scoped data-access functions (see src/server/data/*).
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  plan_code     TEXT NOT NULL DEFAULT 'starter',
  branding      TEXT NOT NULL DEFAULT '{}',
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'pt',
  avatar_url    TEXT,
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organization_members (
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('owner','admin','agent','viewer')),
  title         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, profile_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invitations (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent',
  token         TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by    TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  tagline       TEXT,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  limits        TEXT NOT NULL DEFAULT '{}',
  features      TEXT NOT NULL DEFAULT '[]',
  is_public     INTEGER NOT NULL DEFAULT 1,
  sort          INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code     TEXT NOT NULL REFERENCES plans(code),
  status        TEXT NOT NULL DEFAULT 'unconfigured'
                CHECK (status IN ('unconfigured','trialing','active','past_due','cancelled')),
  provider      TEXT,
  external_id   TEXT,
  current_period_end TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference     TEXT NOT NULL,
  title         TEXT NOT NULL,
  property_type TEXT NOT NULL,
  operation     TEXT NOT NULL CHECK (operation IN ('sale','rent')),
  price_cents   INTEGER,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  country       TEXT,
  city          TEXT,
  location      TEXT,
  address_line  TEXT,
  address_private INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','in_preparation','ready','published','archived')),
  summary       TEXT,
  internal_notes TEXT,
  completion    INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, reference)
);

CREATE TABLE IF NOT EXISTS property_specs (
  property_id   TEXT PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  usable_area_m2 REAL,
  plot_area_m2  REAL,
  bedrooms      INTEGER,
  bathrooms     INTEGER,
  parking       INTEGER,
  typology      TEXT,
  condition     TEXT,
  year_built    INTEGER,
  energy_rating TEXT,
  amenities     TEXT NOT NULL DEFAULT '[]',
  features      TEXT NOT NULL DEFAULT '[]',
  views         TEXT NOT NULL DEFAULT '[]',
  extra_fields  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS property_media (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT REFERENCES properties(id) ON DELETE CASCADE,
  storage_key   TEXT,
  public_path   TEXT,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  kind          TEXT NOT NULL DEFAULT 'photo'
                CHECK (kind IN ('photo','floorplan','video','document')),
  room          TEXT,
  caption       TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  is_primary    INTEGER NOT NULL DEFAULT 0,
  is_public     INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  sort          INTEGER NOT NULL DEFAULT 0,
  uploaded_by   TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS property_documents (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT REFERENCES properties(id) ON DELETE CASCADE,
  storage_key   TEXT,
  public_path   TEXT,
  name          TEXT NOT NULL,
  doc_type      TEXT NOT NULL DEFAULT 'other',
  access_level  TEXT NOT NULL DEFAULT 'team'
                CHECK (access_level IN ('private','team','public')),
  mime_type     TEXT,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  uploaded_by   TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS property_content (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'pt',
  variant       TEXT NOT NULL DEFAULT 'default',
  title         TEXT,
  body          TEXT,
  payload       TEXT NOT NULL DEFAULT '{}',
  provider      TEXT NOT NULL DEFAULT 'local-rules',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','approved','archived')),
  approved_by   TEXT REFERENCES profiles(id),
  approved_at   TEXT,
  created_by    TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS property_experiences (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  layout        TEXT NOT NULL DEFAULT 'architectural'
                CHECK (layout IN ('architectural','signature','investment')),
  slug          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','unpublished')),
  config        TEXT NOT NULL DEFAULT '{}',
  published_at  TEXT,
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT REFERENCES properties(id) ON DELETE CASCADE,
  task_type     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','needs_review','completed','failed')),
  provider      TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 2,
  input         TEXT NOT NULL DEFAULT '{}',
  output        TEXT,
  error         TEXT,
  created_by    TEXT REFERENCES profiles(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  started_at    TEXT,
  completed_at  TEXT
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT,
  job_id        TEXT,
  provider      TEXT NOT NULL,
  operation     TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms    INTEGER,
  status        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT REFERENCES properties(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  source        TEXT NOT NULL DEFAULT 'property_page',
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','contacted','qualified','visit_scheduled','offer','won','lost')),
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  owner_id      TEXT REFERENCES profiles(id),
  next_action   TEXT,
  next_action_at TEXT,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_terms INTEGER NOT NULL DEFAULT 0,
  consent_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_events (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  note          TEXT,
  actor_id      TEXT REFERENCES profiles(id),
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lead_id       TEXT REFERENCES leads(id) ON DELETE SET NULL,
  agent_id      TEXT REFERENCES profiles(id),
  scheduled_at  TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  status        TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested','confirmed','completed','cancelled','rescheduled')),
  notes         TEXT,
  outcome       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT REFERENCES properties(id) ON DELETE CASCADE,
  visitor_key   TEXT NOT NULL,
  channel       TEXT NOT NULL DEFAULT 'property_assistant',
  review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','reviewed','flagged')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content       TEXT NOT NULL,
  citations     TEXT NOT NULL DEFAULT '[]',
  provider      TEXT,
  grounded      INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id   TEXT,
  experience_id TEXT,
  event_type    TEXT NOT NULL,
  session_key   TEXT,
  path          TEXT,
  referrer      TEXT,
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      TEXT REFERENCES profiles(id),
  action        TEXT NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     TEXT,
  meta          TEXT NOT NULL DEFAULT '{}',
  ip            TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('access','rectification','erasure','portability','objection')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','rejected')),
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(org_id, status);
CREATE INDEX IF NOT EXISTS idx_media_property ON property_media(property_id, sort);
CREATE INDEX IF NOT EXISTS idx_content_property ON property_content(property_id, kind, locale);
CREATE INDEX IF NOT EXISTS idx_experiences_org ON property_experiences(org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON ai_jobs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_property ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_org ON visits(org_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_conv_property ON conversations(property_id, last_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages ON conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_org ON analytics_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_property ON analytics_events(property_id, event_type);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_property ON property_documents(property_id);
