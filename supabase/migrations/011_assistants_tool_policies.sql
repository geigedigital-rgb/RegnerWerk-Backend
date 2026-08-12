-- AI Assistants + Tool Policies (TZ §8.2 / §26.15 / §30.8)

create table if not exists public.tool_policies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true
);

drop trigger if exists tool_policies_set_updated_at on public.tool_policies;
create trigger tool_policies_set_updated_at
  before update on public.tool_policies
  for each row execute function public.set_updated_at();

alter table public.tool_policies enable row level security;

create table if not exists public.tool_policy_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tool_policy_id uuid not null references public.tool_policies (id) on delete cascade,
  version int not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'published', 'retired')),
  -- allowlist entries: [{ tool_name, autonomy: auto|confirm|deny, args_schema_note }]
  tools jsonb not null default '[]'::jsonb,
  change_note text,
  published_at timestamptz,
  unique (tool_policy_id, version)
);

drop trigger if exists tool_policy_versions_set_updated_at on public.tool_policy_versions;
create trigger tool_policy_versions_set_updated_at
  before update on public.tool_policy_versions
  for each row execute function public.set_updated_at();

alter table public.tool_policy_versions enable row level security;

create table if not exists public.ai_assistants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  description text,
  role text not null default 'reception'
    check (role in ('reception', 'repair', 'sales', 'service', 'overflow')),
  active boolean not null default true,
  is_default boolean not null default false
);

drop trigger if exists ai_assistants_set_updated_at on public.ai_assistants;
create trigger ai_assistants_set_updated_at
  before update on public.ai_assistants
  for each row execute function public.set_updated_at();

-- Only one default assistant
create unique index if not exists ai_assistants_one_default
  on public.ai_assistants (is_default)
  where is_default = true;

alter table public.ai_assistants enable row level security;

create table if not exists public.ai_assistant_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assistant_id uuid not null references public.ai_assistants (id) on delete cascade,
  version int not null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'published', 'retired')),
  configuration jsonb not null default '{}'::jsonb,
  -- configuration keys:
  -- prompt_release_id, rule_release_id, scenario_release_id,
  -- tool_policy_version_id, model, voice, welcome_message, environment
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  change_note text,
  unique (assistant_id, version)
);

drop trigger if exists ai_assistant_versions_set_updated_at on public.ai_assistant_versions;
create trigger ai_assistant_versions_set_updated_at
  before update on public.ai_assistant_versions
  for each row execute function public.set_updated_at();

create index if not exists ai_assistant_versions_status_idx
  on public.ai_assistant_versions (assistant_id, status);

alter table public.ai_assistant_versions enable row level security;

-- Seed Empfang tool policy (align with voice-gateway tools)
insert into public.tool_policies (code, name, description) values
  ('empfang_default', 'Empfang Default Tools', 'Allowlist für RegnerWerk Empfang (TZ §30.8 subset)')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.tool_policy_versions (tool_policy_id, version, status, tools, change_note, published_at)
select p.id, 1, 'published',
  '[
    {"tool_name":"capture_recording_consent","autonomy":"auto","args_schema_note":"granted boolean"},
    {"tool_name":"upsert_call_fact","autonomy":"auto","args_schema_note":"fieldKey + value"},
    {"tool_name":"create_callback_task","autonomy":"auto","args_schema_note":"window + summary"},
    {"tool_name":"escalate_call","autonomy":"auto","args_schema_note":"reason enum — server picks target"},
    {"tool_name":"finalize_call_outcome","autonomy":"auto","args_schema_note":"outcome enum"},
    {"tool_name":"lookup_knowledge","autonomy":"auto","args_schema_note":"query — server returns published articles"},
    {"tool_name":"transfer_call","autonomy":"deny","args_schema_note":"use escalate_call instead — no arbitrary numbers"},
    {"tool_name":"promise_price","autonomy":"deny","args_schema_note":"never"},
    {"tool_name":"promise_montage_date","autonomy":"deny","args_schema_note":"never"}
  ]'::jsonb,
  'Initial seed',
  now()
from public.tool_policies p
where p.code = 'empfang_default'
  and not exists (
    select 1 from public.tool_policy_versions v
    where v.tool_policy_id = p.id and v.version = 1
  );

-- Seed default Empfang assistant
insert into public.ai_assistants (code, name, description, role, is_default) values
  ('empfang', 'RegnerWerk Empfang', 'Primärer Telefon-Assistent: Triage, Qualifikation, Transfer', 'reception', true),
  ('reparatur', 'Reparatur-Triage', 'Handoff für Störungen und Leckagen', 'repair', false),
  ('neuanlage', 'Neuanlage-Qualifikation', 'Handoff für neue Anlagen', 'sales', false)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  role = excluded.role;

insert into public.ai_assistant_versions (
  assistant_id, version, status, configuration, change_note, published_at
)
select a.id, 1, 'draft',
  jsonb_build_object(
    'environment', 'production',
    'model', 'gpt-realtime',
    'voice', 'alloy',
    'welcome_message', 'Guten Tag bei RegnerWerk. Sie sprechen mit unserem digitalen KI-Assistenten. Ich nehme Ihr Anliegen für unser Team auf. Möchten Sie, dass wir das Gespräch zur Bearbeitung aufzeichnen und transkribieren?',
    'use_active_prompt_release', true,
    'use_active_rule_release', true,
    'use_active_scenario_release', true,
    'tool_policy_code', 'empfang_default',
    'handoff_codes', case a.code
      when 'empfang' then '["reparatur","neuanlage"]'::jsonb
      else '[]'::jsonb
    end
  ),
  'Initial draft',
  null
from public.ai_assistants a
where not exists (
  select 1 from public.ai_assistant_versions v
  where v.assistant_id = a.id and v.version = 1
);
