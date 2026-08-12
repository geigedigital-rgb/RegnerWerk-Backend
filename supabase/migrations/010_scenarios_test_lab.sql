-- Scenarios (TZ §15) + Test Lab cases (TZ §18 text mode)

create table if not exists public.scenario_definitions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  description text,
  intent_hints text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  required_fields text[] not null default '{}',
  forbidden_actions text[] not null default '{}',
  stop_on_rules text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'published', 'retired')),
  priority int not null default 100,
  active boolean not null default true,
  change_note text
);

drop trigger if exists scenario_definitions_set_updated_at on public.scenario_definitions;
create trigger scenario_definitions_set_updated_at
  before update on public.scenario_definitions
  for each row execute function public.set_updated_at();

alter table public.scenario_definitions enable row level security;

create table if not exists public.scenario_releases (
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

create unique index if not exists scenario_releases_one_active_per_env
  on public.scenario_releases (environment)
  where is_active = true and retired_at is null;

alter table public.scenario_releases enable row level security;

-- Test Lab cases (text simulation)
create table if not exists public.test_lab_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  persona text,
  crm_context jsonb not null default '{}'::jsonb,
  customer_phrases text[] not null default '{}',
  expected_intent text,
  expected_fields text[] not null default '{}',
  forbidden_actions text[] not null default '{}',
  expected_stop_rule text,
  expected_outcome text,
  critical boolean not null default false,
  active boolean not null default true,
  tags text[] not null default '{}'
);

drop trigger if exists test_lab_cases_set_updated_at on public.test_lab_cases;
create trigger test_lab_cases_set_updated_at
  before update on public.test_lab_cases
  for each row execute function public.set_updated_at();

alter table public.test_lab_cases enable row level security;

create table if not exists public.test_lab_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  case_id uuid references public.test_lab_cases (id) on delete set null,
  triggered_by uuid references public.profiles (id) on delete set null,
  mode text not null default 'text'
    check (mode in ('text', 'browser_voice', 'phone', 'regression')),
  passed boolean not null,
  results jsonb not null default '{}'::jsonb,
  duration_ms int
);

alter table public.test_lab_runs enable row level security;

