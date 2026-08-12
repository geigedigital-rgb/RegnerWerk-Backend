-- Stage 5: phone calls + telephony settings (TZ §26.14 / §8.4)
-- No recording columns required for this slice beyond consent status stubs.

create table if not exists public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  direction text not null default 'inbound'
    check (direction in ('inbound', 'outbound')),
  provider text not null default 'openai_realtime',
  provider_call_sid text,
  provider_parent_call_sid text,
  sip_call_id text,
  openai_realtime_call_id text,
  correlation_id text not null default gen_random_uuid()::text,
  from_number_e164 text,
  to_number_e164 text,
  from_number_raw text,
  contact_id uuid references public.contacts (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  montage_project_id uuid references public.montage_projects (id) on delete set null,
  service_case_id uuid references public.service_cases (id) on delete set null,
  match_status text not null default 'unknown'
    check (match_status in (
      'unknown', 'matched', 'ambiguous', 'new', 'hidden', 'blocked'
    )),
  status text not null default 'ringing'
    check (status in (
      'ringing', 'accepted', 'in_progress', 'transferring', 'transferred',
      'completed', 'failed', 'abandoned', 'fallback'
    )),
  outcome text
    check (outcome is null or outcome in (
      'qualified_lead', 'callback_scheduled', 'transferred', 'info_only',
      'spam_candidate', 'disconnected', 'failed', 'abandoned'
    )),
  request_type text,
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  ai_mode text not null default 'full_ai'
    check (ai_mode in ('full_ai', 'supervised', 'human_only', 'after_hours', 'overflow')),
  assistant_code text,
  assistant_version_id uuid,
  prompt_release_id uuid,
  rules_release_id uuid,
  scenarios_release_id uuid,
  model text,
  voice text,
  recording_consent_status text not null default 'pending'
    check (recording_consent_status in (
      'pending', 'granted', 'denied', 'not_required', 'unknown'
    )),
  transcription_consent_status text not null default 'pending'
    check (transcription_consent_status in (
      'pending', 'granted', 'denied', 'not_required', 'unknown'
    )),
  recording_status text not null default 'none'
    check (recording_status in ('none', 'starting', 'active', 'stopped', 'failed')),
  transcript_status text not null default 'none'
    check (transcript_status in ('none', 'live', 'finalizing', 'ready', 'failed')),
  summary text,
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'reviewed', 'flagged', 'training_candidate')),
  error_code text,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists phone_calls_set_updated_at on public.phone_calls;
create trigger phone_calls_set_updated_at
  before update on public.phone_calls
  for each row execute function public.set_updated_at();

create unique index if not exists phone_calls_provider_sid_uidx
  on public.phone_calls (provider, provider_call_sid)
  where provider_call_sid is not null;

create unique index if not exists phone_calls_openai_uidx
  on public.phone_calls (openai_realtime_call_id)
  where openai_realtime_call_id is not null;

create unique index if not exists phone_calls_correlation_uidx
  on public.phone_calls (correlation_id);

create index if not exists phone_calls_status_idx on public.phone_calls (status);
create index if not exists phone_calls_created_idx on public.phone_calls (created_at desc);
create index if not exists phone_calls_from_idx on public.phone_calls (from_number_e164);

alter table public.phone_calls enable row level security;

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_id uuid not null references public.phone_calls (id) on delete cascade,
  event_type text not null,
  sequence int not null default 0,
  occurred_at timestamptz not null default now(),
  provider_event_id text,
  payload_redacted jsonb not null default '{}'::jsonb
);

create index if not exists call_events_call_idx
  on public.call_events (call_id, sequence);

alter table public.call_events enable row level security;

create table if not exists public.telephony_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text
);

drop trigger if exists telephony_settings_set_updated_at on public.telephony_settings;
create trigger telephony_settings_set_updated_at
  before update on public.telephony_settings
  for each row execute function public.set_updated_at();

alter table public.telephony_settings enable row level security;

insert into public.telephony_settings (key, value, description) values
  ('pilot_mode', '"after_hours"'::jsonb, 'full | after_hours | overflow | off'),
  ('test_number_e164', 'null'::jsonb, 'Twilio test number E.164'),
  ('production_number_e164', 'null'::jsonb, 'Production DID'),
  ('transfer_office_e164', 'null'::jsonb, 'Büro transfer target'),
  ('transfer_emergency_e164', 'null'::jsonb, 'Notfall transfer target'),
  ('business_hours', '{"tz":"Europe/Berlin","weekdays":[{"days":[1,2,3,4,5],"start":"08:00","end":"17:00"}]}'::jsonb, 'Office hours'),
  ('fallback_policy', '{"on_ai_failure":"create_callback_task","on_transfer_failure":"create_callback_task"}'::jsonb, 'Fallback actions'),
  ('recording_enabled', 'false'::jsonb, 'Stage 6 — keep false until consent legal gate'),
  ('webhook_health', '{"openai":"unknown","twilio":"unknown","last_check_at":null}'::jsonb, 'Provider health snapshot')
on conflict (key) do nothing;
