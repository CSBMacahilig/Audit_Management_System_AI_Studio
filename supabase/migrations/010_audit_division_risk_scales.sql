create table if not exists public.audit_division_risk_scales (
  id text primary key,
  name text not null unique,
  high_min_score numeric not null default 7,
  medium_min_score numeric not null default 4,
  high_cycle_months integer not null default 12,
  medium_cycle_months integer not null default 36,
  low_cycle_months integer not null default 48,
  high_fieldwork_weeks integer not null default 5,
  medium_fieldwork_weeks integer not null default 4,
  low_fieldwork_weeks integer not null default 3,
  added_by text,
  modified_by text,
  modified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_division_risk_scores_valid
    check (medium_min_score >= 0 and high_min_score > medium_min_score and high_min_score <= 10),
  constraint audit_division_risk_cycles_valid
    check (
      high_cycle_months between 1 and 60 and
      medium_cycle_months between 1 and 60 and
      low_cycle_months between 1 and 60
    ),
  constraint audit_division_fieldwork_valid
    check (
      high_fieldwork_weeks between 1 and 52 and
      medium_fieldwork_weeks between 1 and 52 and
      low_fieldwork_weeks between 1 and 52
    )
);

insert into public.audit_division_risk_scales (id, name)
values
  ('branch-assurance', 'Branch Assurance'),
  ('head-office-assurance', 'Head Office Assurance'),
  ('information-system-assurance', 'Information System Assurance'),
  ('audit-excellence-pre-implementation-reviews', 'Audit Excellence & Pre-Implementation Reviews'),
  ('data-analytics-investigations-special-audits', 'Data Analytics, Investigations and Special Audits')
on conflict (id) do nothing;

alter table public.universe_entities
  add column if not exists audit_division_id text
    references public.audit_division_risk_scales(id) on delete restrict;

alter table public.engagements
  add column if not exists audit_division_id text
    references public.audit_division_risk_scales(id) on delete restrict;
