-- ---------------------------------------------------------------------------------------------
-- Filing desk runs: a filing read into a checked model, saved so a team can reopen it, and every
-- recalculation or correction kept as a version.
--
-- The run row holds the extraction (statement rows, the model's row mapping, analyst corrections and
-- assumptions). The PDF and its page text live in the private `sources` bucket under
-- {org_id}/desk/{run_id}.pdf and {org_id}/desk/{run_id}.texts.json, so the existing storage rules apply.
-- Outputs (.xlsx, .docx) are rebuilt from the saved run, so they are not stored.
-- ---------------------------------------------------------------------------------------------

create table public.desk_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  company text not null default '',
  file_name text not null default '',
  sector text not null default 'corporate',
  summary jsonb not null default '{}'::jsonb,
  record jsonb not null,
  pdf_path text,
  texts_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.desk_runs is 'Filing desk runs: extraction, corrections and assumptions for a filing.';
create index desk_runs_org_updated on public.desk_runs (org_id, updated_at desc);

-- Versions are append-only: nobody can change or remove one, except by deleting the whole run.
create table public.desk_run_versions (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.desk_runs (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  n integer not null,
  note text not null default '',
  by_name text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  summary jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, n)
);
comment on table public.desk_run_versions is 'Each build or recalculation of a Filing desk run, with who did it and why.';

-- A version must belong to the same organisation as its run.
create or replace function public.desk_version_org_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.desk_runs r where r.id = new.run_id and r.org_id = new.org_id) then
    raise exception 'Version organisation does not match its run';
  end if;
  return new;
end;
$$;

create trigger desk_run_versions_org
  before insert on public.desk_run_versions
  for each row execute function public.desk_version_org_matches();

create trigger desk_runs_set_updated_at
  before update on public.desk_runs
  for each row execute function public.set_updated_at();

alter table public.desk_runs enable row level security;
create policy "Members can read desk runs"
  on public.desk_runs for select to authenticated
  using (public.is_member(org_id));
create policy "Editors can add desk runs"
  on public.desk_runs for insert to authenticated
  with check (public.can_edit(org_id));
create policy "Editors can change desk runs"
  on public.desk_runs for update to authenticated
  using (public.can_edit(org_id))
  with check (public.can_edit(org_id));
create policy "Admins can delete desk runs"
  on public.desk_runs for delete to authenticated
  using (public.is_admin(org_id));

alter table public.desk_run_versions enable row level security;
create policy "Members can read desk run versions"
  on public.desk_run_versions for select to authenticated
  using (public.is_member(org_id));
create policy "Editors can add desk run versions"
  on public.desk_run_versions for insert to authenticated
  with check (public.can_edit(org_id));
