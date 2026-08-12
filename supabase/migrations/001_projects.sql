-- RegnerWerk projects + private PDF storage
-- Apply once in Supabase SQL Editor (Dashboard → SQL).
-- Storage bucket `project-pdfs` may already exist (created via API).

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('submitted', 'draft')),
  place_id text not null default '',
  place_label text not null default '',
  customer_email text,
  customer_name text,
  payload jsonb not null default '{}'::jsonb,
  pdf_path text,
  parent_id uuid references public.projects (id) on delete set null
);

create index if not exists projects_created_at_desc on public.projects (created_at desc);
create index if not exists projects_place_id on public.projects (place_id);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_projects_updated_at();

alter table public.projects enable row level security;

-- No anon/authenticated policies: only service role (Backend) can access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-pdfs',
  'project-pdfs',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
