# Security

- Browser: Supabase Auth only. No PostgREST (`from()`). Keep Data API off.
- Express: JWKS first (`iss`, `aud`, `exp`, `sub`). Then one DB transaction: `set_config('request.jwt.claims', {sub, role:authenticated}, true)`, `SET LOCAL ROLE authenticated`, parameterized SQL, `COMMIT`. `RESET ALL` on release.
- `DATABASE_URL` = `collab_api` (NOINHERIT, NOSUPERUSER, NOBYPASSRLS). `DATABASE_MIGRATE_URL` = owner/migrator only.
- RLS ENABLE+FORCE. Policies use `auth.uid()`. No `collab_api USING (true)`.
- Profile/team create and invite accept: live `GET /auth/v1/user` (`email_confirmed_at`), not JWT email claims alone.
- Content deletion: members can soft-delete only their own posts/work; owners/admins can delete any team item. The update statement checks current membership and role atomically, in addition to route authorization and RLS.
- Portfolio visibility: only owners/admins can update team settings, including `isPublic`; visibility changes are written to the audit log. Private teams remain readable by members.
- Invite roles: API validation only permits `admin` or `member`; owner status must be assigned by an existing owner and cannot be granted by an invite.
- Uploads: HTTP 503.
- Instant Demo: enabled for local preview only (`localhost`, loopback, RFC1918 private IPs, `.local`, or direct `file:` URL). The location check blocks public hosts; sample edits are in-memory and reset on refresh.
