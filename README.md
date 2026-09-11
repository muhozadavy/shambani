# Shambani

A three-app marketplace connecting East African farmers with wholesale buyers.

- `farmer-app.html` — farmer-facing app: list crops, respond to buying requests, manage deals
- `buyer-app.html` — buyer-facing app: browse listings, post buying requests, manage offers
- `admin.html` — internal admin panel

Each app is a single self-contained HTML/CSS/JS file with no build step, ready to be
wrapped with [Capacitor](https://capacitorjs.com/) for iOS/Android distribution.

## Backend

Supabase (Postgres + Auth + Storage + Realtime), using a dedicated `marketplace`
schema with Row Level Security enabled on every table. Client code connects with
the publishable (anon) key, which is safe to ship in these files by design; access
is enforced entirely through RLS policies, not by keeping the key secret.

`migrations/` mirrors the recent hand-written migrations applied directly via the
Supabase MCP tooling, named with their applied timestamp. It does not include the
original schema setup (tables, initial RLS policies, grants), which exists only in
Supabase's own migration history for this project.

## Status

Soft launch build. See the project's internal notes for the deployment and
infrastructure plan.
