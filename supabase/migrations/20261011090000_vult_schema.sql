-- =============================================================================================
-- Vult: core schema
--
-- Multi-tenant by organisation (a client firm such as a private equity house). Every business
-- row carries org_id, and row-level security limits each user to the organisations they belong to.
-- Agents and back-office jobs write with the service role, which bypasses RLS.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'analyst', 'reviewer', 'viewer');
create type public.engagement_status as enum ('draft', 'running', 'paused', 'in_review', 'delivered');
create type public.run_status as enum ('queued', 'running', 'paused', 'delivered', 'failed', 'cancelled');
create type public.approval_status as enum ('pending', 'approved', 'declined');

-- ---------------------------------------------------------------------------------------------
-- Organisations, people and membership
-- ---------------------------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  mono text not null check (char_length(mono) between 1 and 3),
  description text,
  region text not null check (region in ('uk', 'us')),
  city text,
  timezone text not null default 'Europe/London',
  office_code text,
  currency text not null default 'GBP' check (currency in ('GBP', 'USD', 'EUR')),
  accounting_standard text,
  plan text not null default 'deal_team',
  packs_included integer not null default 25 check (packs_included >= 0),
  packs_used integer not null default 0 check (packs_used >= 0),
  renews_on date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.organizations is 'A client firm. Every engagement, agent and approval belongs to one.';
comment on column public.organizations.is_demo is 'Demo workspaces any signed-in user can join with join_demo_workspaces().';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  title text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Public profile for each auth user, created automatically on sign-up.';

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'analyst',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------------------------
-- Companies and engagements
-- ---------------------------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  ticker text,
  exchange text,
  sector text,
  currency text,
  share_price numeric(14, 4),
  price_in_pence boolean not null default false,
  shares_m numeric(14, 3),
  net_debt_m numeric(14, 3),
  created_at timestamptz not null default now()
);
create index companies_org_idx on public.companies (org_id);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid references public.companies (id) on delete set null,
  code text,
  name text not null,
  target_label text not null,
  type text not null,
  status public.engagement_status not null default 'draft',
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  owner_id uuid references auth.users (id) on delete set null,
  owner_name text,
  reviewer_name text,
  house_style text,
  data_room text,
  accounting_basis text,
  is_flagship boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.engagements.is_flagship is 'The engagement the app opens in full (model, comps, memo, deck). One per organisation.';
create index engagements_org_idx on public.engagements (org_id, updated_at desc);
create unique index engagements_one_flagship_idx on public.engagements (org_id) where is_flagship;

-- ---------------------------------------------------------------------------------------------
-- Runs: one execution of the agent pipeline against a brief
-- ---------------------------------------------------------------------------------------------
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  run_no integer not null,
  status public.run_status not null default 'queued',
  priority boolean not null default false,
  deliverables text[] not null,
  plan jsonb not null default '{}'::jsonb,
  price numeric(12, 2),
  currency text,
  minutes_planned integer,
  started_at timestamptz,
  delivered_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (engagement_id, run_no),
  constraint runs_deliverables_known check (
    cardinality(deliverables) > 0
    and deliverables <@ array['3s', 'dcf', 'lbo', 'comps', 'compet', 'industry', 'memo', 'pitch']::text[]
  )
);
comment on column public.runs.plan is 'Stage timings in simulated minutes, as computed by the start-run edge function.';
create index runs_engagement_idx on public.runs (engagement_id, run_no desc);
create index runs_org_idx on public.runs (org_id);

create table public.run_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references public.runs (id) on delete cascade,
  at_minute numeric(8, 2) not null,
  agent text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index run_events_run_idx on public.run_events (run_id, at_minute);
create index run_events_org_idx on public.run_events (org_id);

