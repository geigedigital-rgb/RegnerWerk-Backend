-- CRM Service cases (TZ §7.7 / §26.10)
-- Non-destructive; no change to Sofort public.projects

create table if not exists public.service_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  irrigation_system_id uuid,
  source_lead_id uuid references public.leads (id) on delete set null,
  source_call_id uuid,
  source_inbox_item_id uuid references public.inbox_items (id) on delete set null,
  type text not null default 'repair'
    check (type in (
      'repair', 'extension', 'maintenance', 'winterization',
      'spring_start', 'first_season', 'other'
    )),
  status text not null default 'new'
    check (status in (
      'new', 'triage', 'scheduled', 'in_progress',
      'waiting_customer', 'waiting_parts', 'resolved', 'closed'
    )),
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  problem_description text not null default '',
  safety_flags text[] not null default '{}',
  owner_id uuid,
  scheduled_at timestamptz,
  resolved_at timestamptz,
  resolution_summary text,
  next_action text,
  next_action_due_at timestamptz,
  case_number text not null,
  title text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists service_cases_number_uidx
  on public.service_cases (case_number);
create index if not exists service_cases_status_updated_idx
  on public.service_cases (status, updated_at desc);
create index if not exists service_cases_contact_idx
  on public.service_cases (contact_id);
create index if not exists service_cases_urgent_open_idx
  on public.service_cases (urgency, created_at desc)
  where status not in ('resolved', 'closed');

drop trigger if exists service_cases_set_updated_at on public.service_cases;
create trigger service_cases_set_updated_at
  before update on public.service_cases
  for each row execute function public.set_updated_at();

alter table public.service_cases enable row level security;
