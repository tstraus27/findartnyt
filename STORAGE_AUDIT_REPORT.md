# FindArtNYC Storage Audit

Date: 2026-07-17

## Executive Summary

The project is moving in the right direction. The durable backend model is Supabase/Postgres, and the important public/admin concepts now have real tables: exhibitions, staging items, review decisions, admin actions, featured content, saved exhibitions, venues, and profiles.

The biggest storage risk is not the featured block. Featured content is already stored in a proper database table, and the publish flow archives prior published blocks instead of deleting them. The bigger risk is that the system still has two worlds: checked-in/generated JSON files for ingestion and local fallback, and Supabase for the real hosted backend. That is workable during development, but production should treat Supabase as the source of truth and JSON as import/export/backup artifacts.

Current local data snapshot:

- Canonical public JSON records: 22
- Staging source files: 19
- Staged exhibition items: 136
- Pending staged items: 93
- Approved staged items still in staging: 38
- Rejected staged items: 5
- Needs-revision staged items: 0

## What Is Stored Where

### Supabase Tables

`profiles`

Stores signed-in users and roles: visitor, reviewer, admin, owner. This is the right place for identity and permissions.

`venues`

Stores venue name/address/location metadata. This is the right idea, but venue normalization is still incomplete because many exhibition records also carry venue text directly.

`exhibitions`

Stores canonical public exhibition records. This should be the production source of truth for the public site.

`staging_items`

Stores proposed exhibition data before approval. The flexible `proposed jsonb`, `source jsonb`, `dedupe jsonb`, and `conflict jsonb` fields are appropriate here because staging data is messy and parser-shaped.

`review_decisions`

Stores reviewer recommendations and notes. Good: this preserves who reviewed what and when.

`admin_actions`

Stores admin actions with before/after JSON. Good: this is the audit trail for promotions, edits, status changes, and feature publishing.

`featured_content`

Stores featured blocks. This is the correct place for feature history. Statuses are `draft`, `published`, and `archived`. Publishing a new block archives the previously published block instead of deleting it.

`saved_exhibitions`

Stores per-user saved exhibitions. This is fine for future visitor accounts.

### Local / Generated Files

`data/exhibit-records.json`

Local canonical fallback. Useful for development and static fallback, but should not be treated as the production authority once Supabase is live.

`data/staging/*.json`

Generated staging review artifacts from parser runs. Useful for reproducible ingestion and testing. In production, these should be synced into `staging_items`.

`scripts/exhibit-ingest/fixtures/*`

Captured source HTML/JSON fixtures. These are good for parser tests and source verification.

`data/public-launch-readiness.json`

Generated readiness report. Useful, but not durable app data.

Browser `localStorage`

Used only as a local fallback for decisions/proposal edits when Supabase is not configured. This is acceptable for local development only. It is not a proper shared storage system.

## What Is Going Right

1. The important production data is modeled in Supabase, not hidden in HTML.
2. Row-level security is in place for public, reviewer, and admin behavior.
3. Featured content has a real lifecycle: draft, published, archived.
4. Publishing featured content writes an `admin_actions` audit entry.
5. Review decisions and admin actions are append-only-ish history tables, which is exactly the right shape for accountability.
6. Staging data preserves raw-ish proposed/source/dedupe/conflict JSON, which is useful because source intake is variable.
7. The public site can fall back to local JSON if Supabase is not configured, which is helpful during development.

## Risks / Weak Spots

1. Two sources of truth still exist during development: JSON files and Supabase. That can cause confusion unless the deployment process clearly says which one wins.
2. Some approved items still sit in staging. Locally, there are 38 approved staged items that have not necessarily been promoted into canonical public records.
3. The `exhibitions` table has both `venue_id` and `venue_name`; this is practical, but venue data may drift unless promotion consistently normalizes venues.
4. `staging_items.proposed` is JSONB, which is good for staging, but it means validation must stay strong before promotion.
5. Existing Supabase projects need the updated featured-content read policy applied before the public can see archived feature history.
6. Local fallback decisions in `localStorage` are not shared. That is fine locally, but should never be mistaken for brother/admin review storage.
7. There is no explicit backup/export routine for Supabase yet.

## Feature History Recommendation

Use `featured_content` as the single source of truth for feature history.

Recommended lifecycle:

1. Create or edit a draft in `/admin/featured`.
2. Publish it.
3. Supabase sets it to `published`.
4. The previously published feature becomes `archived`.
5. The public site shows the current published feature and a feature-history archive.
6. The admin Featured page shows a table of all published/archived feature blocks.

Do not store feature history in HTML. Do not make a separate hand-edited JSON file for it. The current table-backed approach is the right one.

## Recommendations

1. Treat Supabase as production truth.

Keep JSON files for fixtures, tests, fallback, and imports. Once online, production reads/writes should go through Supabase.

2. Apply migrations before relying on feature history.

The migration now allows public reads for `published` and `archived` feature blocks while keeping drafts admin-only.

3. Add a regular Supabase backup/export script.

At minimum, export `exhibitions`, `featured_content`, `admin_actions`, `review_decisions`, and `staging_items` before major ingest or deployment work.

4. Add a “promoted vs approved staging” admin alert.

Approved-but-unpromoted staging items are easy to miss. The UI should eventually call this out clearly.

5. Normalize venues more aggressively over time.

The site should eventually promote venue data into `venues` and consistently link exhibitions by `venue_id`.

6. Keep staging JSONB, but validate before promotion.

The current approach is good: flexible staging, stricter canonical tables. Do not make the public `exhibitions` table a giant unstructured JSON blob.

7. Add feature-history editing controls later.

The archive is now visible. Later, add admin controls to restore, archive, or duplicate an old feature block.

## Bottom Line

The storage architecture is kosher enough to keep building on. Featured history belongs in `featured_content`, and the existing lifecycle supports that. The main next hardening work is operational: make Supabase the clear production source of truth, run migrations carefully, back up database tables, and reduce ambiguity between generated JSON artifacts and live backend data.
