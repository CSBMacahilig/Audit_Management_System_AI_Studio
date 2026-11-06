-- ============================================================
-- 000_clear_all_data.sql
-- Run this FIRST to wipe all seeded data from the database.
-- Tables and structure are preserved — only rows are deleted.
-- ============================================================

truncate table public.activity_logs    restart identity cascade;
truncate table public.engagement_files restart identity cascade;
truncate table public.timeline_activities restart identity cascade;
truncate table public.findings         restart identity cascade;
truncate table public.working_notes    restart identity cascade;
truncate table public.engagements      restart identity cascade;
truncate table public.issues_register  restart identity cascade;
truncate table public.universe_entities restart identity cascade;
truncate table public.sizing_configs   restart identity cascade;
truncate table public.audit_frequencies restart identity cascade;
truncate table public.user_profiles    restart identity cascade;
truncate table public.system_users     restart identity cascade;
