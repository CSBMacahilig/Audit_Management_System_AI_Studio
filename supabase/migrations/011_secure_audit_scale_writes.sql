create table if not exists public.app_sessions (
  token_hash text primary key,
  user_id text not null references public.system_users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_expires_at_idx
  on public.app_sessions (expires_at);

alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from public, anon, authenticated;
grant all on public.app_sessions to service_role;

alter table public.audit_division_risk_scales enable row level security;
revoke all on public.audit_division_risk_scales from public, anon, authenticated;
grant select on public.audit_division_risk_scales to anon, authenticated;
grant all on public.audit_division_risk_scales to service_role;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_division_risk_scales'
  loop
    execute format(
      'drop policy %I on public.audit_division_risk_scales',
      existing_policy.policyname
    );
  end loop;
end
$$;

create policy audit_division_risk_scales_read
  on public.audit_division_risk_scales
  for select
  to anon, authenticated
  using (true);