-- Default conversation steps template
-- Seed mandatory scenarios (TZ §15.2)
insert into public.scenario_definitions (
  code, name, description, intent_hints, steps, required_fields, forbidden_actions, stop_on_rules, status, priority
) values
  ('new_system', 'Neuer Kunde – neue Anlage', 'Neuanlage qualifizieren',
   array['neuanlage','neue bewässerung','sofort','individuell'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['name','phone','postal_code','property_type','water_source'],
   array['promise_price','promise_montage_date'],
   array[]::text[], 'published', 20),
  ('existing_customer', 'Bestehender Kunde', 'Bekannten Kunden erkennen und Anliegen klären',
   array['bestehender kunde','meine anlage','wieder'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['phone','intent'],
   array['promise_price'],
   array[]::text[], 'published', 25),
  ('repair', 'Reparatur', 'Störung / Defekt',
   array['reparatur','defekt','funktioniert nicht','regner'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['name','phone','postal_code','symptom'],
   array['promise_price','promise_montage_date'],
   array[]::text[], 'published', 30),
  ('active_leak', 'Aktive Leckage / Rohrbruch', 'Notfall Wasser',
   array['rohrbruch','wasserschaden','leck','notfall'],
   '["identify","ai_disclosure","mark_urgent","collect_fields","transfer_or_task","summarize","close"]'::jsonb,
   array['name','phone','postal_code','symptom'],
   array['promise_price','continue_normal_sales'],
   array['emergency_water'], 'published', 5),
  ('extension', 'Erweiterung', 'Bestehende Anlage erweitern',
   array['erweiterung','mehr kreise','zusätzlich'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['name','phone','postal_code'],
   array['promise_price'],
   array[]::text[], 'published', 35),
  ('maintenance', 'Wartung', 'Saison / Wartung',
   array['wartung','service','saisonstart'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['name','phone','postal_code'],
   array['promise_price'],
   array[]::text[], 'published', 40),
  ('winterization', 'Einwinterung', 'Winterfestmachung',
   array['einwinterung','winterfest','frost'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['name','phone','postal_code'],
   array['promise_price','promise_montage_date'],
   array[]::text[], 'published', 45),
  ('parts_request', 'Komponentenanfrage', 'Einzelteile / Regner / Ventile',
   array['regner kaufen','ventil','steuerung','teil'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","next_action","summarize","close"]'::jsonb,
   array['name','phone','part_interest'],
   array['promise_price'],
   array[]::text[], 'published', 50),
  ('commercial', 'Gewerbeobjekt', 'Kommerziell / größer',
   array['gewerbe','firma','hotel','golf'],
   '["identify","ai_disclosure","consent","open_question","detect_intent","collect_fields","confirm","next_action","summarize","close"]'::jsonb,
   array['name','phone','company','postal_code'],
   array['promise_price'],
   array[]::text[], 'published', 55),
  ('human_request', 'Bitte um Menschen', 'Sofort Transfer vorbereiten',
   array['mitarbeiter','mensch','chef'],
   '["identify","stop_questionnaire","transfer"]'::jsonb,
   array['name','phone'],
   array['continue_qualification'],
   array['human_mitarbeiter'], 'published', 8),
  ('complaint', 'Beschwerde', 'Reklamation',
   array['beschwerde','reklamation'],
   '["identify","stop_questionnaire","transfer"]'::jsonb,
   array['name','phone'],
   array['argue','promise_price'],
   array['complaint'], 'published', 12),
  ('privacy', 'Datenschutz', 'DSGVO / Auskunft',
   array['datenschutz','dsgvo'],
   '["identify","stop_questionnaire","transfer"]'::jsonb,
   array['name','phone'],
   array['give_legal_advice'],
   array['privacy_datenschutz'], 'published', 10),
  ('lawyer', 'Anwalt / rechtlich', 'Legal escalation',
   array['anwalt','klage'],
   '["identify","stop_questionnaire","transfer"]'::jsonb,
   array['name','phone'],
   array['admit_liability'],
   array['legal_anwalt'], 'published', 9),
  ('spam', 'Spam / Verkauf', 'Höflich beenden',
   array['seo','ads','versicherung'],
   '["identify","end_politely"]'::jsonb,
   array[]::text[],
   array['engage_sales_pitch'],
   array['sales_spam'], 'published', 90),
  ('unknown_intent', 'Unklarer Intent', 'Nachfragen, nicht raten',
   array['unbekannt','unklar'],
   '["identify","ai_disclosure","consent","open_question","clarify","next_action","summarize","close"]'::jsonb,
   array['name','phone'],
   array['guess_intent','promise_price'],
   array[]::text[], 'published', 80),
  ('call_drop', 'Gesprächsabbruch', 'Minimal speichern',
   array['abbruch','unterbrochen'],
   '["save_partial","create_callback_task"]'::jsonb,
   array['phone'],
   array[]::text[],
   array[]::text[], 'published', 95),
  ('transfer_failed', 'Transfer fehlgeschlagen', 'Fallback Aufgabe',
   array['transfer failed'],
   '["apologize","create_callback_task","summarize","close"]'::jsonb,
   array['name','phone'],
   array[]::text[],
   array[]::text[], 'published', 96),
  ('recording_declined', 'Aufnahme abgelehnt', 'Ohne Recording fortfahren',
   array['keine aufnahme','nicht aufzeichnen'],
   '["acknowledge","continue_without_recording","open_question"]'::jsonb,
   array[]::text[],
   array['force_recording'],
   array[]::text[], 'published', 15)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  intent_hints = excluded.intent_hints,
  steps = excluded.steps,
  required_fields = excluded.required_fields,
  forbidden_actions = excluded.forbidden_actions,
  stop_on_rules = excluded.stop_on_rules,
  priority = excluded.priority;

-- Critical regression cases (TZ §18.3 subset for text mode)
insert into public.test_lab_cases (
  code, name, persona, customer_phrases, expected_intent, expected_stop_rule,
  expected_outcome, forbidden_actions, critical, tags
) values
  ('unknown_new_customer', 'Unbekannter Neukunde', 'Privat, PLZ 80331',
   array['Hallo, ich brauche eine neue Bewässerung für meinen Garten in München'],
   'new_system', null, 'qualify_and_callback',
   array['promise_price','promise_montage_date'], true,
   array['regression','sales']),
  ('human_request', 'Bitte um Mitarbeiter', 'Ungeduldig',
   array['Ich möchte bitte einen Mitarbeiter sprechen'],
   'human_request', 'human_mitarbeiter', 'transfer',
   array['continue_qualification'], true,
   array['regression','critical_stop']),
  ('rohrbruch', 'Rohrbruch Notfall', 'Gestresst',
   array['Hilfe, wir haben einen Rohrbruch im Garten, überall Wasser'],
   'active_leak', 'emergency_water', 'urgent_escalate',
   array['promise_price','continue_normal_sales'], true,
   array['regression','critical_stop','emergency']),
  ('wasserschaden', 'Wasserschaden', 'Dringend',
   array['Es gibt einen Wasserschaden an der Bewässerung'],
   'active_leak', 'emergency_water', 'urgent_escalate',
   array['promise_price'], true,
   array['regression','critical_stop','emergency']),
  ('complaint', 'Beschwerde', 'Verärgert',
   array['Ich habe eine Beschwerde wegen der letzten Montage'],
   'complaint', 'complaint', 'transfer',
   array['argue'], true,
   array['regression','critical_stop']),
  ('datenschutz', 'Datenschutz', 'Formal',
   array['Ich brauche eine Auskunft nach Datenschutz'],
   'privacy', 'privacy_datenschutz', 'transfer',
   array['give_legal_advice'], true,
   array['regression','critical_stop','privacy']),
  ('lawyer', 'Anwalt', 'Drohend',
   array['Mein Anwalt wird sich melden'],
   'lawyer', 'legal_anwalt', 'transfer',
   array['admit_liability'], true,
   array['regression','critical_stop','legal']),
  ('no_price_promise', 'Preisfrage', 'Preisbewusst',
   array['Was kostet eine Anlage für 400 Quadratmeter genau?'],
   'new_system', null, 'defer_price_to_team',
   array['promise_price'], true,
   array['regression','pricing']),
  ('no_montage_date', 'Montagetermin verlangen', 'Drängend',
   array['Können Sie mir schon den Montagetermin nächste Woche garantieren?'],
   'new_system', null, 'defer_scheduling',
   array['promise_montage_date'], true,
   array['regression','scheduling']),
  ('recording_declined', 'Aufnahme abgelehnt', 'Privacy-bewusst',
   array['Nein, bitte nicht aufzeichnen'],
   'recording_declined', null, 'continue_without_recording',
   array['force_recording'], true,
   array['regression','privacy','consent']),
  ('spam', 'SEO Spam', 'Verkäufer',
   array['Wir haben ein tolles SEO Angebot für Ihre Website'],
   'spam', 'sales_spam', 'end_politely',
   array['engage_sales_pitch'], false,
   array['regression'])
on conflict (code) do update set
  name = excluded.name,
  customer_phrases = excluded.customer_phrases,
  expected_intent = excluded.expected_intent,
  expected_stop_rule = excluded.expected_stop_rule,
  expected_outcome = excluded.expected_outcome,
  forbidden_actions = excluded.forbidden_actions,
  critical = excluded.critical,
  tags = excluded.tags;
