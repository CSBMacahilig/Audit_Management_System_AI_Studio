-- BRW 4.2/6: enforce mandatory audit frequencies and engagement lifecycle states.
alter table public.audit_frequencies
  alter column high set default 12,
  alter column medium set default 36,
  alter column low set default 48;

update public.audit_frequencies
set high = 12,
    medium = 36,
    low = 48,
    updated_at = now()
where id = 'global';

alter table public.engagements
  drop constraint if exists engagements_status_check;

alter table public.engagements
  add constraint engagements_status_check
  check (status in ('Planned','Scheduled','In progress','Reporting','Closed','Deferred','Cancelled'));
