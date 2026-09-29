# Security

This document lists every security control actually implemented in this
codebase, where it lives, and what it protects against. Anything marked
**Pluggable** is wired with a real interface but needs a production
credential or service before it does anything.

## Authentication

| Control | Where | Protects against |
|---|---|---|
| Passwords hashed with bcrypt (cost 12+) | `middleware/auth.js` | Password exposure if the database leaks |
| Password policy: 10+ chars, mixed case, number | `utils/validate.js` | Weak, guessable passwords |
| Short-lived JWT access tokens (15 min) | `middleware/auth.js` | Long-lived stolen tokens |
| Opaque refresh tokens, stored only as SHA-256 hash | `middleware/auth.js`, `sessions` table | A database leak alone can't be replayed as a session |
| Refresh token rotation on every use | `routes/auth.js` `/refresh` | Replay of a stolen refresh token — reuse of an already-rotated token is a detectable signal |
| Account lockout after 8 failed logins (15 min) | `middleware/auth.js` | Brute-force password guessing |
| Generic "incorrect email or password" error | `routes/auth.js` | Account enumeration |
| httpOnly, Secure, SameSite=Strict cookies | `routes/auth.js` | Token theft via XSS; CSRF |

## Authorization

| Control | Where | Protects against |
|---|---|---|
| Server-side role lookup on every team request | `middleware/authorize.js` | A client claiming a role it doesn't have |
| Public/team visibility enforced in the SQL query itself | `routes/posts.js`, `routes/work.js` | Private content leaking to unauthenticated requests |
| "Last owner" guard on role changes | `routes/members.js` | A team accidentally locking itself out of admin control |
| Post/work delete limited to author or admin/owner | `routes/posts.js`, `routes/work.js` | Members deleting each other's contributions |

## Input handling

| Control | Where | Protects against |
|---|---|---|
| Zod schema on every request body, explicit max lengths | `utils/validate.js` | Oversized payloads, malformed data, injection via unbounded fields |
| Parameterized SQL exclusively (`db/pool.js`) | every route | SQL injection |
| HTML sanitization on post/comment bodies | `routes/posts.js` | Stored XSS |
| JSON body size capped at 100kb | `server.js` | Payload-based denial of service |

## File uploads

| Control | Where | Protects against |
|---|---|---|
| Server-generated filenames (never the client's) | `middleware/upload.js` | Path traversal, executable-extension tricks |
| MIME allowlist per upload type | `middleware/upload.js` | Disallowed file types |
| Magic-byte verification against declared type | `middleware/upload.js` | A renamed `.exe` masquerading as `.png` |
| Size limits (5MB images, 10MB documents, configurable) | `middleware/upload.js` | Storage exhaustion |
| **Pluggable**: external AV scan hook (`AV_SCAN_URL`) | `middleware/upload.js` | Malware in uploaded files — wire to ClamAV or a scanning API before accepting real uploads |

## Transport & headers

| Control | Where | Protects against |
|---|---|---|
| Helmet: CSP, HSTS, `frame-ancestors: none`, no sniffing | `middleware/security.js` | Clickjacking, MIME sniffing, mixed content |
| CORS allowlist (no wildcard, credentials scoped) | `middleware/security.js` | Cross-origin credential theft |
| `trust proxy` set to exactly one hop | `server.js` | IP spoofing via forged `X-Forwarded-For` |

## Rate limiting & abuse prevention

| Control | Where | Protects against |
|---|---|---|
| General API rate limit | `middleware/security.js` | Bulk scraping, basic DoS |
| Tighter limit on `/api/auth/*` | `middleware/security.js` | Credential stuffing |
| Invite-creation limit (20/hour/team) | `middleware/security.js` | Invite-spam abuse of the email system |
| Single-use, expiring, revocable invites | `routes/invites.js` | Stale or leaked invite links |

## Observability & incident response

| Control | Where | Protects against |
|---|---|---|
| Append-only audit log of privileged actions | `utils/audit.js`, `audit_log` table | Undetected privilege abuse; supports forensics |
| Structured logs with credential/token redaction | `config/logger.js` | Secrets leaking into log aggregation |
| Request IDs on every response | `middleware/security.js` | Correlating a user's bug report to server logs |
| Generic 5xx responses, no stack traces to the client | `middleware/security.js` | Information disclosure via error messages |

## Secrets management

- No secret has a working default in production (`config/index.js` refuses
  to boot with a placeholder JWT secret when `NODE_ENV=production`).
- `.env` is git-ignored; CI (`ci.yml`) fails the build if one is ever
  committed.
- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` periodically; rotating
  the refresh secret invalidates all active sessions, which is expected.

## Known gaps to close before handling real user data

These are not implemented yet and should be treated as launch blockers, not
nice-to-haves:

1. **Multi-factor authentication** — not implemented. Add TOTP before
   handling anything sensitive.
2. **Real malware scanning** — the hook exists; no scanner is wired in.
3. **Dependency scanning in CI** is a basic `npm audit`; add Snyk or
   Dependabot for continuous monitoring.
4. **Penetration test** — this document describes intended controls, not a
   third-party verification that they hold under attack. Commission one
   before launch.
5. **Data retention / deletion (GDPR-style "right to erasure")** — soft
   deletes are used for posts and work items for audit purposes; a real
   account-deletion flow that also purges PII needs to be designed.
6. **Backups and restore testing** — configure automated Postgres backups
   and actually rehearse a restore before launch.
