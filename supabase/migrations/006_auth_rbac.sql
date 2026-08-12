-- Auth / RBAC foundation (TZ §5 / §26.4)
-- Invite-only: no public signup. Users created in Supabase Auth Dashboard or admin API.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null default '',
  locale text not null default 'de',
  timezone text not null default 'Europe/Berlin',
  phone text,
  active boolean not null default true,
  avatar_path text,
  last_seen_at timestamptz
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  description text,
  system_role boolean not null default true
);

alter table public.roles enable row level security;

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  key text not null unique,
  description text
);

alter table public.permissions enable row level security;

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table public.role_permissions enable row level security;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  primary key (user_id, role_id)
);

alter table public.user_roles enable row level security;

-- Seed roles
insert into public.roles (code, name, description) values
  ('owner', 'Owner / CEO', 'Vollzugriff'),
  ('office', 'Büro / Disposition', 'Inbox, Leads, Calls, Aufgaben'),
  ('sales', 'Vertrieb', 'Pipeline und Angebote'),
  ('project_lead', 'Projektleitung', 'Montageprojekte'),
  ('technician', 'Techniker / Service', 'Zugewiesene Service-/Montageaufgaben'),
  ('ai_manager', 'AI Manager', 'Prompts und KI-Konfiguration'),
  ('readonly', 'Read-only / Audit', 'Nur Lesen')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- Seed permission keys (TZ §26.4)
insert into public.permissions (key, description) values
  ('crm.customer.read', 'Kunden lesen'),
  ('crm.customer.write', 'Kunden schreiben'),
  ('crm.inbox.triage', 'Inbox triage'),
  ('crm.lead.write', 'Leads bearbeiten'),
  ('crm.pipeline.move', 'Pipeline verschieben'),
  ('crm.pipeline.won_lost', 'Won/Lost setzen'),
  ('crm.montage.write', 'Montageprojekte'),
  ('crm.service.write', 'Servicefälle'),
  ('calls.read', 'Anrufe lesen'),
  ('calls.listen', 'Aufnahmen hören'),
  ('transcripts.read', 'Transkripte lesen'),
  ('ai.prompt.edit', 'Prompts bearbeiten'),
  ('ai.prompt.publish', 'Prompts publizieren'),
  ('ai.rules.publish', 'Regeln publizieren'),
  ('ai.emergency_stop', 'Not-Aus'),
  ('audit.read', 'Audit lesen'),
  ('admin.users.manage', 'Benutzer verwalten')
on conflict (key) do update set description = excluded.description;

-- Owner gets all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'owner'
on conflict do nothing;

-- Office: CRM ops without AI publish / won_lost optional - give pipeline move + won_lost for now
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'crm.customer.read', 'crm.customer.write', 'crm.inbox.triage', 'crm.lead.write',
  'crm.pipeline.move', 'crm.montage.write', 'crm.service.write',
  'calls.read', 'transcripts.read', 'audit.read'
)
where r.code = 'office'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'crm.customer.read', 'crm.customer.write', 'crm.lead.write',
  'crm.pipeline.move', 'crm.pipeline.won_lost', 'calls.read'
)
where r.code = 'sales'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'crm.customer.read', 'crm.montage.write', 'crm.service.write', 'calls.read'
)
where r.code = 'project_lead'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'crm.customer.read', 'crm.service.write', 'crm.montage.write'
)
where r.code = 'technician'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'crm.customer.read', 'calls.read', 'calls.listen', 'transcripts.read',
  'ai.prompt.edit', 'ai.prompt.publish', 'ai.rules.publish', 'ai.emergency_stop', 'audit.read'
)
where r.code = 'ai_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'crm.customer.read', 'calls.read', 'audit.read'
)
where r.code = 'readonly'
on conflict do nothing;

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles: users can read/update self; service role bypasses RLS
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and ur.revoked_at is null and r.code = 'owner'
  ));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Roles/permissions readable by authenticated
drop policy if exists roles_select_auth on public.roles;
create policy roles_select_auth on public.roles
  for select to authenticated using (true);
drop policy if exists permissions_select_auth on public.permissions;
create policy permissions_select_auth on public.permissions
  for select to authenticated using (true);
drop policy if exists role_permissions_select_auth on public.role_permissions;
create policy role_permissions_select_auth on public.role_permissions
  for select to authenticated using (true);
drop policy if exists user_roles_select_auth on public.user_roles;
create policy user_roles_select_auth on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and ur.revoked_at is null and r.code = 'owner'
    )
  );
