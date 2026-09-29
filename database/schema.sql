-- Collab database schema (PostgreSQL 14+)
-- Run via: npm run migrate  (see backend/src/db/migrate.js)

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ============================================================
-- USERS
-- ============================================================
create table users (
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
create index on users (lower(email::text));

-- ============================================================
-- SESSIONS (refresh tokens, hashed — never store raw tokens)
-- ============================================================
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  refresh_hash    text not null,           -- sha256 of the refresh token
  user_agent      text,
  ip_hash         text,                    -- hashed, not raw, for privacy
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz
);
create index on sessions (user_id);
create index on sessions (expires_at);

-- ============================================================
-- TEAMS
-- ============================================================
create table teams (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name        text not null check (char_length(name) between 2 and 60),
  tagline     text check (char_length(tagline) <= 140),
  bio         text check (char_length(bio) <= 1000),
  logo_url    text,
  is_public   boolean not null default true,
  created_by  uuid not null references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- MEMBERS (role-based access control lives here)
-- ============================================================
create type member_role as enum ('owner', 'admin', 'member');

create table members (
  team_id     uuid not null references teams(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        member_role not null default 'member',
  title       text check (char_length(title) <= 60),
  joined_at   timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index on members (user_id);

-- ============================================================
-- INVITES (single-use, expiring, revocable)
-- ============================================================
create type invite_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table invites (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  email        citext not null,
  role         member_role not null default 'member',
  token_hash   text not null unique,        -- sha256 of the invite token; raw token only ever in the email
  status       invite_status not null default 'pending',
  invited_by   uuid not null references users(id),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on invites (team_id);
create unique index one_pending_invite_per_email
  on invites (team_id, email) where status = 'pending';

-- ============================================================
-- POSTS (journey updates)
-- ============================================================
create type post_visibility as enum ('public', 'team');

create table posts (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  author_id    uuid not null references users(id),
  tag          text not null check (tag in ('Journey','Hackathon','Milestone','Idea')),
  body         text not null check (char_length(body) between 1 and 2000),
  link_url     text,
  visibility   post_visibility not null default 'public',
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz                  -- soft delete: keeps audit trail, hides from feeds
);
create index on posts (team_id, created_at desc) where deleted_at is null;

create table post_images (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  storage_key text not null,                -- object key in blob storage, never a raw file path
  position   smallint not null default 0
);

create table post_likes (
  post_id  uuid not null references posts(id) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references users(id),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on post_comments (post_id, created_at);

-- ============================================================
-- WORK ITEMS
-- ============================================================
create type work_status as enum ('Launched', 'Research', 'Pending');

create table work_items (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  created_by   uuid not null references users(id),
  title        text not null check (char_length(title) between 2 and 100),
  description  text check (char_length(description) <= 1000),
  status       work_status not null default 'Pending',
  link_url     text,
  visibility   post_visibility not null default 'public',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on work_items (team_id, status) where deleted_at is null;

create table work_attachments (
  id           uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references work_items(id) on delete cascade,
  storage_key  text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  scanned_at   timestamptz,                 -- set once malware scan clears the file
  scan_result  text
);

-- ============================================================
-- ANNOUNCEMENTS (admin/owner only)
-- ============================================================
create table announcements (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  author_id  uuid not null references users(id),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ============================================================
-- AUDIT LOG (every privileged action, kept even if the actor is deleted)
-- ============================================================
create table audit_log (
  id          bigserial primary key,
  actor_id    uuid references users(id) on delete set null,
  team_id     uuid references teams(id) on delete set null,
  action      text not null,               -- e.g. 'member.role_changed', 'invite.revoked'
  target      text,
  metadata    jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index on audit_log (team_id, created_at desc);
create index on audit_log (actor_id, created_at desc);

-- ============================================================
-- Keep updated_at columns honest
-- ============================================================
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_touch before update on users
  for each row execute function touch_updated_at();
create trigger trg_teams_touch before update on teams
  for each row execute function touch_updated_at();
create trigger trg_work_touch before update on work_items
  for each row execute function touch_updated_at();
