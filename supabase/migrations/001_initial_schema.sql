-- ============================================================
-- Audit Management System — Supabase Initial Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- ── 1. USER PROFILES ────────────────────────────────────────
create table if not exists public.user_profiles (
  id                    text primary key,
  name                  text not null,
  role_title            text not null,
  full_label            text not null,
  header_subtitle       text not null,
  department            text not null,
  can_approve_head      boolean not null default false,
  can_approve_independent boolean not null default false,
  can_approve_cae       boolean not null default false,
  employee_number       text,
  last_login_date       timestamptz,
  account_modified_at   timestamptz,
  account_status        text not null default 'Active' check (account_status in ('Active','Inactive','Deactivated')),
  failed_login_count    int not null default 0,
  is_locked             boolean not null default false,
  requires_password_change boolean not null default false,
  password_last_changed timestamptz,
  password_history      text[] not null default '{}',
  mfa_enabled           boolean not null default false,
  is_privileged         boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 2. SYSTEM USERS (auth accounts) ─────────────────────────
create table if not exists public.system_users (
  id                        text primary key,
  username                  text not null unique,
  full_name                 text not null,
  email                     text not null,
  role                      text not null default 'user' check (role in ('admin','user')),
  password_hash             text not null,
  is_active                 boolean not null default true,
  is_locked                 boolean not null default false,
  failed_login_count        int not null default 0,
  requires_password_change  boolean not null default true,
  created_at                timestamptz not null default now(),
  last_login                timestamptz,
  modified_at               timestamptz not null default now()
);

-- ── 3. AUDIT ENGAGEMENTS ────────────────────────────────────
create table if not exists public.engagements (
  id                    text primary key,
  ref                   text not null unique,
  year                  int not null,
  title                 text not null,
  category              text not null,
  department            text not null,
  entity_name           text not null,
  likelihood            int not null,
  impact                int not null,
  risk_score            int not null,
  risk_level            text not null check (risk_level in ('Critical','High','Medium','Low')),
  lead                  text not null,
  head_reviewer         text not null,
  independent_reviewer  text not null,
  start_date            text not null,
  end_date              text not null,
  duration_days         int not null,
  budgeted_hours        int not null,
  status                text not null check (status in ('Closed','Reporting','In progress','Scheduled','Planned')),
  ready_ratio           text not null,
  lifecycle_stage       int not null check (lifecycle_stage between 1 and 7),
  fieldwork_pct         int not null default 0,
  fieldwork_day_current int not null default 0,
  fieldwork_day_total   int not null,
  report_status         text not null check (report_status in ('Draft','Submitted to Lead','Approved by Lead','Approved by CAE')),
  report_ref            text not null,
  executive_summary     text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 4. WORKING NOTES ────────────────────────────────────────
create table if not exists public.working_notes (
  id                  text primary key,
  engagement_id       text not null references public.engagements(id) on delete cascade,
  ref                 text not null,
  title               text not null,
  control_area        text not null,
  author              text not null,
  status              text not null check (status in ('Cleared','For head review','For independent review','Draft','Returned')),
  has_exception       boolean not null default false,
  updated_at          text not null,
  testing_procedure   text not null default '',
  conclusion          text not null default '',
  reviewer_comments   text,
  created_at          timestamptz not null default now()
);

-- ── 5. FINDINGS ─────────────────────────────────────────────
create table if not exists public.findings (
  id                  text primary key,
  engagement_id       text not null references public.engagements(id) on delete cascade,
  ref                 text not null,
  title               text not null,
  severity            text not null check (severity in ('Critical','High','Medium','Low')),
  condition           text not null default '',
  criteria            text not null default '',
  cause               text not null default '',
  effect              text not null default '',
  recommendation      text not null default '',
  owner               text not null default '',
  target_date         text not null default '',
  status              text not null check (status in ('Open','Action plan submitted','In remediation','Validated & Closed')),
  linked_note_ref     text not null default '',
  created_at          timestamptz not null default now()
);

-- ── 6. TIMELINE ACTIVITIES ───────────────────────────────────
create table if not exists public.timeline_activities (
  id                  text primary key,
  engagement_id       text not null references public.engagements(id) on delete cascade,
  name                text not null,
  role_responsible    text not null,
  due_date            text not null,
  completed_date      text,
  status              text not null check (status in ('Completed','Past due','Pending')),
  stage_id            int not null check (stage_id between 1 and 7),
  created_at          timestamptz not null default now()
);

-- ── 7. FILES ─────────────────────────────────────────────────
create table if not exists public.engagement_files (
  id                  text primary key,
  engagement_id       text not null references public.engagements(id) on delete cascade,
  name                text not null,
  folder              text not null,
  size                text not null,
  uploaded_by         text not null,
  uploaded_at         text not null,
  created_at          timestamptz not null default now()
);

-- ── 8. ACTIVITY LOGS ─────────────────────────────────────────
create table if not exists public.activity_logs (
  id                  text primary key,
  engagement_id       text not null references public.engagements(id) on delete cascade,
  timestamp           text not null,
  actor               text not null,
  action              text not null,
  detail              text,
  created_at          timestamptz not null default now()
);

-- ── 9. ISSUES REGISTER ───────────────────────────────────────
create table if not exists public.issues_register (
  id                  text primary key,
  ref                 text not null unique,
  title               text not null,
  audit_ref           text not null,
  audit_title         text not null,
  severity            text not null check (severity in ('Critical','High','Medium','Low')),
  owner               text not null,
  owner_unit          text not null,
  original_due        text not null,
  current_due         text not null,
  extension_count     int not null default 0,
  days_status         text not null,
  is_overdue          boolean not null default false,
  is_due_soon         boolean not null default false,
  status              text not null check (status in ('Overdue','In progress','Open','Extension requested','For validation','Closed')),
  action_plan_summary text not null,
  evidence_note       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── 10. UNIVERSE ENTITIES ─────────────────────────────────────
create table if not exists public.universe_entities (
  id              text primary key,
  code            text not null unique,
  name            text not null,
  division        text not null,
  category        text not null,
  likelihood      int not null,
  impact          int not null,
  risk_score      int not null,
  risk_level      text not null check (risk_level in ('Critical','High','Medium','Low')),
  last_audited    text not null,
  next_due        text not null,
  cycle_months    int not null,
  default_lead    text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 11. SIZING CONFIGS ───────────────────────────────────────
create table if not exists public.sizing_configs (
  id              text primary key,
  size_name       text not null,
  code            text not null unique,
  working_days    int not null,
  calendar_span   text not null,
  auditors        int not null,
  hours_per_day   int not null,
  budgeted_hours  int not null,
  typical_use     text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 12. AUDIT FREQUENCIES ────────────────────────────────────
create table if not exists public.audit_frequencies (
  id        text primary key default 'global',
  critical  int not null default 6,
  high      int not null default 12,
  medium    int not null default 24,
  low       int not null default 36,
  updated_at timestamptz not null default now()
);

-- ── Row Level Security (permissive for anon – tighten in prod) ──
alter table public.user_profiles enable row level security;
alter table public.system_users enable row level security;
alter table public.engagements enable row level security;
alter table public.working_notes enable row level security;
alter table public.findings enable row level security;
alter table public.timeline_activities enable row level security;
alter table public.engagement_files enable row level security;
alter table public.activity_logs enable row level security;
alter table public.issues_register enable row level security;
alter table public.universe_entities enable row level security;
alter table public.sizing_configs enable row level security;
alter table public.audit_frequencies enable row level security;

-- Allow full access via anon key (application enforces its own auth)
create policy "allow_all_user_profiles"    on public.user_profiles    for all using (true) with check (true);
create policy "allow_all_system_users"     on public.system_users     for all using (true) with check (true);
create policy "allow_all_engagements"      on public.engagements      for all using (true) with check (true);
create policy "allow_all_working_notes"    on public.working_notes    for all using (true) with check (true);
create policy "allow_all_findings"         on public.findings         for all using (true) with check (true);
create policy "allow_all_timeline"         on public.timeline_activities for all using (true) with check (true);
create policy "allow_all_files"            on public.engagement_files for all using (true) with check (true);
create policy "allow_all_activity_logs"    on public.activity_logs    for all using (true) with check (true);
create policy "allow_all_issues"           on public.issues_register  for all using (true) with check (true);
create policy "allow_all_universe"         on public.universe_entities for all using (true) with check (true);
create policy "allow_all_sizing"           on public.sizing_configs   for all using (true) with check (true);
create policy "allow_all_frequencies"      on public.audit_frequencies for all using (true) with check (true);

