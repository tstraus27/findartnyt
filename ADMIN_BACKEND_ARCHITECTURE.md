# FindArtNYC Admin Backend Architecture

This repo now has a Phase 1 + Phase 2 backend foundation for remote source review, admin promotion, featured content, and backend-backed public catalog reads.

## Stack

- Frontend: Vite/React.
- Backend/auth/database: Supabase Auth + Postgres.
- Security boundary: Postgres row-level security policies and security-definer RPC functions in `supabase/migrations/20260716120000_find_art_backend.sql`.
- Local fallback: existing JSON files under `data/` and `data/staging/` still power local development when Supabase env vars are absent.

## Roles

- `visitor`: future normal account role for saved exhibitions/lists.
- `reviewer`: can read staging queues and submit recommendations.
- `admin`: can read reviewer decisions, promote/reject/request revision, manage featured content, and update roles.
- `owner`: admin-level role reserved for future top-level account management.

The important boundary is: reviewers recommend; admins promote. The browser UI reflects this, but the real enforcement is in database policies and RPC functions.

## Data Model

The migration creates:

- `profiles`: Supabase auth user profile and role.
- `venues`: normalized venue metadata.
- `exhibitions`: approved public catalog records.
- `staging_items`: imported staged proposals from the existing ingestion JSON flow.
- `review_decisions`: reviewer/admin recommendations and notes.
- `admin_actions`: audit log for promotion, rejection, revision requests, and featured content publishing.
- `featured_content`: draft/published/archived public content block.
- `saved_exhibitions`: minimal future account feature table so visitor saves have a clean landing spot later.

## Data Flow

1. Existing ingestion scripts continue writing `data/staging/*.json`.
2. Run `npm run sync:staging-to-db` with service-role credentials to upsert those JSON staging items into Supabase.
3. Reviewers sign in at `/admin/login` and use `/admin/review` to mark `looks_good`, `reject`, `needs_revision`, or `comment`.
4. Admins use `/admin/review` to promote, reject, or request revision.
5. Promotion runs `admin_promote_staging_item`, which writes/updates `venues`, writes/updates `exhibitions`, marks the staging item `promoted`, and logs an `admin_actions` audit row.
6. The public catalog loads published `exhibitions` from Supabase. If Supabase is not configured or returns no records, the site falls back to the current local JSON catalog.

## Featured Content

Admins can use `/admin/featured` to draft or publish a featured block. Publishing archives other published blocks and exposes the newest published content on the public catalog page.

Local fallback does not publish featured content because shared content mutation requires Supabase.

## Environment

Copy `.env.example` to `.env` and fill:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`VITE_*` keys are browser-safe. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is only used by scripts such as `sync:staging-to-db`.

## Manual Supabase Setup

1. Create a Supabase project.
2. Apply `supabase/migrations/20260716120000_find_art_backend.sql`.
3. Create auth users for reviewers/admins.
4. Set their `profiles.role` values to `reviewer`, `admin`, or `owner`.
5. Run `npm run sync:staging-to-db` after staging JSON files are generated.
6. Deploy the Vite site with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Routes

- `/admin/login`: Supabase email/password sign-in.
- `/admin`: workflow dashboard.
- `/admin/review`: reviewer/admin staging queue.
- `/admin/history`: admin review history/status browser for approved, rejected, revision, and promoted items.
- `/admin/intake`: admin-only automatic intake health monitor with latest run status, refresh overdue signals, diagnostic tags, and recent intake log events.
- `/admin/featured`: admin-only featured content editor.

When Supabase env vars are absent, `/admin/login` clearly enters a local JSON fallback for development. This is not the remote security path.

## Source Website Preview

The review screen is designed as four panes: source list, staged item list, editable staged proposal, and source website preview.

Some museum websites block direct iframe embedding. For production, deploy the Supabase Edge Function in `supabase/functions/source-preview` and set:

```bash
VITE_SOURCE_PREVIEW_URL=https://YOUR_PROJECT_ID.functions.supabase.co/source-preview
```

Without that value, the review page tries to embed the official source URL directly and also provides an "open source" link.

## Manual Staging Edits

Admins can edit staged proposal fields before promotion. The backend function `admin_update_staging_proposed` updates `staging_items.proposed`, marks the item for revision unless it was already promoted, and writes an `admin_actions` audit row.

## Automatic Intake Health

Apply `supabase/migrations/20260720120000_intake_health.sql` after the base backend migration. It creates `intake_runs`, `intake_log_events`, and `intake_source_health`.

The scheduled workflow template is `docs/github-workflows/automatic-intake.yml`. Copy it to `.github/workflows/automatic-intake.yml` with a GitHub token that has `workflow` scope. It runs weekly on Monday at 11:15 UTC and can also be started manually from GitHub Actions. Configure these repository secrets before enabling it:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The workflow calls:

```bash
npm run intake:auto
```

That command attempts each live-capable source independently, upserts successful staging rows into Supabase, and records both successes and failures to the intake health tables. A failed source does not stop later sources from being attempted, but the workflow exits non-zero when any source fails so GitHub Actions still surfaces the run as needing attention.

Met, MoMA, and Brooklyn Museum currently rely on browser-assisted or fixture refresh workflows and are not part of the live source-config sweep until their direct automated fetch path is resolved.

## Future Path

The schema leaves room for:

- visitor accounts and `saved_exhibitions`;
- user-created lists;
- public/editorial posts in a future `content_posts` table;
- forum/community features with profile-based moderation roles.

Those features should build on `profiles.role`, RLS policies, and service/RPC functions rather than adding client-only permission checks.
