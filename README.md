# Collab

Public team portfolio for hackathon teams, clubs, and early-stage startups.

Static frontend → Express API → Supabase Auth + Postgres. Browsers must not call PostgREST.

```
collab/
├── frontend/
├── backend/
├── supabase/migrations/
├── database/schema.sql   historical reference
└── docs/
```

## Setup (after you create a project and approve migrate)

1. Copy `backend/.env.example` → `backend/.env`. Use **collab_api** for `DATABASE_URL` and migrator for `DATABASE_MIGRATE_URL`. Publishable key only.
2. Copy `frontend/config.example.js` → `frontend/config.js`.
3. `npm --prefix backend install`
4. Migrate only when approved (`docs/MIGRATIONS.md`). Empty project; backup first.
5. `npm --prefix backend run dev` and serve `frontend` on port 8080.

Custom passwords are not imported. Uploads return 503 until Storage is approved separately.
