# API Reference

Base URL: `https://api.collab.app` (local: `http://localhost:4000`)

All authenticated requests rely on the `access_token` httpOnly cookie set by
`/api/auth/login` or `/api/auth/signup`. If you're calling the API from a
non-browser client, you may instead send `Authorization: Bearer <token>`.

Every error response has the shape `{ "error": "message", "requestId": "..." }`.

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | none | Create an account. Body: `fullName, email, password` |
| POST | `/api/auth/login` | none | Sign in. Body: `email, password` |
| POST | `/api/auth/refresh` | refresh cookie | Rotate tokens |
| POST | `/api/auth/logout` | required | Revoke all sessions for the caller |
| GET | `/api/auth/me` | required | Current user profile |

## Teams

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/teams` | required | Create a team. Body: `name, slug, tagline?`. Caller becomes owner. |
| GET | `/api/teams/:teamId` | public if team is public, else member | Team profile |
| PATCH | `/api/teams/:teamId` | owner/admin | Update name, tagline, bio, `isPublic` |

## Members

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/teams/:teamId/members` | member | List members with roles |
| PATCH | `/api/teams/:teamId/members/:userId/role` | owner | Change a member's role |
| DELETE | `/api/teams/:teamId/members/:userId` | owner/admin | Remove a member |

## Invites

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/teams/:teamId/invites` | owner/admin | Invite by email. Body: `email, role?` |
| GET | `/api/teams/:teamId/invites` | owner/admin | List pending invites |
| DELETE | `/api/teams/:teamId/invites/:inviteId` | owner/admin | Revoke a pending invite |
| POST | `/api/teams/accept` | required | Accept an invite. Body: `token` |

## Posts

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/teams/:teamId/posts` | public if visible | Feed (up to 50 latest) |
| POST | `/api/teams/:teamId/posts` | member | Create a post. `multipart/form-data`: `tag, body, linkUrl?, visibility?, images[]` (up to 4) |
| DELETE | `/api/teams/:teamId/posts/:postId` | author or owner/admin | Soft-delete a post |
| POST | `/api/teams/:teamId/posts/:postId/like` | member | Like a post |
| DELETE | `/api/teams/:teamId/posts/:postId/like` | member | Unlike a post |
| POST | `/api/teams/:teamId/posts/:postId/comments` | member | Comment. Body: `body` |

## Work items

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/teams/:teamId/work` | public if visible | List work items |
| POST | `/api/teams/:teamId/work` | member | Create. `multipart/form-data`: `title, description?, status, linkUrl?, visibility?, attachment?` |
| DELETE | `/api/teams/:teamId/work/:workId` | creator or owner/admin | Soft-delete a work item |

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | none | Liveness check for load balancers / container orchestration |

## Rate limits (defaults, configurable via `.env`)

- General API: 100 requests / 15 min / IP
- Auth endpoints: 10 requests / 15 min / IP
- Invite creation: 20 / hour / team

## Connecting the current frontend

`frontend/index.html` currently keeps all state in an in-memory JS object
(`S`) and never calls this API. To connect it:

1. Replace the in-memory `S.users`, `S.posts`, `S.work`, etc. reads/writes
   with `fetch()` calls to the endpoints above.
2. Send `credentials: 'include'` on every fetch so the auth cookies attach.
3. On a 401 response, call `/api/auth/refresh` once and retry; on a second
   401, redirect to `/login`.
4. Replace the client-side form validation with the server's actual
   422 error messages (keep the client-side checks too, as a UX nicety —
   the server validation is what actually matters for security).
