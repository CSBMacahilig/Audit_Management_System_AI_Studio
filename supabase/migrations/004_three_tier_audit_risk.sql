-- Remove the Critical tier from audit-risk ratings and audit-frequency settings.
-- Finding and issue severity retain their independent Critical level.

update public.engagements
set risk_level = 'High'
where risk_level = 'Critical';

alter table public.engagements
  drop constraint if exists engagements_risk_level_check;

alter table public.engagements
  add constraint engagements_risk_level_check
  check (risk_level in ('High', 'Medium', 'Low'));

update public.universe_entities
set risk_level = 'High'
where risk_level = 'Critical';

alter table public.universe_entities
  drop constraint if exists universe_entities_risk_level_check;

alter table public.universe_entities
  add constraint universe_entities_risk_level_check
  check (risk_level in ('High', 'Medium', 'Low'));

alter table public.audit_frequencies
  drop column if exists critical;
