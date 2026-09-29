# Migrations (empty Supabase only)

Do not apply until you explicitly approve.

Order: `20260930000000_baseline.sql` → `20260930001000_auth_profiles_rls.sql` (drops `users`/`sessions`) → `20260930002000_express_only_rls.sql` → `20260930003000_rls_request_jwt.sql`.

Staging command (from repo `collab/` after filling `.env`):

`npm --prefix backend run migrate`

Then set `collab_api` password in the Dashboard. `DATABASE_URL` must be `collab_api`. Disable Data API. Require confirmed emails in Auth.
