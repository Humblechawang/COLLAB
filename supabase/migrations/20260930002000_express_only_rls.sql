-- Express-only. Do not enable PostgREST/Data API on these tables.
-- Not applied by this code drop. Empty project: run after 20260930001000.
-- collab_api: LOGIN, NOSUPERUSER, NOBYPASSRLS, not table owner. Set its password in the Dashboard; never commit it.

drop policy if exists members_insert_self on public.members;
drop policy if exists members_insert_from_invite on public.members;

create or replace function public.reject_identity_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'teams' and (new.id is distinct from old.id or new.created_by is distinct from old.created_by) then
    raise exception 'team identity fields are immutable';
  end if;
  if tg_table_name = 'members' and (new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id) then
    raise exception 'membership identity fields are immutable';
  end if;
  if tg_table_name = 'posts' and (new.team_id is distinct from old.team_id or new.author_id is distinct from old.author_id) then
    raise exception 'post identity fields are immutable';
  end if;
  if tg_table_name = 'work_items' and (new.team_id is distinct from old.team_id or new.created_by is distinct from old.created_by) then
    raise exception 'work identity fields are immutable';
  end if;
  if tg_table_name = 'invites' and (new.team_id is distinct from old.team_id or new.invited_by is distinct from old.invited_by) then
    raise exception 'invite identity fields are immutable';
  end if;
  if tg_table_name = 'announcements' and (new.team_id is distinct from old.team_id or new.author_id is distinct from old.author_id) then
    raise exception 'announcement identity fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_teams_immutable on public.teams;
create trigger trg_teams_immutable before update on public.teams
  for each row execute function public.reject_identity_reassignment();
drop trigger if exists trg_members_immutable on public.members;
create trigger trg_members_immutable before update on public.members
  for each row execute function public.reject_identity_reassignment();
drop trigger if exists trg_posts_immutable on public.posts;
create trigger trg_posts_immutable before update on public.posts
  for each row execute function public.reject_identity_reassignment();
drop trigger if exists trg_work_immutable_id on public.work_items;
create trigger trg_work_immutable_id before update on public.work_items
  for each row execute function public.reject_identity_reassignment();
drop trigger if exists trg_invites_immutable on public.invites;
create trigger trg_invites_immutable before update on public.invites
  for each row execute function public.reject_identity_reassignment();
drop trigger if exists trg_ann_immutable on public.announcements;
create trigger trg_ann_immutable before update on public.announcements
  for each row execute function public.reject_identity_reassignment();

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid() or public.is_admin_or_owner(team_id))
  with check (author_id = auth.uid() or public.is_admin_or_owner(team_id));

drop policy if exists work_update on public.work_items;
create policy work_update on public.work_items for update to authenticated
  using (created_by = auth.uid() or public.is_admin_or_owner(team_id))
  with check (created_by = auth.uid() or public.is_admin_or_owner(team_id));

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update to authenticated
  using (public.is_admin_or_owner(id))
  with check (public.is_admin_or_owner(id) and created_by = created_by);

drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (public.is_owner(team_id))
  with check (public.is_owner(team_id) and user_id = user_id and team_id = team_id);

alter table public.profiles force row level security;
alter table public.teams force row level security;
alter table public.members force row level security;
alter table public.invites force row level security;
alter table public.posts force row level security;
alter table public.post_images force row level security;
alter table public.post_likes force row level security;
alter table public.post_comments force row level security;
alter table public.work_items force row level security;
alter table public.work_attachments force row level security;
alter table public.announcements force row level security;
alter table public.audit_log force row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from public, anon, authenticated;
revoke execute on function public.is_owner(uuid) from public, anon, authenticated;
revoke execute on function public.is_admin_or_owner(uuid) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'collab_api') then
    create role collab_api login nosuperuser nocreatedb nocreaterole noinherit nobypassrls noreplication;
  end if;
end
$$;

grant usage on schema public to collab_api;
grant select, insert, update, delete on all tables in schema public to collab_api;
grant usage, select on all sequences in schema public to collab_api;
grant execute on function public.touch_updated_at() to collab_api;
grant execute on function public.reject_identity_reassignment() to collab_api;
grant execute on function public.is_member(uuid) to collab_api;
grant execute on function public.is_owner(uuid) to collab_api;
grant execute on function public.is_admin_or_owner(uuid) to collab_api;

drop policy if exists collab_api_profiles on public.profiles;
create policy collab_api_profiles on public.profiles for all to collab_api using (true) with check (true);
drop policy if exists collab_api_teams on public.teams;
create policy collab_api_teams on public.teams for all to collab_api using (true) with check (true);
drop policy if exists collab_api_members on public.members;
create policy collab_api_members on public.members for all to collab_api using (true) with check (true);
drop policy if exists collab_api_invites on public.invites;
create policy collab_api_invites on public.invites for all to collab_api using (true) with check (true);
drop policy if exists collab_api_posts on public.posts;
create policy collab_api_posts on public.posts for all to collab_api using (true) with check (true);
drop policy if exists collab_api_post_images on public.post_images;
create policy collab_api_post_images on public.post_images for all to collab_api using (true) with check (true);
drop policy if exists collab_api_post_likes on public.post_likes;
create policy collab_api_post_likes on public.post_likes for all to collab_api using (true) with check (true);
drop policy if exists collab_api_post_comments on public.post_comments;
create policy collab_api_post_comments on public.post_comments for all to collab_api using (true) with check (true);
drop policy if exists collab_api_work on public.work_items;
create policy collab_api_work on public.work_items for all to collab_api using (true) with check (true);
drop policy if exists collab_api_work_att on public.work_attachments;
create policy collab_api_work_att on public.work_attachments for all to collab_api using (true) with check (true);
drop policy if exists collab_api_ann on public.announcements;
create policy collab_api_ann on public.announcements for all to collab_api using (true) with check (true);
drop policy if exists collab_api_audit on public.audit_log;
create policy collab_api_audit on public.audit_log for all to collab_api using (true) with check (true);
