-- Link Sofort configurator projects to CRM contacts / leads.
-- Website + configurator intake can share one customer card.

alter table public.projects
  add column if not exists contact_id uuid references public.contacts (id) on delete set null;

alter table public.projects
  add column if not exists lead_id uuid references public.leads (id) on delete set null;

create index if not exists projects_contact_id_idx
  on public.projects (contact_id);

create index if not exists projects_lead_id_idx
  on public.projects (lead_id);

alter table public.inbox_items drop constraint if exists inbox_items_source_type_check;
alter table public.inbox_items
  add constraint inbox_items_source_type_check
  check (source_type in (
    'website', 'ai_call', 'phone', 'missed_call', 'manual', 'import',
    'configurator', 'other'
  ));
