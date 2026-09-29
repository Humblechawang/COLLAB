# Deployment

## Recommended shape for a first production deployment

- **Frontend**: static hosting + CDN (Cloudflare Pages, Vercel, Netlify, or
  S3 + CloudFront). `frontend/index.html` is a single self-contained file.
- **Backend**: containerized (the provided `Dockerfile`) on any container
  platform — Fly.io, Render, ECS/Fargate, Cloud Run, or a plain VM behind
  Nginx. Run at least 2 replicas behind a load balancer for availability.
- **Database**: managed Postgres (RDS, Cloud SQL, Neon, Supabase's Postgres).
  Do not run your own unmanaged Postgres for production data.
- **Object storage**: S3-compatible bucket for uploaded images/files, served
  via signed URLs, not through the API server.
- **Email**: a transactional provider (Resend, SES, Postmark) — see
  `backend/src/utils/email.js`.

## Steps

1. **Provision Postgres.** Create the database, then run:
   ```bash
   DATABASE_URL=postgres://... npm --prefix backend run migrate
   ```
2. **Generate real secrets.**
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to two *different*
   generated values.
3. **Set environment variables** on your hosting platform from
   `backend/.env.example`. At minimum: `DATABASE_URL`, `DATABASE_SSL=true`,
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` (your real
   frontend domain), `COOKIES_SECURE=true`.
4. **Build and push the API image:**
   ```bash
   docker build -t collab-api ./backend
   docker push <your-registry>/collab-api
   ```
5. **Point the frontend's API base URL** at your deployed backend once the
   frontend is wired to call it (see `docs/API.md`).
6. **Put the API behind TLS.** Terminate HTTPS at your load balancer or
   platform's edge — the app assumes it is always reached over HTTPS in
   production (`COOKIES_SECURE=true` enforces this for cookies).
7. **Configure backups** on the managed Postgres instance and actually
   rehearse a restore before launch.
8. **Wire monitoring.** At minimum: uptime checks against `/healthz`, and
   log aggregation for the structured JSON logs this app already emits.

## Zero-downtime deploys

The server handles `SIGTERM` gracefully (`src/server.js`): it stops
accepting new connections, lets in-flight requests finish (up to 10s), then
exits. Configure your orchestrator's deploy strategy (rolling update) to
rely on this rather than hard-killing containers.

## Scaling

The API is stateless — sessions live in Postgres, not in server memory — so
you can run any number of API replicas behind a load balancer without
sticky sessions. The database will be the first bottleneck; add read
replicas or connection pooling (PgBouncer) before scaling the API further.
