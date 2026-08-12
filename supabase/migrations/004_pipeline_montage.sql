-- CRM Pipeline + Montage projects (TZ Stage 3)
-- Sofort table public.projects is NOT modified.

-- ─── pipeline stages (dictionary) ───────────────────────────────────────────
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  label_de text not null,
  sort_order int not null default 0,
  is_terminal boolean not null default false,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  active boolean not null default true
);

alter table public.pipeline_stages enable row level security;

insert into public.pipeline_stages (code, label_de, sort_order, is_terminal, is_won, is_lost)
values
  ('qualification', 'Qualifikation', 10, false, false, false),
  ('site_visit_requested', 'Vor-Ort angefragt', 20, false, false, false),
  ('site_visit_scheduled', 'Vor-Ort terminiert', 30, false, false, false),
  ('planning', 'Planung', 40, false, false, false),
  ('offer_preparation', 'Angebot Vorbereitung', 50, false, false, false),
  ('offer_sent', 'Angebot gesendet', 60, false, false, false),
  ('follow_up', 'Nachfassen', 70, false, false, false),
  ('won', 'Gewonnen', 80, true, true, false),
  ('lost', 'Verloren', 90, true, false, true)
on conflict (code) do update set
  label_de = excluded.label_de,
  sort_order = excluded.sort_order,
  is_terminal = excluded.is_terminal,
  is_won = excluded.is_won,
  is_lost = excluded.is_lost,
  active = true;

-- ─── opportunities ──────────────────────────────────────────────────────────
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid references public.leads (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  service_type text,
  stage_id uuid not null references public.pipeline_stages (id),
  owner_id uuid,
  amount_min_minor int,
  amount_max_minor int,
  currency text not null default 'EUR',
  expected_close_date date,
  next_action text,
  next_action_due_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  loss_reason text,
  loss_note text,
  title text,
  summary text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists opportunities_stage_updated_idx
  on public.opportunities (stage_id, updated_at desc);
create index if not exists opportunities_contact_idx
  on public.opportunities (contact_id);
create index if not exists opportunities_lead_idx
  on public.opportunities (lead_id);

drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;

-- Link lead → converted opportunity
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'converted_opportunity_id'
  ) then
    alter table public.leads
      add column converted_opportunity_id uuid
      references public.opportunities (id) on delete set null;
  end if;
end $$;

-- ─── stage history (append-only) ────────────────────────────────────────────
create table if not exists public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages (id),
  to_stage_id uuid not null references public.pipeline_stages (id),
  changed_by_actor_type text not null default 'employee'
    check (changed_by_actor_type in ('customer', 'employee', 'ai', 'system')),
  changed_by_actor_id text,
  reason text,
  automation_run_id uuid
);

create index if not exists opportunity_stage_history_opp_idx
  on public.opportunity_stage_history (opportunity_id, created_at desc);

alter table public.opportunity_stage_history enable row level security;

-- ─── montage projects (CRM installs — NOT Sofort projects) ──────────────────
create table if not exists public.montage_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opportunity_id uuid references public.opportunities (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  status text not null default 'handover'
    check (status in (
      'handover', 'planning', 'scheduled', 'installation',
      'commissioning', 'documentation', 'first_season',
      'completed', 'paused', 'cancelled'
    )),
  project_number text not null,
  name text not null default '',
  scope_summary text,
  project_manager_id uuid,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  next_action text,
  next_action_due_at timestamptz,
  warranty_or_service_notes text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists montage_projects_number_uidx
  on public.montage_projects (project_number);
create index if not exists montage_projects_status_idx
  on public.montage_projects (status, updated_at desc);

drop trigger if exists montage_projects_set_updated_at on public.montage_projects;
create trigger montage_projects_set_updated_at
  before update on public.montage_projects
  for each row execute function public.set_updated_at();

alter table public.montage_projects enable row level security;
