-- Rules & Stop Triggers (TZ §16)
-- Server-side evaluation; critical rules cannot be disabled without Owner.

create table if not exists public.rule_definitions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  category text not null
    check (category in (
      'human_request', 'emergency_water', 'complaint', 'legal', 'privacy',
      'aggression', 'existing_conflict', 'sales_spam', 'unsupported_request',
      'sensitive_data', 'repeated_misunderstanding'
    )),
  match_type text not null default 'keyword'
    check (match_type in ('exact', 'keyword', 'regex', 'semantic')),
  pattern text not null,
  language text not null default 'de',
  priority int not null default 100,
  action_type text not null
    check (action_type in (
      'stop_questionnaire', 'mark_urgent', 'create_task', 'notify_role',
      'transfer_call', 'request_human_approval', 'disable_recording',
      'block_tool', 'end_call_politely', 'add_review_flag'
    )),
  action_payload jsonb not null default '{}'::jsonb,
  fallback text,
  critical boolean not null default false,
  enabled boolean not null default true,
  test_phrases text[] not null default '{}',
  change_note text
);

drop trigger if exists rule_definitions_set_updated_at on public.rule_definitions;
create trigger rule_definitions_set_updated_at
  before update on public.rule_definitions
  for each row execute function public.set_updated_at();

create index if not exists rule_definitions_priority_idx
  on public.rule_definitions (priority asc, enabled);

alter table public.rule_definitions enable row level security;

create table if not exists public.rule_releases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null default 'production'
    check (environment in ('development', 'staging', 'production')),
  label text,
  compiled_snapshot jsonb not null default '[]'::jsonb,
  compiled_hash text not null,
  change_comment text,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  is_active boolean not null default false
);

create unique index if not exists rule_releases_one_active_per_env
  on public.rule_releases (environment)
  where is_active = true and retired_at is null;

alter table public.rule_releases enable row level security;

insert into public.rule_definitions (
  code, name, category, match_type, pattern, priority, action_type, action_payload,
  critical, enabled, test_phrases, change_note
) values
  ('human_mitarbeiter', 'Bitte um Mitarbeiter', 'human_request', 'keyword',
   'mitarbeiter|chef|persönlicher ansprechpartner|sofort verbinden|nicht mit einer maschine',
   10, 'transfer_call', '{"reason":"human_request"}'::jsonb, true, true,
   array['Ich möchte einen Mitarbeiter sprechen', 'Verbinden Sie mich mit dem Chef'],
   'seed'),
  ('emergency_water', 'Rohrbruch / Wasserschaden', 'emergency_water', 'keyword',
   'rohrbruch|wasserschaden|notfall|wasseraustritt|leitung geplatzt',
   5, 'mark_urgent', '{"reason":"emergency_water","also":"transfer_call"}'::jsonb, true, true,
   array['Wir haben einen Rohrbruch', 'Notfall Wasserschaden'],
   'seed'),
  ('legal_anwalt', 'Anwalt / rechtlich', 'legal', 'keyword',
   'anwalt|rechtsanwalt|klage|gericht',
   15, 'transfer_call', '{"reason":"legal"}'::jsonb, true, true,
   array['Mein Anwalt meldet sich', 'Das geht vor Gericht'],
   'seed'),
  ('privacy_datenschutz', 'Datenschutz', 'privacy', 'keyword',
   'datenschutz|dsgvo|meine daten löschen|auskunft personenbezogen',
   20, 'transfer_call', '{"reason":"privacy"}'::jsonb, true, true,
   array['Datenschutz Auskunft', 'Löschen Sie meine Daten'],
   'seed'),
  ('complaint', 'Beschwerde', 'complaint', 'keyword',
   'beschwerde|reklamation|unzufrieden|schlecht gearbeitet',
   30, 'transfer_call', '{"reason":"complaint"}'::jsonb, true, true,
   array['Ich habe eine Beschwerde', 'Das war eine Reklamation'],
   'seed'),
  ('aggression', 'Aggression', 'aggression', 'keyword',
   'idiot|betrug|scheiß|zum teufel',
   8, 'end_call_politely', '{"reason":"aggression"}'::jsonb, true, true,
   array['Ihr seid Betrüger'],
   'seed'),
  ('sales_spam', 'Sales spam', 'sales_spam', 'keyword',
   'seo angebot|google ads|versicherungsberatung|photovoltaik verkauf',
   80, 'end_call_politely', '{"reason":"sales_spam"}'::jsonb, false, true,
   array['Wir bieten SEO an'],
   'seed')
on conflict (code) do update set
  name = excluded.name,
  pattern = excluded.pattern,
  priority = excluded.priority,
  action_type = excluded.action_type,
  action_payload = excluded.action_payload,
  critical = excluded.critical,
  test_phrases = excluded.test_phrases;
