-- ---------------------------------------------------------------------------------------------
-- Colleagues join a firm with its join code. The code lives in its own table so only the firm's owners
-- and admins can read it (members can read the organisations row, so it cannot sit there).
-- ---------------------------------------------------------------------------------------------
create table public.org_join_codes (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  created_at timestamptz not null default now()
);
comment on table public.org_join_codes is 'One join code per firm; colleagues enter it to become analysts.';
alter table public.org_join_codes enable row level security;

create policy "Admins read their firm's join code"
  on public.org_join_codes for select to authenticated
  using (public.is_admin(org_id));

create or replace function public.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select upper(substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4));
$$;

-- Every firm gets a code: existing ones now, new ones as they are created.
insert into public.org_join_codes (org_id, code)
select o.id, public.new_join_code() from public.organizations o where not o.is_demo
on conflict (org_id) do nothing;

create or replace function public.on_org_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_demo then
    insert into public.org_join_codes (org_id, code) values (new.id, public.new_join_code())
    on conflict (org_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_org_created
  after insert on public.organizations
  for each row execute function public.on_org_created();

-- Joins the firm whose code this is, as an analyst. An account already in a firm cannot join another.
create or replace function public.join_organization(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select org_id into v_org from public.org_join_codes where code = upper(btrim(coalesce(p_code, '')));
  if v_org is null then
    raise exception 'That join code is not valid' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and not o.is_demo
  ) then
    raise exception 'This account already belongs to a firm' using errcode = '23505';
  end if;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_user, 'analyst')
  on conflict (org_id, user_id) do nothing;
  return v_org;
end;
$$;

-- Replaces the code, for example after it was shared too widely. Admins only.
create or replace function public.rotate_join_code(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public.new_join_code();
begin
  if not public.is_admin(p_org) then
    raise exception 'Only the firm''s owners and admins can change its join code' using errcode = '42501';
  end if;
  insert into public.org_join_codes (org_id, code) values (p_org, v_code)
  on conflict (org_id) do update set code = excluded.code, created_at = now();
  return v_code;
end;
$$;

revoke execute on function public.join_organization(text) from public, anon;
revoke execute on function public.rotate_join_code(uuid) from public, anon;
revoke execute on function public.new_join_code() from public, anon, authenticated;
grant execute on function public.join_organization(text) to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;
grant select on public.org_join_codes to authenticated;
