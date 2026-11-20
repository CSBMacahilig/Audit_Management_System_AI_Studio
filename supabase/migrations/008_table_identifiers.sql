-- Display identifiers for existing records.
-- Primary-key IDs remain unchanged to preserve foreign-key relationships.

update public.engagements
set ref = 'AE-' || year || '-' || lpad(
  substring(ref from '([0-9]+)$'),
  3,
  '0'
)
where ref like 'AUD-%';

update public.universe_entities
set code = 'AU-' || lpad(
  coalesce(
    substring(code from '([0-9]+)$'),
    '1'
  ),
  4,
  '0'
)
where code is not null;

update public.working_notes
set ref = 'WP-' || lpad(
  coalesce(substring(ref from '([0-9]+)$'), '1'),
  4,
  '0'
)
where ref is not null;

update public.findings
set ref = 'FN-' || lpad(
  coalesce(substring(ref from '([0-9]+)$'), '1'),
  4,
  '0'
)
where ref is not null;

update public.issues_register
set ref = 'IS-' || lpad(
  coalesce(substring(ref from '([0-9]+)$'), '1'),
  4,
  '0'
)
where ref is not null;
