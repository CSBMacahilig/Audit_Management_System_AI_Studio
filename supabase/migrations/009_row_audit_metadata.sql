-- Shared row audit metadata for core AMS tables.
-- added_by / modified_by store the signed-in account email.

alter table public.engagements
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.working_notes
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.findings
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.timeline_activities
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.engagement_files
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.activity_logs
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.issues_register
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.universe_entities
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.sizing_configs
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.user_profiles
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.system_users
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.audit_frequencies
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;

alter table public.master_data
  add column if not exists added_by text,
  add column if not exists modified_by text,
  add column if not exists modified_at timestamptz;
