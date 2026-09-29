-- Baseline follow-on for EMPTY Supabase only. Backup first.
-- Destructive: drops public.sessions and public.users (password_hash). No hash import.
-- Do not apply to a populated public.users database without a separate data plan.

drop table if exists public.sessions;

alter table public.teams drop constraint if exists teams_created_by_fkey;
alter table public.members drop constraint if exists members_user_id_fkey;
alter table public.invites drop constraint if exists invites_invited_by_fkey;
alter table public.posts drop constraint if exists posts_author_id_fkey;
alter table public.post_likes drop constraint if exists post_likes_user_id_fkey;
alter table public.post_comments drop constraint if exists post_comments_author_id_fkey;
alter table public.work_items drop constraint if exists work_items_created_by_fkey;
alter table public.announcements drop constraint if exists announcements_author_id_fkey;
alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;

drop trigger if exists trg_users_touch on public.users;
drop table if exists public.users;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  bio text check (char_length(bio) <= 300),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams
  add constraint teams_created_by_fkey foreign key (created_by) references public.profiles(id);
alter table public.members
  add constraint members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.invites
  add constraint invites_invited_by_fkey foreign key (invited_by) references public.profiles(id);
alter table public.posts
  add constraint posts_author_id_fkey foreign key (author_id) references public.profiles(id);
alter table public.post_likes
  add constraint post_likes_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.post_comments
  add constraint post_comments_author_id_fkey foreign key (author_id) references public.profiles(id);
alter table public.work_items
  add constraint work_items_created_by_fkey foreign key (created_by) references public.profiles(id);
alter table public.announcements
  add constraint announcements_author_id_fkey foreign key (author_id) references public.profiles(id);
alter table public.audit_log
  add constraint audit_log_actor_id_fkey foreign key (actor_id) references public.profiles(id) on delete set null;

create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where team_id = t and user_id = auth.uid());
$$;
create or replace function public.is_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where team_id = t and user_id = auth.uid() and role = 'owner');
$$;
create or replace function public.is_admin_or_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where team_id = t and user_id = auth.uid() and role in ('owner','admin'));
$$;

grant execute on function public.is_member(uuid) to anon, authenticated;
grant execute on function public.is_owner(uuid) to anon, authenticated;
grant execute on function public.is_admin_or_owner(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.work_items enable row level security;
alter table public.work_attachments enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.members m
    join public.teams t on t.id = m.team_id
    where m.user_id = profiles.id and (t.is_public or public.is_member(t.id))
  )
);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy teams_select on public.teams for select using (is_public or public.is_member(id));
create policy teams_insert on public.teams for insert to authenticated
  with check (created_by = auth.uid());
create policy teams_update on public.teams for update to authenticated
  using (public.is_admin_or_owner(id)) with check (public.is_admin_or_owner(id));

create policy members_select on public.members for select using (
  public.is_member(team_id)
  or exists (select 1 from public.teams t where t.id = members.team_id and t.is_public)
);
create policy members_insert_self on public.members for insert to authenticated
  with check (user_id = auth.uid() and role <> 'owner');
create policy members_insert_creator_owner on public.members for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'owner'
    and exists (select 1 from public.teams t where t.id = team_id and t.created_by = auth.uid())
  );
create policy members_update on public.members for update to authenticated
  using (public.is_owner(team_id)) with check (public.is_owner(team_id));
create policy members_delete on public.members for delete to authenticated
  using (public.is_admin_or_owner(team_id));

create policy invites_all on public.invites for all to authenticated
  using (public.is_admin_or_owner(team_id)) with check (public.is_admin_or_owner(team_id));

create policy posts_select on public.posts for select using (
  deleted_at is null and (
    public.is_member(team_id)
    or (visibility = 'public' and exists (select 1 from public.teams t where t.id = posts.team_id and t.is_public))
  )
);
create policy posts_insert on public.posts for insert to authenticated
  with check (public.is_member(team_id) and author_id = auth.uid());
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_admin_or_owner(team_id));

create policy post_images_select on public.post_images for select using (
  exists (select 1 from public.posts p where p.id = post_id)
);
create policy post_images_insert on public.post_images for insert to authenticated
  with check (exists (
    select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid() and public.is_member(p.team_id)
  ));

create policy post_likes_select on public.post_likes for select using (
  exists (select 1 from public.posts p where p.id = post_id)
);
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and public.is_member(p.team_id)));
create policy post_likes_delete on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

create policy post_comments_select on public.post_comments for select using (
  deleted_at is null and exists (select 1 from public.posts p where p.id = post_id)
);
create policy post_comments_insert on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and public.is_member(p.team_id)));

create policy work_select on public.work_items for select using (
  deleted_at is null and (
    public.is_member(team_id)
    or (visibility = 'public' and exists (select 1 from public.teams t where t.id = work_items.team_id and t.is_public))
  )
);
create policy work_insert on public.work_items for insert to authenticated
  with check (public.is_member(team_id) and created_by = auth.uid());
create policy work_update on public.work_items for update to authenticated
  using (created_by = auth.uid() or public.is_admin_or_owner(team_id));

create policy work_att_select on public.work_attachments for select using (
  exists (select 1 from public.work_items w where w.id = work_item_id)
);
create policy work_att_insert on public.work_attachments for insert to authenticated
  with check (exists (
    select 1 from public.work_items w where w.id = work_item_id and w.created_by = auth.uid() and public.is_member(w.team_id)
  ));

create policy announcements_select on public.announcements for select using (
  deleted_at is null and public.is_member(team_id)
);
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.is_admin_or_owner(team_id) and author_id = auth.uid());
