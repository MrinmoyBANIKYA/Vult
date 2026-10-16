-- ---------------------------------------------------------------------------------------------
-- join_demo_workspaces() used to give every new account analyst access to the demo organisations.
-- That must not happen in a project real clients use, so it is now off unless the project turns it on:
--
--   insert into public.app_settings (key, value) values ('allow_demo_join', 'true')
--   on conflict (key) do update set value = excluded.value;
--
-- The local seed turns it on for development. A cloud project starts with it off.
-- ---------------------------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'Project-wide switches. Only the service role and migrations change them.';

-- Nobody signed in can read or change settings; security definer functions read them.
alter table public.app_settings enable row level security;

create or replace function public.setting_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::boolean from public.app_settings s where s.key = p_key), false);
$$;

create or replace function public.join_demo_workspaces()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  -- Off unless this project allows it: a client project never adds strangers to any organisation.
  if not public.setting_enabled('allow_demo_join') then
    return 0;
  end if;
  insert into public.memberships (org_id, user_id, role)
  select o.id, v_user, 'analyst'
  from public.organizations o
  where o.is_demo
  on conflict (org_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
