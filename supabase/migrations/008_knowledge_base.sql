-- Knowledge Base foundation (TZ §14 / §26.15)
-- Published articles only are eligible for assistants / gateway tools.

create table if not exists public.knowledge_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  name_de text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true
);

alter table public.knowledge_categories enable row level security;

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category_id uuid not null references public.knowledge_categories (id) on delete restrict,
  title text not null,
  language text not null default 'de',
  content text not null default '',
  source text,
  status text not null default 'draft'
    check (status in (
      'draft', 'review', 'approved', 'published', 'expired', 'archived'
    )),
  sensitivity text not null default 'normal'
    check (sensitivity in ('normal', 'price', 'legal', 'internal')),
  version int not null default 1,
  owner_id uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  valid_from timestamptz,
  valid_until timestamptz,
  published_at timestamptz,
  change_note text,
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists knowledge_articles_set_updated_at on public.knowledge_articles;
create trigger knowledge_articles_set_updated_at
  before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

create index if not exists knowledge_articles_status_idx
  on public.knowledge_articles (status);
create index if not exists knowledge_articles_category_idx
  on public.knowledge_articles (category_id);

alter table public.knowledge_articles enable row level security;

insert into public.knowledge_categories (code, name_de, description, sort_order) values
  ('about', 'Über RegnerWerk', 'Unternehmen und Positionierung', 10),
  ('services', 'Leistungen', 'Was angeboten wird', 20),
  ('service_area', 'Gebiet & PLZ', 'Einzugsgebiet', 30),
  ('process', 'Ablauf', 'Wie Projekte ablaufen', 40),
  ('new_system', 'Neue Anlage', 'Neuanlage / Sofort / Individuell', 50),
  ('repair', 'Reparatur', 'Service und Störung', 60),
  ('maintenance', 'Wartung', 'Wartung und Saison', 70),
  ('winterization', 'Einwinterung', 'Winterfestmachung', 80),
  ('pricing', 'Preise', 'Zulässige Preisaussagen', 90),
  ('faq', 'FAQ', 'Häufige Fragen', 100),
  ('exceptions', 'Ausnahmen', 'Was nicht gemacht wird', 110),
  ('hours', 'Arbeitszeiten', 'Erreichbarkeit', 120),
  ('pronunciation', 'Aussprache', 'Marken-/Produktnamen', 130),
  ('legal', 'Legal disclosure', 'Rechtliche Hinweise', 140),
  ('callback', 'Callback', 'Rückrufregeln', 150)
on conflict (code) do update set
  name_de = excluded.name_de,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Seed core published articles (DE)
with seed(cat, title, content, sensitivity) as (
  values
    ('about', 'Was ist RegnerWerk?',
     'RegnerWerk plant und installiert automatische Gartenbewässerung in Deutschland. Fokus: funktionierende Systeme — prüfen, planen, einbauen, einstellen, dokumentieren.',
     'normal'),
    ('services', 'Leistungen im Überblick',
     'Neuanlage (Sofort und Individuell), Erweiterung bestehender Systeme, Reparatur/Service, Wartung, Einwinterung und Saisonstart.',
     'normal'),
    ('service_area', 'Einzugsgebiet',
     'Bediente Regionen in Deutschland. Bei Unsicherheit immer nach PLZ fragen. Keine Zusagen außerhalb geprüfter Gebiete.',
     'normal'),
    ('process', 'Typischer Projektablauf',
     'Anfrage aufnehmen → Bedarf klären → Planung/Angebot durch Fachteam → Montage → Einstellung und Übergabe. Am Telefon keine verbindlichen Termine zusagen.',
     'normal'),
    ('new_system', 'Neue Bewässerungsanlage',
     'Für eine Neuanlage braucht das Team grobe Fläche, Wasserquelle, Druck wenn bekannt, und PLZ. Exakte Planung erfolgt nach Objektprüfung.',
     'normal'),
    ('repair', 'Reparatur und Störung',
     'Bei undichten Stellen, nicht drehenden Regnern oder Steuerungsproblemen: Symptome, Alter der Anlage und Erreichbarkeit des Objekts erfassen.',
     'normal'),
    ('winterization', 'Einwinterung',
     'Einwinterung schützt Leitungen vor Frost. Terminwünsche aufnehmen; technische Ausführung nur durch das Team.',
     'normal'),
    ('pricing', 'Preisaussagen',
     'Keine Festpreise und keine verbindlichen Kostenvoranschläge am Telefon. Erlaubt: dass Preise von Fläche, Wasser und Aufwand abhängen und das Team nach Prüfung ein Angebot erstellt.',
     'price'),
    ('hours', 'Erreichbarkeit',
     'Bürozeiten kommuniziert das Team. Außerhalb der Zeiten Anliegen aufnehmen und Rückruf anbieten.',
     'normal'),
    ('legal', 'KI-Hinweis',
     'Anrufer müssen erfahren, dass sie mit einem digitalen KI-Assistenten sprechen. Aufzeichnungen nur mit Zustimmung.',
     'legal'),
    ('callback', 'Rückruf',
     'Rückrufe werden als Aufgabe für das Büro angelegt. Keine Zusage einer genauen Uhrzeit, außer sie wurde vom Team freigegeben.',
     'normal'),
    ('exceptions', 'Was wir nicht zusagen',
     'Keine Garantie auf „perfekt grünen Rasen“, keine „Nr. 1“-Claims, keine revolutionären Versprechen, keine endgültige Preisangabe vor Wasser- und Objektprüfung.',
     'normal')
)
insert into public.knowledge_articles (
  category_id, title, language, content, status, sensitivity, version, source, published_at, change_note
)
select c.id, s.title, 'de', s.content, 'published', s.sensitivity, 1, 'seed', now(), 'Initial seed'
from seed s
join public.knowledge_categories c on c.code = s.cat
where not exists (
  select 1 from public.knowledge_articles a
  where a.title = s.title and a.category_id = c.id
);
