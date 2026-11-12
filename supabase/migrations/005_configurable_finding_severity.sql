-- Finding severity options are maintained in public.master_data.
alter table public.findings
  drop constraint if exists findings_severity_check;

alter table public.issues_register
  drop constraint if exists issues_register_severity_check;
