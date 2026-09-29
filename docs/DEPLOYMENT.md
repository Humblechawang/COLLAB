# Deployment

- **Frontend:** static files. Copy `frontend/config.example.js` → `frontend/config.js` (gitignored). Publishable key only. No PostgREST from the browser.
- **API:** Node 20. `DATABASE_URL` = pooler as **collab_api**. `DATABASE_MIGRATE_URL` = session/direct as migrator only.
- **Auth:** Supabase Auth. Express verifies JWTs via JWKS at `{SUPABASE_URL}/auth/v1`.
- **Data API:** off. Frontend must not call PostgREST.
- After migrate: Auth confirm-email on; `collab_api` password set; pooler URI in `DATABASE_URL`.
- Set `CORS_ORIGINS`, `DATABASE_SSL=true`. Never put a service-role key in the frontend or `.env.example`.

Health: `/healthz`, `/readyz`. Backups: Supabase dashboard.
