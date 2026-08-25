-- Website support chat → CRM (form_type + helpful index)

alter table public.web_form_submissions
  drop constraint if exists web_form_submissions_form_type_check;

alter table public.web_form_submissions
  add constraint web_form_submissions_form_type_check
  check (form_type in (
    'contact',
    'calculator',
    'repair',
    'service',
    'projekt_anfrage',
    'support_chat',
    'other'
  ));

create index if not exists web_form_submissions_form_type_received_idx
  on public.web_form_submissions (form_type, received_at desc);

-- Extra FAQ-style articles for website support chat (idempotent)
with seed(cat, title, content, sensitivity) as (
  values
    ('faq', 'Website Support-Chat',
     'Besucher können auf der Website mit einem digitalen Assistenten chatten. Der Assistent beantwortet allgemeine Fragen aus der Wissensbasis. Bei konkreten Projekten, Terminen oder Preisen wird ein Rückruf / Kontaktaufnahme angeboten. Der Assistent ist kein Mensch.',
     'normal'),
    ('hours', 'Telefon und Erreichbarkeit Website',
     'Telefon: +49 421 51904482. E-Mail: hallo@regnerwerk.de. Bürozeiten: Mo–Fr 08:00–18:00. Außerhalb der Zeiten Anliegen aufnehmen und Rückruf anbieten, ohne genaue Uhrzeit zuzusagen.',
     'normal'),
    ('new_system', 'Sofort-Konfigurator',
     'Für eine schnelle Planung gibt es den Sofort-Konfigurator unter konfigurator.regnerwerk.de. Individuelle Projekte und komplexe Gärten werden nach Objektprüfung geplant. Keine verbindlichen Preise im Chat.',
     'normal')
)
insert into public.knowledge_articles (
  category_id, title, language, content, status, sensitivity, version, source, published_at, change_note
)
select c.id, s.title, 'de', s.content, 'published', s.sensitivity, 1, 'seed-support-chat', now(), 'Support-Chat seed'
from seed s
join public.knowledge_categories c on c.code = s.cat
where not exists (
  select 1 from public.knowledge_articles a
  where a.title = s.title and a.category_id = c.id
);
