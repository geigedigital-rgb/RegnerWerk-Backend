-- Website form submissions (TZ §26.7) — idempotent public lead intake
create table if not exists public.web_form_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submission_id text not null,
  form_type text not null
    check (form_type in ('contact', 'calculator', 'repair', 'service', 'projekt_anfrage', 'other')),
  schema_version text not null default '2026-08-12',
  received_at timestamptz not null default now(),
  payload_sanitized jsonb not null default '{}'::jsonb,
  landing_page text,
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent_class text,
  captcha_result text,
  processing_status text not null default 'received'
    check (processing_status in (
      'received', 'processed', 'duplicate', 'rejected', 'error'
    )),
  error_code text,
  reference_code text not null,
  inbox_item_id uuid references public.inbox_items (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null
);

create unique index if not exists web_form_submissions_submission_id_uidx
  on public.web_form_submissions (submission_id);

create index if not exists web_form_submissions_received_at_desc
  on public.web_form_submissions (received_at desc);

drop trigger if exists web_form_submissions_set_updated_at on public.web_form_submissions;
create trigger web_form_submissions_set_updated_at
  before update on public.web_form_submissions
  for each row execute function public.set_updated_at();

alter table public.web_form_submissions enable row level security;
