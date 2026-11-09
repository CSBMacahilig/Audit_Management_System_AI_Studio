-- ============================================================
-- 003_master_data.sql
-- Master Data & Setup Configuration Storage
-- Run this in the Supabase SQL Editor if you want a dedicated cloud table
-- for Entity Types, Audit Categories, Auditor Pool, and Auditee Directory.
-- ============================================================

create table if not exists public.master_data (
  id          text primary key, -- 'entity_types', 'audit_categories', 'auditors', 'auditee_directory', 'setup_checklist'
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Enable RLS and permissive policy
alter table public.master_data enable row level security;
create policy "Allow all on master_data" on public.master_data for all using (true) with check (true);
