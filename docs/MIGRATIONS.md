# Database Migrations: Forward-Only

## Current database

The live Supabase catalog was inspected read-only on 2026-10-02. The 13 legacy baseline tables and their columns, constraints, indexes, enum labels, and touch triggers match the baseline structure. All app-table row counts were zero at inspection. `auth.users` and `public.users` both had zero rows, so no legacy-to-Supabase ID mapping can be established from existing records. See [DATABASE_MIGRATION_PREFLIGHT.md](DATABASE_MIGRATION_PREFLIGHT.md) for details and deviations.

The baseline was applied manually. The runner-created `_migrations` table was empty. The baseline marker is recorded after catalog verification with this bookkeeping-only statement:

```sql
INSERT INTO public._migrations (name)
VALUES ('20260930000000_baseline.sql')
ON CONFLICT (name) DO NOTHING;
```

This does not change application rows or schema. It prevents the non-idempotent baseline from being run again.

## Historical migrations held

`backend/src/db/migration-policy.js` marks these scripts as held and the runner skips them:

- `20260930001000_auth_profiles_rls.sql` — drops `public.users` and `public.sessions`, then changes user foreign keys.
- `20260930002000_express_only_rls.sql` — drops/replaces policies and changes grants.
- `20260930003000_rls_request_jwt.sql` — drops/replaces policies and changes grants.

Do not mark these as applied and do not manually run them. The live database has RLS enabled but no policies; additive policy design must be reviewed separately.

## Adding a future migration

1. Confirm product and identity requirements first. The app currently uses Supabase JWT `sub` as the user ID, while existing content foreign keys reference `public.users.id`. Never assume these values are equal.
2. Write a new timestamped SQL file containing only additive, forward-compatible changes. No dropping, truncation, resets, or rewriting existing identities/data.
3. Document the exact SQL and rollback/compatibility plan in the PRD or migration preflight document.
4. Register the exact filename as `additive` in `backend/src/db/migration-policy.js`; unregistered files are blocked.
5. Back up and inspect the live schema before applying with `npm --prefix backend run migrate`.

Chat is not in the current PRD or API and has no migration. Do not add Chat tables until the identity mapping and membership RLS strategy are approved.

## Connection and TLS requirements

- `DATABASE_URL`: `collab_api` on the Supabase transaction pooler.
- `DATABASE_MIGRATE_URL`: owner/migrator on the session pooler.
- Keep `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
- If required, set `DATABASE_SSL_CA_FILE` to the verified Supabase CA certificate path. Never disable certificate verification to get past TLS errors.
- Keep Supabase Data API/PostgREST disabled for app tables and require confirmed emails in Auth.
