# Database Migration Preflight

**Inspection date:** 2026-10-02  
**Mode:** read-only PostgreSQL transaction; no application rows were selected or modified.

## Current live state

The configured Supabase database is reachable with the migration connection. The public schema contains the legacy baseline objects:

- Tables: `users`, `sessions`, `teams`, `members`, `invites`, `posts`, `post_images`, `post_likes`, `post_comments`, `work_items`, `work_attachments`, `announcements`, and `audit_log`.
- All 13 legacy application tables reported zero rows.
- The expected baseline columns, constraints, indexes, enum labels, and three `touch_updated_at` triggers are present.
- `_migrations` exists with no recorded migration names. The failed runner attempt created it before the baseline file failed on the existing `users` relation. `backend/src/db/migrate.js` sorts SQL filenames and applies files whose names are not present in that table.
- No `profiles` table exists.

## Differences from the baseline file

- `citext` is installed in `public`, while the baseline requests the `extensions` schema. The extension is present and current types use `citext`.
- RLS is enabled on the existing application tables, but RLS is not forced and the catalog reports no policies. This is not the baseline's RLS state and leaves authenticated API behavior unverified/blocked until a separately reviewed additive policy migration is designed.
- The migration ledger is empty because the baseline was applied manually, not through this runner.
- RLS is enabled for every legacy application table, but the policy catalog is empty and `FORCE ROW LEVEL SECURITY` is off. This additional live security state is not defined by the baseline SQL and must be handled by a separately reviewed additive policy migration; the held historical migrations must not be used to replace policies.

These differences are recorded rather than “fixed” by reapplying or rewriting baseline objects.

## Authentication identity findings

Read-only aggregate results:

- `public.users`: 0 rows.
- `auth.users`: 0 rows.
- Same-ID matches: 0.
- Email matches, including differing IDs: 0.

There are no existing records from which to infer or verify a legacy-to-Supabase identity mapping. The legacy child foreign keys (`teams.created_by`, `members.user_id`, post/work authors, and others) reference `public.users(id)`. The current Express auth middleware sets `req.user.id` to the JWT `sub`, which is a Supabase `auth.users.id`; the current `auth/me` handler expects `public.profiles`, which is absent. Therefore current Auth IDs must not be assumed to match the legacy app-user IDs.

### Required identity strategy before Auth-backed writes or Chat

1. Keep legacy `public.users.id` and its child foreign keys intact.
2. Define an explicit, unique mapping between `auth.users.id` and `public.users.id`; do not map by unverified email or rewrite IDs in place.
3. Resolve JWT `sub` to the mapped app-user ID inside the authenticated API flow before operations that write to legacy foreign keys.
4. For future signup/provisioning, specify how the legacy `users.password_hash NOT NULL` field is handled without enabling local password auth or writing a misleading credential. This requires an API/schema plan before any migration.
5. Only after that identity plan is approved should a future additive migration add the mapping/profile structures and narrowly scoped RLS policies.

Because both identity tables currently contain zero rows, no backfill is required today; this does not prove IDs will match for future accounts.

## Chat scope

Chat is not present in the current PRD, API routes, or baseline schema. No Chat tables or migration are proposed. If Chat is approved later, conversation participants and message authors must reference the verified identity mapping and team membership model, with RLS designed before deployment.

## Baseline adoption and SQL change

The baseline tables, columns, constraints, indexes, enums, and triggers were compared against the live catalog and are sufficiently present to record that the manually applied baseline was adopted. The `citext` schema placement and RLS state above remain documented deviations. The only immediate database write proposed is migration bookkeeping, not schema/data modification:

```sql
INSERT INTO public._migrations (name)
VALUES ('20260930000000_baseline.sql')
ON CONFLICT (name) DO NOTHING;
```

This does not mark `20260930001000_auth_profiles_rls.sql`, `20260930002000_express_only_rls.sql`, or `20260930003000_rls_request_jwt.sql` as applied. They remain unapplied and must not be run automatically: `0010` drops `public.users` and `public.sessions`; the later files drop/rewrite policies and grants. A forward-only migration runner must explicitly skip/hold these historical migrations before future runs.

## Safety status

- No migration was applied by this preflight.
- No app rows were read or modified.
- No tables, columns, constraints, indexes, functions, triggers, policies, or identity values were changed.
- The baseline ledger marker is the only SQL write proposed; it should be applied only after the migration runner has been guarded from the historical destructive files.
