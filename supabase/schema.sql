-- Run once in your Supabase project's SQL Editor before using the app.
-- No browser client has direct access. Only the server secret role is granted access.
create table if not exists public.claimwise_workspaces (
  owner text primary key,
  revision integer not null check (revision >= 1),
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and data ? 'claims' and
    jsonb_typeof(data -> 'claims') = 'array'
  ),
  updated_at timestamptz not null default now()
);

alter table public.claimwise_workspaces enable row level security;
revoke all on public.claimwise_workspaces from public, anon, authenticated;
grant select, insert, update on public.claimwise_workspaces to service_role;

create or replace function public.save_claimwise_workspace(
  p_owner text,
  p_expected_revision integer,
  p_data jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare changed integer;
begin
  if p_owner is null or length(p_owner) = 0 or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid workspace mutation';
  end if;
  if p_expected_revision = 0 then
    insert into public.claimwise_workspaces (owner, revision, data)
    values (p_owner, 1, p_data)
    on conflict (owner) do nothing;
  else
    update public.claimwise_workspaces
    set data = p_data, revision = revision + 1, updated_at = now()
    where owner = p_owner and revision = p_expected_revision;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.save_claimwise_workspace(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_claimwise_workspace(text, integer, jsonb) to service_role;
