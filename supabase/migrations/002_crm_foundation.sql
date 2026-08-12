-- RegnerWerk CRM foundation (TZ Stage 1 / vertical slice)
-- Non-destructive: does not alter public.projects (Sofort-Konfigurator).
-- Access pattern: RLS on, no anon/authenticated policies → service role only.

create extension if not exists "pgcrypto";

-- Shared updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── contacts ───────────────────────────────────────────────────────────────
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null default 'person'
    check (kind in ('person', 'company')),
  first_name text,
  last_name text,
  company_name text,
  display_name text not null default '',
  preferred_language text not null default 'de',
  customer_status text not null default 'lead'
    check (customer_status in ('lead', 'active', 'inactive', 'archived')),
  do_not_contact boolean not null default false,
  notes_public text,
  notes_internal_sensitive text,
  merged_into_contact_id uuid references public.contacts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists contacts_display_name_idx
  on public.contacts (display_name);
create index if not exists contacts_updated_at_desc
  on public.contacts (updated_at desc);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

-- ─── contact_channels ───────────────────────────────────────────────────────
create table if not exists public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type text not null check (type in ('phone', 'email')),
  value_raw text not null,
  value_normalized text not null,
  label text,
  is_primary boolean not null default false,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists contact_channels_contact_id_idx
  on public.contact_channels (contact_id);
create index if not exists contact_channels_phone_lookup_idx
  on public.contact_channels (value_normalized)
  where type = 'phone';
create index if not exists contact_channels_email_lookup_idx
  on public.contact_channels (lower(value_normalized))
  where type = 'email';

drop trigger if exists contact_channels_set_updated_at on public.contact_channels;
create trigger contact_channels_set_updated_at
  before update on public.contact_channels
  for each row execute function public.set_updated_at();

alter table public.contact_channels enable row level security;

-- ─── properties (objects / gardens) ─────────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid references public.contacts (id) on delete set null,
  label text,
  street text,
  house_number text,
  postal_code text,
  city text,
  country text not null default 'DE',
  property_type text,
  garden_area_m2 numeric,
  lawn_area_m2 numeric,
  water_source text,
  access_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists properties_contact_id_idx
  on public.properties (contact_id);
create index if not exists properties_postal_code_idx
  on public.properties (postal_code);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

alter table public.properties enable row level security;

-- ─── inbox_items ────────────────────────────────────────────────────────────
create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_type text not null
    check (source_type in (
      'website', 'ai_call', 'phone', 'missed_call', 'manual', 'import', 'other'
    )),
  source_id text,
  status text not null default 'open'
    check (status in (
      'open', 'in_progress', 'accepted', 'linked', 'deferred',
      'spam', 'rejected', 'resolved'
    )),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  suggested_contact_id uuid references public.contacts (id) on delete set null,
  matched_confidence text
    check (matched_confidence is null or matched_confidence in (
      'exact', 'high', 'medium', 'low'
    )),
  summary text not null default '',
  request_type text
    check (request_type is null or request_type in (
      'new_installation', 'repair', 'extension', 'maintenance',
      'winterization', 'component_purchase', 'commercial', 'other', 'spam'
    )),
  contact_name text,
  contact_phone text,
  contact_email text,
  postal_code text,
  payload jsonb not null default '{}'::jsonb,
  assigned_to uuid,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  duplicate_of_id uuid references public.inbox_items (id) on delete set null,
  lead_id uuid
);

create index if not exists inbox_items_status_created_idx
  on public.inbox_items (status, created_at desc);
create index if not exists inbox_items_open_idx
  on public.inbox_items (created_at desc)
  where status in ('open', 'in_progress', 'deferred');

drop trigger if exists inbox_items_set_updated_at on public.inbox_items;
create trigger inbox_items_set_updated_at
  before update on public.inbox_items
  for each row execute function public.set_updated_at();

alter table public.inbox_items enable row level security;

-- ─── leads ──────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  inbox_item_id uuid references public.inbox_items (id) on delete set null,
  source text not null default 'manual',
  request_type text
    check (request_type is null or request_type in (
      'new_installation', 'repair', 'extension', 'maintenance',
      'winterization', 'component_purchase', 'commercial', 'other', 'spam'
    )),
  status text not null default 'new'
    check (status in (
      'new', 'needs_review', 'contact_pending', 'contacted',
      'qualified', 'unqualified', 'converted', 'archived'
    )),
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  description_original text,
  summary_current text,
  owner_id uuid,
  next_action text,
  next_action_due_at timestamptz,
  qualification_result text,
  unqualified_reason text,
  last_contact_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists leads_status_updated_idx
  on public.leads (status, updated_at desc);
create index if not exists leads_contact_id_idx
  on public.leads (contact_id);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Back-reference from inbox → lead (added after leads exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inbox_items_lead_id_fkey'
  ) then
    alter table public.inbox_items
      add constraint inbox_items_lead_id_fkey
      foreign key (lead_id) references public.leads (id) on delete set null;
  end if;
end $$;

-- ─── timeline_events ────────────────────────────────────────────────────────
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  type text not null,
  actor_type text not null default 'system'
    check (actor_type in ('customer', 'employee', 'ai', 'system')),
  actor_id text,
  source text,
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  contact_id uuid references public.contacts (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  inbox_item_id uuid references public.inbox_items (id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  visibility text not null default 'internal'
    check (visibility in ('internal', 'shared', 'restricted'))
);

create index if not exists timeline_events_contact_occurred_idx
  on public.timeline_events (contact_id, occurred_at desc);
create index if not exists timeline_events_lead_occurred_idx
  on public.timeline_events (lead_id, occurred_at desc);

alter table public.timeline_events enable row level security;

-- ─── tasks ──────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  description text,
  type text not null default 'follow_up'
    check (type in (
      'follow_up', 'callback', 'meeting', 'site_visit',
      'internal', 'service', 'other'
    )),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid,
  due_at timestamptz,
  completed_at timestamptz,
  created_by_actor_type text not null default 'employee'
    check (created_by_actor_type in ('customer', 'employee', 'ai', 'system')),
  related_contact_id uuid references public.contacts (id) on delete set null,
  related_lead_id uuid references public.leads (id) on delete set null,
  related_inbox_item_id uuid references public.inbox_items (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists tasks_status_due_idx
  on public.tasks (status, due_at);
create index if not exists tasks_contact_idx
  on public.tasks (related_contact_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- ─── private storage bucket for future CRM docs (empty shell) ───────────────
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'customer-documents-private',
  'customer-documents-private',
  false,
  52428800
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
