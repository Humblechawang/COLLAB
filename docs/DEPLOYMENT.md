# Deployment

- **Frontend:** static files. Copy `frontend/config.example.js` → `frontend/config.js` (gitignored). Publishable key only. No PostgREST from the browser.
- **API:** Node 20. `DATABASE_URL` = pooler as **collab_api**. `DATABASE_MIGRATE_URL` = session/direct as migrator only.
- **Auth:** Supabase Auth. Express verifies JWTs via JWKS at `{SUPABASE_URL}/auth/v1`.
- **Data API:** off. Frontend must not call PostgREST.
- After migrate: Auth confirm-email on; `collab_api` password set; pooler URI in `DATABASE_URL`.
- Set `CORS_ORIGINS`, `DATABASE_SSL=true`, and `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
- If using Supabase's custom database CA, set `DATABASE_SSL_CA_FILE` to the downloaded PEM certificate path. Keep certificate verification enabled; do not work around TLS errors by setting `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
- `DATABASE_URL` uses the `collab_api` transaction-pooler role; `DATABASE_MIGRATE_URL` uses the owner/migrator session-pooler role.
- Never put a service-role key in the frontend or `.env.example`.

Health: `/healthz`, `/readyz`. Backups: Supabase dashboard.
