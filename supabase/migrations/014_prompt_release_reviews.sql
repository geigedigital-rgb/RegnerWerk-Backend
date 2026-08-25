-- Prompt release reviews: rating + comments on published instruction sets
-- TZ: versioned prompts with human feedback and restore

create table if not exists public.prompt_release_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  release_id uuid not null references public.prompt_releases (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  comment text not null default '',
  constraint prompt_release_reviews_has_feedback
    check (rating is not null or length(trim(comment)) > 0)
);

create index if not exists prompt_release_reviews_release_idx
  on public.prompt_release_reviews (release_id, created_at desc);

drop trigger if exists prompt_release_reviews_set_updated_at on public.prompt_release_reviews;
create trigger prompt_release_reviews_set_updated_at
  before update on public.prompt_release_reviews
  for each row execute function public.set_updated_at();

alter table public.prompt_release_reviews enable row level security;

-- Store full block content on publish for "Als Entwurf laden"
comment on table public.prompt_release_reviews is
  'Feedback on prompt_releases: 1–5 stars and/or free-text comment.';
