-- Prompt Studio foundation (TZ §13 / §26.15)
-- Versioned prompt blocks → immutable releases. No live telephony coupling yet.

create table if not exists public.prompt_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  required boolean not null default false,
  locked boolean not null default false,
  active boolean not null default true
);

drop trigger if exists prompt_documents_set_updated_at on public.prompt_documents;
create trigger prompt_documents_set_updated_at
  before update on public.prompt_documents
  for each row execute function public.set_updated_at();

alter table public.prompt_documents enable row level security;

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prompt_document_id uuid not null references public.prompt_documents (id) on delete cascade,
  version int not null,
  status text not null default 'draft'
    check (status in (
      'draft', 'review', 'test_passed', 'approved', 'published', 'retired'
    )),
  content text not null default '',
  variables_schema jsonb not null default '{}'::jsonb,
  content_hash text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  change_note text,
  unique (prompt_document_id, version)
);

drop trigger if exists prompt_versions_set_updated_at on public.prompt_versions;
create trigger prompt_versions_set_updated_at
  before update on public.prompt_versions
  for each row execute function public.set_updated_at();

create index if not exists prompt_versions_doc_status_idx
  on public.prompt_versions (prompt_document_id, status);

alter table public.prompt_versions enable row level security;

create table if not exists public.prompt_releases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  environment text not null default 'production'
    check (environment in ('development', 'staging', 'production')),
  label text,
  compiled_content text not null,
  compiled_hash text not null,
  dependency_snapshot jsonb not null default '{}'::jsonb,
  change_comment text,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  is_active boolean not null default false
);

create unique index if not exists prompt_releases_one_active_per_env
  on public.prompt_releases (environment)
  where is_active = true and retired_at is null;

alter table public.prompt_releases enable row level security;

-- Default Empfang assistant blocks (TZ §13.2 subset for v1)
insert into public.prompt_documents (code, name, description, sort_order, required, locked) values
  ('identity', 'Identity', 'Wer der Assistent ist', 10, true, true),
  ('brand_voice', 'Brand voice', 'Ton und Stil', 20, true, false),
  ('language', 'Language', 'Sprache und Dialekt', 30, true, false),
  ('greeting', 'Greeting', 'Begrüßung', 40, true, false),
  ('ai_disclosure', 'AI disclosure', 'KI-Offenlegung', 50, true, true),
  ('recording_consent', 'Recording consent', 'Aufnahmehinweis', 60, true, true),
  ('company_context', 'Company context', 'RegnerWerk Kontext', 70, true, false),
  ('services', 'Services', 'Leistungen', 80, true, false),
  ('service_area', 'Service area', 'Einzugsgebiet', 90, false, false),
  ('conversation_goals', 'Conversation goals', 'Ziele des Gesprächs', 100, true, false),
  ('pricing_boundaries', 'Pricing boundaries', 'Preisgrenzen', 110, true, true),
  ('scheduling_boundaries', 'Scheduling boundaries', 'Termin-Grenzen', 120, true, true),
  ('safety', 'Safety', 'Sicherheitsregeln', 130, true, true),
  ('escalation', 'Escalation', 'Übergabe an Menschen', 140, true, true),
  ('stop_triggers', 'Stop triggers', 'Abbruchbedingungen', 150, true, true),
  ('closing', 'Closing', 'Gesprächsabschluss', 160, true, false),
  ('fallback', 'Fallback behavior', 'Fallback', 170, true, false)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  required = excluded.required,
  locked = excluded.locked;

-- Seed draft v1 content per block
with seed(code, content) as (
  values
    ('identity', 'Du bist der digitale KI-Assistent von RegnerWerk (Automatische Gartenbewässerung, Deutschland).'),
    ('brand_voice', 'Sprich ruhig, klar, freundlich und kurz. Keine Floskeln, keine Übertreibung.'),
    ('language', 'Antworte standardmäßig auf Deutsch. Passe dich der Sprache des Anrufers an, wenn er klar wechselt.'),
    ('greeting', 'Begrüße den Anrufer kurz, nenne RegnerWerk und biete Hilfe an.'),
    ('ai_disclosure', 'Offenbare früh und klar, dass du ein KI-Assistent bist.'),
    ('recording_consent', 'Falls das Gespräch aufgezeichnet wird, weise darauf hin und hole bei Bedarf die Zustimmung ein.'),
    ('company_context', 'RegnerWerk plant und installiert automatische Gartenbewässerung (Sofort- und Individualsysteme) in Deutschland.'),
    ('services', 'Typische Anliegen: Neuanlage, Erweiterung, Service/Reparatur, Winterfestmachung, Saisonstart, allgemeine Beratung.'),
    ('service_area', 'Fokus auf bediente Regionen in Deutschland. Bei Unsicherheit nach PLZ fragen und keine falschen Zusagen machen.'),
    ('conversation_goals', 'Intent erkennen, Pflichtfelder sammeln, qualifizieren und bei Bedarf an das Büro übergeben.'),
    ('pricing_boundaries', 'Versprich keine Festpreise und keine verbindlichen Kostenvoranschläge am Telefon.'),
    ('scheduling_boundaries', 'Versprich keine festen Montagetermine. Du darfst nur Interesse an Rückruf/Terminaufnahme notieren.'),
    ('safety', 'Bei Rohrbruch, Wasserschaden oder Gefahr: priorisieren, Sicherheitshinweise geben und Eskalation vorbereiten.'),
    ('escalation', 'Bei Bitte um einen Mitarbeiter oder komplexen Fällen: Qualifikation stoppen und Transfer vorbereiten.'),
    ('stop_triggers', 'Bei Beleidigung, Missbrauch, rechtlichen Drohungen oder klarer Ablehnung der KI: höflich beenden oder an Menschen übergeben.'),
    ('closing', 'Fasse kurz zusammen, was als Nächstes passiert, und verabschiede dich freundlich.'),
    ('fallback', 'Wenn unklar: nachfragen statt raten. Bei wiederholter Unklarheit an das Büro übergeben.')
)
insert into public.prompt_versions (
  prompt_document_id, version, status, content, content_hash, change_note
)
select d.id, 1, 'draft', s.content,
  md5(s.content),
  'Initial seed'
from seed s
join public.prompt_documents d on d.code = s.code
where not exists (
  select 1 from public.prompt_versions pv
  where pv.prompt_document_id = d.id and pv.version = 1
);
