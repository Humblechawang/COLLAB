# Architecture

Static SPA → Bearer → Express JWKS → transaction-scoped `request.jwt.claims` + `SET LOCAL ROLE authenticated` → Postgres RLS (`auth.uid()`). Auth HTTP API for sign-in. No Data API from the browser.

Uploads are disabled until Storage is approved.
