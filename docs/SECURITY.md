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
- Auth: Supabase Auth JS handles signup, six-digit email OTP verification, sign-in, and sign-out. The browser bundle contains only the publishable key; never add a service-role key.
- Password policy: the UI checks a minimum of six characters plus uppercase, lowercase, digit, and special character. Enforce the same policy in Supabase Auth settings; client-side checks alone are bypassable.
- OTP policy: require email confirmation and configure the Supabase email template to send a six-digit token. Rate limits must be configured in Supabase Auth because the browser calls Auth directly.
- No Instant Demo or shared demo-account sign-in is available.
- Team setup is not persisted until the separate Auth-to-legacy-user identity and RLS migration is reviewed and approved. Do not work around this with direct PostgREST access or a service-role key.
