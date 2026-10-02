# API Reference

Base URL: local `http://localhost:4000`. Send `Authorization: Bearer <Supabase access token>`. Cookies are not used for auth.

Sign-up, sign-in, and password reset are **Supabase Auth**, not this API (`POST /api/auth/signup|login|refresh` return **410**).

GET `/healthz` — liveness.  
GET `/readyz` — 503 if Postgres is unreachable.

Invite `role` may be `admin` or `member` only.

Errors: `{ "error": "message", "requestId": "..." }`.

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | none | **410** — use Supabase Auth |
| POST | `/api/auth/login` | none | **410** |
| POST | `/api/auth/refresh` | none | **410** |
| POST | `/api/auth/logout` | required | Audit log only (JWT cannot be revoked here) |
| GET | `/api/auth/me` | required, confirmed email | Upsert `profiles` for `sub` |
| PATCH | `/api/auth/me` | required, confirmed email | `fullName`, `bio` |

## Teams

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/teams` | confirmed email | Create team; caller becomes owner |
| GET | `/api/teams/:teamId` | public if public team, else member | Team profile |
| PATCH | `/api/teams/:teamId` | owner/admin | Update name/tagline/bio or set `isPublic` true/false; visibility changes are audited |

## Members

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/teams/:teamId/members` | member | List members |
| PATCH | `/api/teams/:teamId/members/:userId/role` | owner | Change role |
| DELETE | `/api/teams/:teamId/members/:userId` | owner/admin | Remove member |

## Invites

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/teams/:teamId/invites` | owner/admin | Invite by email |
| GET | `/api/teams/:teamId/invites` | owner/admin | Pending invites |
| DELETE | `/api/teams/:teamId/invites/:inviteId` | owner/admin | Revoke |
| POST | `/api/teams/accept` | confirmed email | Body: `token`. Email must match invite |

## Posts / work

GET list (public vs member visibility). POST JSON only. **Multipart uploads return 503.** Members may soft-delete only their own posts/work; owners/admins may soft-delete any team item. Deletes re-check current membership and role in the mutation. Likes/comments require membership and matching `team_id`.

## Rate limits (defaults)

- General: 100 / 15 min / IP
- Auth paths: 10 / 15 min / IP
- Invites: 20 / hour / IP

## Frontend

Use Supabase JS **Auth** + Bearer to this API. Do not query tables through the Data API.
