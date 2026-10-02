# QA Checklist

Run through this before any public launch. None of this has been executed
against a live deployment yet — treat every box as unchecked.

## Functional

- [ ] At phone width, brand lockup reads as C + “ollab” and dashboard controls stay aligned
- [ ] Home update rail and post media scroll horizontally; Posts timeline scrolls vertically
- [ ] Scroll reveals and heading shimmer run once and respect reduced motion
- [ ] Sign up rejects passwords shorter than 6 or missing uppercase, lowercase, digit, or special character
- [ ] Sign up sends a six-digit email OTP; valid, invalid, expired, and resent codes behave correctly
- [ ] Existing email is directed to sign-in; sign-in uses the same generic error for unknown email and wrong password
- [ ] Sign in, sign out, and token refresh all work end to end
- [ ] No Instant Demo or shared demo-account sign-in entry point remains
- [ ] A verified account reaches team setup and is shown as Owner; Admin/Member are assigned per invite
- [ ] Team setup clearly states it is non-persistent until the identity/RLS migration is approved
- [ ] `/readyz` fails when the database is down
- [ ] User A cannot like/comment/invite using user B's resource IDs
- [ ] Creating a team assigns the creator as owner
- [ ] Inviting a member sends an email (or logs the link in dev) and the
      invite can be accepted exactly once
- [ ] An invite email that doesn't match the signed-in user's email is rejected
- [ ] Expired or revoked invites are rejected
- [ ] Posts, comments, and work items respect the `public` / `team` visibility flag
- [ ] A logged-out visitor can view a public team page but sees no edit controls
- [ ] Deleting a post/work item is restricted to its author or an owner/admin
- [ ] The last owner of a team cannot be demoted or removed
- [ ] File uploads reject disallowed types, oversized files, and files whose
      content doesn't match their declared type

## Security

- [ ] `npm audit` (or Snyk) run against both `backend` and any frontend
      build tooling, high/critical issues resolved
- [ ] Supabase Auth rate limits confirmed to trigger for login, signup, and OTP requests; API auth routes return 410
- [ ] CORS rejects an unlisted origin
- [ ] Cookies are `HttpOnly`, `Secure`, `SameSite=Strict` in a production-like environment
- [ ] SQL injection attempted against every text input and rejected (parameterized queries should hold)
- [ ] XSS payload in a post body is stored sanitized and renders as inert text
- [ ] JWT with a tampered signature is rejected
- [ ] A stale/rotated refresh token is rejected if replayed
- [ ] Third-party penetration test scheduled or completed

## Accessibility

- [ ] Full keyboard navigation through sign-in, dashboard, and post composer
- [ ] Screen reader announces form errors (`role="alert"` regions are used
      throughout the frontend already — verify with a real screen reader)
- [ ] Color contrast meets WCAG AA in both light and (if enabled) dark mode
- [ ] `prefers-reduced-motion` disables scroll/float animations (already
      implemented in the frontend CSS — verify it actually applies)

## Performance

- [ ] Lighthouse score on the public team page (target 90+ performance)
- [ ] API p95 latency under load-tested traffic
- [ ] Database queries reviewed with `EXPLAIN ANALYZE` for anything on a hot path
- [ ] Image uploads are resized/compressed before storage (not yet implemented)

## Data

- [ ] Backup restore actually rehearsed, not just configured
- [ ] Migration runner (`npm run migrate`) tested against a fresh empty database
- [ ] Soft-deleted rows excluded correctly everywhere they should be

## Pre-launch legal

- [ ] Privacy Policy and Terms of Service reviewed by legal counsel (the
      frontend copy is a placeholder, explicitly marked as such)
- [ ] Data processing agreement in place with any third-party provider
      (email, storage, AV scanning) that touches user data
