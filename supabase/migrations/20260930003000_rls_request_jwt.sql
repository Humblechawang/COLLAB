-- Option A: drop collab_api USING (true). SET LOCAL ROLE authenticated + request.jwt.claims.
-- Unapplied until you approve. Requires collab_api from 02000.

drop policy if exists collab_api_profiles on public.profiles;
drop policy if exists collab_api_teams on public.teams;
drop policy if exists collab_api_members on public.members;
drop policy if exists collab_api_invites on public.invites;
drop policy if exists collab_api_posts on public.posts;
drop policy if exists collab_api_post_images on public.post_images;
drop policy if exists collab_api_post_likes on public.post_likes;
drop policy if exists collab_api_post_comments on public.post_comments;
drop policy if exists collab_api_work on public.work_items;
drop policy if exists collab_api_work_att on public.work_attachments;
drop policy if exists collab_api_ann on public.announcements;
drop policy if exists collab_api_audit on public.audit_log;
drop policy if exists members_insert_from_invite on public.members;

revoke all on all tables in schema public from collab_api;
revoke all on all sequences in schema public from collab_api;

grant usage on schema public to anon, authenticated, collab_api;
grant anon to collab_api;
grant authenticated to collab_api;

grant select on
  public.profiles, public.teams, public.members, public.posts, public.post_images,
  public.post_likes, public.post_comments, public.work_items, public.work_attachments
to anon;

grant select, insert, update, delete on
  public.profiles, public.teams, public.members, public.invites, public.posts,
  public.post_images, public.post_likes, public.post_comments, public.work_items,
  public.work_attachments, public.announcements, public.audit_log
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.is_member(uuid) to anon, authenticated;
grant execute on function public.is_owner(uuid) to anon, authenticated;
grant execute on function public.is_admin_or_owner(uuid) to anon, authenticated;

create policy audit_insert on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid());

create or replace function public.accept_team_invite(p_token_hash text, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.invites%rowtype;
begin
  if uid is null or p_email is null or length(trim(p_email)) = 0 then
    raise exception 'invite invalid';
  end if;
  select * into inv
    from public.invites
    where token_hash = p_token_hash and status = 'pending' and expires_at > now()
    for update;
  if inv.id is null then
    raise exception 'invite invalid';
  end if;
  if inv.role = 'owner' then
    raise exception 'invite invalid';
  end if;
  if lower(inv.email::text) <> lower(p_email) then
    raise exception 'invite email mismatch';
  end if;
  insert into public.members (team_id, user_id, role)
    values (inv.team_id, uid, inv.role)
    on conflict (team_id, user_id) do nothing;
  update public.invites set status = 'accepted', accepted_at = now() where id = inv.id;
  return inv.team_id;
end;
$$;

revoke all on function public.accept_team_invite(text, text) from public, anon;
grant execute on function public.accept_team_invite(text, text) to authenticated;
