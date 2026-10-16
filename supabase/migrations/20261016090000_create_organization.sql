-- ---------------------------------------------------------------------------------------------
-- A new account on a client project belongs to no organisation (demo join is off), so it needs a way to
-- set up its own firm. create_organization() makes the firm and the caller its owner, in one step.
-- An account that already belongs to a firm cannot make another this way; owners invite colleagues.
-- ---------------------------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_region text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_base text;
  v_slug text;
  v_mono text;
  v_org uuid;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Give the firm a name of 2 to 80 characters' using errcode = '22023';
  end if;
  if p_region not in ('uk', 'us') then
    raise exception 'Region must be uk or us' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships m join public.organizations o on o.id = m.org_id
    where m.user_id = v_user and not o.is_demo
  ) then
    raise exception 'This account already belongs to a firm' using errcode = '23505';
  end if;

  v_base := nullif(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), '');
  v_slug := left(coalesce(v_base, 'firm'), 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_mono := upper(left(regexp_replace(initcap(v_name), '[^A-Z0-9]', '', 'g'), 3));
  if v_mono = '' then
    v_mono := upper(left(v_name, 1));
  end if;

  insert into public.organizations (slug, name, mono, region, timezone, currency, accounting_standard)
  values (
    v_slug,
    v_name,
    v_mono,
    p_region,
    case when p_region = 'us' then 'America/New_York' else 'Europe/London' end,
    case when p_region = 'us' then 'USD' else 'GBP' end,
    case when p_region = 'us' then 'US GAAP' else 'IFRS' end
  )
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role) values (v_org, v_user, 'owner');
  return v_org;
end;
$$;

revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