-- ---------------------------------------------------------------------------------------------
-- Sources and the evidence trail behind every figure
-- ---------------------------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  slug text not null,
  title text not null,
  publisher text,
  doc_type text,
  format text check (format in ('pdf', 'xls', 'web', 'call', 'mkt')),
  source text,
  published_label text,
  pages_label text,
  cited_count integer not null default 0,
  storage_path text,
  created_at timestamptz not null default now(),
  unique (engagement_id, slug)
);
comment on column public.documents.storage_path is 'Object path in the private "sources" bucket: {org_id}/{engagement_id}/{file}.';
create index documents_org_idx on public.documents (org_id);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  key text not null,
  label text not null,
  value text not null,
  document_id uuid references public.documents (id) on delete set null,
  page_ref text,
  highlight_rows integer[] not null default '{}',
  extract text,
  normalisation text,
  reconciliation text,
  used_in jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (engagement_id, key)
);
comment on table public.evidence is 'One traced figure: its value, the page it came from and every place it is used.';
create index evidence_org_idx on public.evidence (org_id);
create index evidence_document_idx on public.evidence (document_id);

-- ---------------------------------------------------------------------------------------------
-- Outputs: model versions, files and the hallmark
-- ---------------------------------------------------------------------------------------------
create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  version integer not null,
  scenario text not null default 'base' check (scenario in ('base', 'upside', 'downside')),
  wacc numeric(6, 4) not null check (wacc > 0 and wacc < 1),
  terminal_growth numeric(6, 4) not null check (terminal_growth > -0.05 and terminal_growth < 0.1),
  senior_leverage numeric(4, 1),
  entry_multiple numeric(5, 1),
  exit_multiple numeric(5, 1),
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (engagement_id, version)
);
create index model_versions_org_idx on public.model_versions (org_id);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  run_id uuid references public.runs (id) on delete cascade,
  kind text not null check (kind in ('xlsx', 'pptx', 'docx', 'pdf')),
  name text not null,
  description text,
  size_label text,
  storage_path text,
  created_at timestamptz not null default now()
);
comment on column public.files.storage_path is 'Object path in the private "deliverables" bucket: {org_id}/{engagement_id}/{file}.';
create index files_engagement_idx on public.files (engagement_id);
create index files_org_idx on public.files (org_id);
create index files_run_idx on public.files (run_id);

