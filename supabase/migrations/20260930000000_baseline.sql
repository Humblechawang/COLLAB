-- Baseline; do not apply to an already populated database without a separate data migration plan.
-- Empty Supabase project only. Source of truth copy of database/schema.sql (unchanged CHECKs/types).
-- Filename is Supabase CLI timestamp format (YYYYMMDDHHMMSS).
-- If this file was already applied, do not re-edit it; use a later migration instead.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
set search_path = public, extensions;

create table public.users (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  password_hash   text not null,
  full_name       text not null check (char_length(full_name) between 2 and 80),
  bio             text check (char_length(bio) <= 300),
  avatar_url      text,
  email_verified  boolean not null default false,
  failed_logins   int not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.users (lower(email::text));

create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  refresh_hash    text not null,
  user_agent      text,
  ip_hash         text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz
);
create index on public.sessions (user_id);
create index on public.sessions (expires_at);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name        text not null check (char_length(name) between 2 and 60),
  tagline     text check (char_length(tagline) <= 140),
  bio         text check (char_length(bio) <= 1000),
  logo_url    text,
  is_public   boolean not null default true,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'admin', 'member');

create table public.members (
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        public.member_role not null default 'member',
  title       text check (char_length(title) <= 60),
  joined_at   timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index on public.members (user_id);

create type public.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  email        citext not null,
  role         public.member_role not null default 'member',
  token_hash   text not null unique,
  status       public.invite_status not null default 'pending',
  invited_by   uuid not null references public.users(id),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.invites (team_id);
create unique index one_pending_invite_per_email
  on public.invites (team_id, email) where status = 'pending';

create type public.post_visibility as enum ('public', 'team');

create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  author_id    uuid not null references public.users(id),
  tag          text not null check (tag in ('Journey','Hackathon','Milestone','Idea')),
  body         text not null check (char_length(body) between 1 and 2000),
  link_url     text,
  visibility   public.post_visibility not null default 'public',
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz
);
create index on public.posts (team_id, created_at desc) where deleted_at is null;

create table public.post_images (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  storage_key text not null,
  position    smallint not null default 0
);

create table public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.users(id),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.post_comments (post_id, created_at);

create type public.work_status as enum ('Launched', 'Research', 'Pending');

create table public.work_items (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  created_by   uuid not null references public.users(id),
  title        text not null check (char_length(title) between 2 and 100),
  description  text check (char_length(description) <= 1000),
  status       public.work_status not null default 'Pending',
  link_url     text,
  visibility   public.post_visibility not null default 'public',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on public.work_items (team_id, status) where deleted_at is null;

create table public.work_attachments (
  id           uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  storage_key  text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  scanned_at   timestamptz,
  scan_result  text
);

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  author_id  uuid not null references public.users(id),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.users(id) on delete set null,
  team_id     uuid references public.teams(id) on delete set null,
  action      text not null,
  target      text,
  metadata    jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index on public.audit_log (team_id, created_at desc);
create index on public.audit_log (actor_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_touch before update on public.users
  for each row execute function public.touch_updated_at();
create trigger trg_teams_touch before update on public.teams
  for each row execute function public.touch_updated_at();
create trigger trg_work_touch before update on public.work_items
  for each row execute function public.touch_updated_at();
