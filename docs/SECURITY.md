# Security

- Browser: Supabase Auth only. No PostgREST (`from()`). Keep Data API off.
- Express: JWKS first (`iss`, `aud`, `exp`, `sub`). Then one DB transaction: `set_config('request.jwt.claims', {sub, role:authenticated}, true)`, `SET LOCAL ROLE authenticated`, parameterized SQL, `COMMIT`. `RESET ALL` on release.
- `DATABASE_URL` = `collab_api` (NOINHERIT, NOSUPERUSER, NOBYPASSRLS). `DATABASE_MIGRATE_URL` = owner/migrator only.
- RLS ENABLE+FORCE. Policies use `auth.uid()`. No `collab_api USING (true)`.
- Profile/team create and invite accept: live `GET /auth/v1/user` (`email_confirmed_at`), not JWT email claims alone.
- Uploads: HTTP 503.
- Instant Demo: false and localhost-only.