create table public.hallmarks (
  run_id uuid primary key references public.runs (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  fineness integer not null default 999 check (fineness between 0 and 999),
  office_code text not null,
  signed_by_name text not null,
  signed_initials text not null,
  checks_passed integer,
  checks_total integer,
  figures_traced integer,
  figures_total integer,
  signed_at timestamptz not null default now()
);
comment on table public.hallmarks is 'The sign-off stamp on a delivered run: maker, fineness, office and the reviewer who signed.';
create index hallmarks_org_idx on public.hallmarks (org_id);
create index hallmarks_engagement_idx on public.hallmarks (engagement_id);

-- ---------------------------------------------------------------------------------------------
-- Collaboration
-- ---------------------------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  anchor text,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text not null,
  author_title text,
  body text not null check (char_length(body) between 1 and 4000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_engagement_idx on public.comments (engagement_id, created_at);
create index comments_org_idx on public.comments (org_id);
create index comments_parent_idx on public.comments (parent_id);

create table public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid not null references public.engagements (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index copilot_messages_engagement_idx on public.copilot_messages (engagement_id, created_at);
create index copilot_messages_org_idx on public.copilot_messages (org_id);
create index copilot_messages_user_idx on public.copilot_messages (user_id);

-- ---------------------------------------------------------------------------------------------
-- Autopilot: always-on agents, the overnight briefing and the approval queue
-- ---------------------------------------------------------------------------------------------
create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  scope text not null,
  trigger_label text not null,
  schedule_label text not null,
  enabled boolean not null default true,
  runs_count integer not null default 0,
  last_run_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index monitors_org_idx on public.monitors (org_id, position);

create table public.brief_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  kind text not null check (kind in ('price', 'filing', 'earnings')),
  tone text not null default 'info' check (tone in ('info', 'gold', 'warn')),
  agent text not null,
  title text not null,
  body text not null,
  impact text,
  action jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
comment on column public.brief_items.action is 'The primary button: {"label": "...", "view": "engagement", "tab": "compet"}.';
create index brief_items_org_idx on public.brief_items (org_id, position);
create index brief_items_engagement_idx on public.brief_items (engagement_id);

create table public.brief_dismissals (
  brief_id uuid not null references public.brief_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (brief_id, user_id)
);
create index brief_dismissals_user_idx on public.brief_dismissals (user_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  kind text not null check (kind in ('model_update', 'add_peer', 'send_flash', 'other')),
  agent text not null,
  title text not null,
  why text not null,
  diff jsonb not null default '[]'::jsonb,
  status public.approval_status not null default 'pending',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
comment on column public.approvals.diff is 'Rows of [label, before, after] shown to the approver.';
create index approvals_org_status_idx on public.approvals (org_id, status, created_at desc);
create index approvals_engagement_idx on public.approvals (engagement_id);
create index approvals_decided_by_idx on public.approvals (decided_by);

create table public.activity_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  agent text not null,
  message text not null,
  occurred_at timestamptz not null default now()
);
create index activity_log_org_idx on public.activity_log (org_id, occurred_at desc);

-- ---------------------------------------------------------------------------------------------
-- Helper functions used by row-level security.
-- security definer so they can read memberships without recursing through its own policies.
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'analyst', 'reviewer')
  );
$$;

create or replace function public.is_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

-- Turns a storage folder name into a uuid, or null when it is not one.
create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create policy "Members can read their organisations"
  on public.organizations for select to authenticated
  using (public.is_member(id));
create policy "Admins can update their organisation"
  on public.organizations for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create policy "People can read their own profile and their colleagues'"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.org_id = mine.org_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy "People can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Members can see who else is in their organisations"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_member(org_id));
create policy "Admins can add members"
  on public.memberships for insert to authenticated
  with check (public.is_admin(org_id));
create policy "Admins can change roles"
  on public.memberships for update to authenticated
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));
create policy "Admins can remove members"
  on public.memberships for delete to authenticated
  using (public.is_admin(org_id));

-- The same four policies for every organisation-scoped table:
-- members read, editors (everyone but viewers) write, admins delete.
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'engagements', 'runs', 'run_events', 'documents', 'evidence', 'model_versions',
    'files', 'hallmarks', 'monitors', 'brief_items', 'activity_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Members can read" on public.%I for select to authenticated using (public.is_member(org_id))', t);
    execute format(
      'create policy "Editors can add" on public.%I for insert to authenticated with check (public.can_edit(org_id))', t);
    execute format(
      'create policy "Editors can change" on public.%I for update to authenticated using (public.can_edit(org_id)) with check (public.can_edit(org_id))', t);
    execute format(
      'create policy "Admins can delete" on public.%I for delete to authenticated using (public.is_admin(org_id))', t);
  end loop;
end;
$$;

-- Approvals are decided only through decide_approval(), which records who decided and when.
alter table public.approvals enable row level security;
create policy "Members can read approvals"
  on public.approvals for select to authenticated
  using (public.is_member(org_id));
create policy "Editors can raise approvals"
  on public.approvals for insert to authenticated
  with check (public.can_edit(org_id) and status = 'pending');

-- Comments: anyone on the deal team can comment; only the author can edit or delete.
alter table public.comments enable row level security;
create policy "Members can read comments"
  on public.comments for select to authenticated
  using (public.is_member(org_id));
create policy "Editors can comment"
  on public.comments for insert to authenticated
  with check (public.can_edit(org_id) and author_id = (select auth.uid()));
create policy "Authors can edit their comments"
  on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Authors can delete their comments"
  on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- Co-pilot history is private to each user.
