alter table public.universe_entities
  add column if not exists risk_notes text not null default '';

alter table public.engagements
  add column if not exists objectives text not null default '',
  add column if not exists scope text not null default '',
  add column if not exists criteria text not null default '',
  add column if not exists addressee_name text not null default '',
  add column if not exists addressee_title text not null default '',
  add column if not exists copy_furnished text not null default '';

alter table public.working_notes
  add column if not exists observations text not null default '';

alter table public.findings
  add column if not exists category text not null default 'General';

alter table public.issues_register
  add column if not exists extension_reason text not null default '';
