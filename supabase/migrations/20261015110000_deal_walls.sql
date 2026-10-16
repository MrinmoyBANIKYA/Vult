-- ---------------------------------------------------------------------------------------------
-- Deal walls (information barriers). A private-side engagement can be walled: then only the people
-- listed on it see it, or anything that belongs to it (runs, documents, evidence, models, files, comments,
-- approvals, co-pilot history), whatever their role in the organisation. Putting someone over the wall is
-- recorded, with who did it and why, and only a compliance officer (or an owner) can do it.
--
-- Walls are added as RESTRICTIVE policies, which Postgres ANDs with the existing ones, so every other
-- rule (members read, editors write, admins delete) still applies inside the wall.
-- ---------------------------------------------------------------------------------------------

alter table public.engagements add column if not exists is_walled boolean not null default false;
comment on column public.engagements.is_walled is 'Private-side work: visible only to the people listed in engagement_members.';

create table public.engagement_members (
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (engagement_id, user_id)
);

-- Every wall crossing and removal, kept for compliance. Nobody can change or delete an entry.
create table public.wall_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  user_id uuid not null,
  action text not null check (action in ('crossed', 'removed', 'walled', 'unwalled')),
  reason text not null,
  by_user uuid default auth.uid(),
  at timestamptz not null default now()
);

-- Whether the signed-in user may see an engagement. Not walled: any member of its organisation. Walled:
-- only the people listed on it. Security definer so it can read the lists without recursing through RLS.
create or replace function public.can_see_engagement(p_engagement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_engagement is null or exists (
    select 1
    from public.engagements e
    where e.id = p_engagement
      and (
        not e.is_walled
        or exists (
          select 1 from public.engagement_members em
          where em.engagement_id = e.id and em.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.is_compliance(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role in ('owner', 'compliance')
  );
$$;

-- Restrictive policies: inside a wall, only listed people, for every command.
create policy "Walled engagements are visible only to their team"
  on public.engagements as restrictive for all to authenticated
  using (public.can_see_engagement(id) or public.is_compliance(org_id))
  with check (public.can_see_engagement(id) or public.is_compliance(org_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'runs', 'documents', 'evidence', 'model_versions', 'files', 'hallmarks', 'comments', 'copilot_messages',
    'brief_items', 'approvals'
  ] loop
    execute format(
      'create policy "Walled engagement data is visible only to its team" on public.%I as restrictive for all to authenticated using (public.can_see_engagement(engagement_id)) with check (public.can_see_engagement(engagement_id))',
      t
    );
  end loop;
end;
$$;

create policy "Walled run events are visible only to the team"
  on public.run_events as restrictive for all to authenticated
  using (exists (select 1 from public.runs r where r.id = run_id and public.can_see_engagement(r.engagement_id)))
  with check (exists (select 1 from public.runs r where r.id = run_id and public.can_see_engagement(r.engagement_id)));

alter table public.engagement_members enable row level security;
create policy "Team lists are visible to the team and compliance"
  on public.engagement_members for select to authenticated
  using (public.can_see_engagement(engagement_id) or public.is_compliance(org_id));

alter table public.wall_events enable row level security;
create policy "Compliance reads the wall log"
  on public.wall_events for select to authenticated
  using (public.is_compliance(org_id));

-- The only ways to change a wall. Each records who, what and why.
create or replace function public.set_wall(p_engagement uuid, p_walled boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.engagements where id = p_engagement;
  if v_org is null or not public.is_compliance(v_org) then
    raise exception 'Only compliance can wall or unwall an engagement' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason' using errcode = '22023';
  end if;
  update public.engagements set is_walled = p_walled where id = p_engagement;
  insert into public.wall_events (org_id, engagement_id, user_id, action, reason)
  values (v_org, p_engagement, (select auth.uid()), case when p_walled then 'walled' else 'unwalled' end, p_reason);
end;
$$;

create or replace function public.cross_wall(p_engagement uuid, p_user uuid, p_reason text, p_add boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.engagements where id = p_engagement;
  if v_org is null or not public.is_compliance(v_org) then
    raise exception 'Only compliance can bring someone over the wall' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships m where m.org_id = v_org and m.user_id = p_user) then
    raise exception 'That person is not in the organisation' using errcode = '22023';
  end if;
  if p_add then
    insert into public.engagement_members (engagement_id, org_id, user_id)
    values (p_engagement, v_org, p_user)
    on conflict do nothing;
  else
    delete from public.engagement_members where engagement_id = p_engagement and user_id = p_user;
  end if;
  insert into public.wall_events (org_id, engagement_id, user_id, action, reason)
  values (v_org, p_engagement, p_user, case when p_add then 'crossed' else 'removed' end, p_reason);
end;
$$;

revoke all on function public.set_wall(uuid, boolean, text) from public, anon;
revoke all on function public.cross_wall(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_wall(uuid, boolean, text) to authenticated;
grant execute on function public.cross_wall(uuid, uuid, text, boolean) to authenticated;