alter table public.copilot_messages enable row level security;
create policy "People can read their own co-pilot history"
  on public.copilot_messages for select to authenticated
  using (user_id = (select auth.uid()) and public.is_member(org_id));
create policy "People can add to their own co-pilot history"
  on public.copilot_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(org_id));

-- Dismissing a briefing item only hides it for you.
alter table public.brief_dismissals enable row level security;
create policy "People manage their own dismissals"
  on public.brief_dismissals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.brief_items b where b.id = brief_id and public.is_member(b.org_id))
  );

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger engagements_set_updated_at
  before update on public.engagements
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Starting a run puts its engagement back into the running state.
create or replace function public.on_run_started()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'running' then
    update public.engagements
    set status = 'running', progress = 0
    where id = new.engagement_id;
  end if;
  return new;
end;
$$;

create trigger runs_on_insert
  after insert on public.runs
  for each row execute function public.on_run_started();

-- ---------------------------------------------------------------------------------------------
-- RPCs called by the app
-- ---------------------------------------------------------------------------------------------

-- Adds the signed-in user to every demo workspace. Returns how many were joined.
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
  insert into public.memberships (org_id, user_id, role)
  select o.id, v_user, 'analyst'
  from public.organizations o
  where o.is_demo
  on conflict (org_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Approves or declines an agent's request. Approving a model update saves a new model version.
create or replace function public.decide_approval(p_approval uuid, p_approve boolean)
returns public.approvals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.approvals;
begin
  select * into v_row from public.approvals where id = p_approval for update;
  if not found then
    raise exception 'Approval not found' using errcode = 'P0002';
  end if;
  if not public.can_edit(v_row.org_id) then
    raise exception 'You cannot decide approvals in this workspace' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    return v_row; -- already decided; deciding twice is a no-op
  end if;

  update public.approvals
  set status = case when p_approve then 'approved' else 'declined' end::public.approval_status,
      decided_by = auth.uid(),
      decided_at = now()
  where id = p_approval
  returning * into v_row;

  if p_approve and v_row.kind = 'model_update' and v_row.engagement_id is not null then
    insert into public.model_versions (
      org_id, engagement_id, version, scenario, wacc, terminal_growth,
      senior_leverage, entry_multiple, exit_multiple, note, created_by
    )
    select mv.org_id, mv.engagement_id, mv.version + 1, mv.scenario, mv.wacc, mv.terminal_growth,
           mv.senior_leverage, mv.entry_multiple, mv.exit_multiple, v_row.title, auth.uid()
    from public.model_versions mv
    where mv.engagement_id = v_row.engagement_id
    order by mv.version desc
    limit 1;
  end if;

  insert into public.activity_log (org_id, agent, message)
  values (v_row.org_id, v_row.agent, (case when p_approve then 'Approved: ' else 'Declined: ' end) || v_row.title);

  return v_row;
end;
$$;

revoke execute on function public.join_demo_workspaces() from public, anon;
revoke execute on function public.decide_approval(uuid, boolean) from public, anon;
grant execute on function public.join_demo_workspaces() to authenticated;
grant execute on function public.decide_approval(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Data API access. RLS above decides which rows each user sees; anon gets nothing.
-- ---------------------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------------------------
-- Realtime: the app listens for these changes to keep Autopilot and Home live.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.approvals, public.brief_items, public.engagements, public.runs, public.run_events, public.comments;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Storage: private buckets for source documents and delivered files.
-- Object paths start with the organisation id: {org_id}/{engagement_id}/{file name}.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false), ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

create policy "Members can read their organisation's files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('sources', 'deliverables')
    and public.is_member(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "Editors can upload to their organisation"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('sources', 'deliverables')
    and public.can_edit(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "Admins can delete their organisation's files"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('sources', 'deliverables')
    and public.is_admin(public.try_uuid((storage.foldername(name))[1]))
  );
