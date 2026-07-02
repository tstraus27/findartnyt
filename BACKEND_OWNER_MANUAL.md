# Backend Owner Manual

This is the human-facing control document for the exhibition discovery backend. It explains what exists now, what Codex can safely change, and where human approval remains central.

## What Is The Backend Right Now?

The backend is currently a file-based ingestion and review system inside this repo.

It has four main parts:

- Source adapters in `scripts/exhibit-ingest/parsers/`
- Source configs in `scripts/exhibit-ingest/sources/`
- Staging reports in `data/staging/`
- A temporary canonical JSON store in `data/exhibit-records.json`

There is not yet a PostgreSQL database, backend API server, or in-repo Google Sheets integration. If a Google Sheet exists outside this workspace, treat it as external project context that needs to be documented before syncing or replacing it.

The most important product idea is already present: ingestion proposes records; humans approve them.

## What Data Exists?

Current data files:

- `data/exhibit-records.json`: temporary canonical store. It currently has an empty `records` array unless approved records have been promoted.
- `data/staging/new-museum-exhibitions.json`: staged exhibition candidates from the official New Museum exhibitions page.
- `data/staging/david-zwirner-exhibitions.json`: staged NYC exhibition candidates from the official David Zwirner exhibitions index page when the source-specific staging command is run.
- `data/staging/icp-exhibitions.json`: staged exhibition candidates from the official ICP exhibitions page plus linked official exhibition detail pages, currently limited to the `current` and `upcoming` card sections on the main exhibitions index.
- `data/staging/jewish-museum-exhibitions.json`: staged exhibition candidates from The Jewish Museum official exhibitions page server-rendered cards, currently limited to the visible `on view` and `coming soon` cards before the client-side schedule calendar.
- `data/staging/drawing-center-exhibitions.json`: staged exhibition candidates from The Drawing Center official exhibitions page server-rendered `onview` and `upcoming` listing modules, currently limited to those visible index-page sections and excluding `past`.
- `data/staging/frick-exhibitions.json`: staged exhibition candidates from The Frick Collection official exhibitions page, currently limited to the visible `Current` and `Upcoming` card blocks and excluding `Past`, `Virtual Exhibitions`, and detail-page enrichment.
- `data/staging/guggenheim-exhibitions.json`: staged exhibition candidates from the official Guggenheim exhibitions page bootstrap payload, currently limited to the embedded `on_view` and `upcoming` exhibition items from the index page.
- `data/staging/mad-exhibitions.json`: staged exhibition candidates from the official Museum of Arts and Design exhibitions page plus linked official exhibition detail pages, currently limited to the `Current Exhibitions` and `Upcoming` slices and excluding `Installations` plus `Past`.
- `data/staging/mcny-exhibitions.json`: staged exhibition candidates from the Museum of the City of New York official exhibitions page, currently limited to the visible `Exhibitions On View` and `Upcoming Exhibitions` card sections and excluding `Online Exhibitions`, `Traveling Exhibitions`, `Past`, and detail-page enrichment.
- `data/staging/morgan-exhibitions.json`: staged exhibition candidates from The Morgan Library & Museum official `current` and `upcoming` exhibitions pages, currently limited to the main exhibition listing grids and excluding the separate `Collection Spotlight` block on the current page plus `online`, `past`, and detail-page enrichment.
- `data/staging/noguchi-exhibitions.json`: staged exhibition candidates from The Noguchi Museum official `Current & Upcoming` exhibitions page, currently limited to the museum-only listing cards before the first explicit `offsite:` entry and deduped across duplicated desktop/mobile blocks.
- `data/staging/bronx-museum-exhibitions.json`: staged exhibition candidates from The Bronx Museum official exhibitions archive, currently limited to the visible `Current` exhibition-card grid and excluding the separate featured-show hero block, `Upcoming`, `Archive`, and detail-page enrichment.
- `data/staging/fit-exhibitions.json`: staged exhibition candidates from the Museum at FIT official exhibitions page, currently limited to the visible `Current` and `Upcoming` long-card sections only when a card exposes an official exhibition detail link, excluding closure notices, lobby-only cards without official exhibition pages, `MFIT on the Road`, `Past Exhibitions`, and detail-page enrichment.
- `data/staging/cooper-hewitt-exhibitions.json`: staged exhibition candidates from Cooper Hewitt official current and upcoming exhibition pages, currently limited to the visible main exhibition blocks plus `Learn more` links and excluding sponsor-logo sections, funding tails after the main exhibition copy, photo-credit blocks, previous/traveling/digital pages, and detail-page enrichment.
- `data/staging/poster-house-exhibitions.json`: staged exhibition candidates from the official Poster House exhibitions page, currently limited to the visible `On View` and `Upcoming Exhibitions` sections, using visible card markup for exact dates/images plus the same page's embedded exhibition payload for descriptions, and excluding `Past Exhibitions`, the archive link, poster-loan content, and detail-page enrichment.
- `data/staging/whitney-exhibitions.json`: staged exhibition candidates from the official Whitney Museum exhibitions index page plus linked official exhibition detail pages, currently limited to the `current` and `upcoming` in-person sections.
- `data/staging/margot-nielsen-2026-06-16-david-zwirner-artists.json`: legacy staged artist/artwork data from the David Zwirner prototype.

Current schema files:

- `schemas/exhibition.schema.json`: target shape for approved canonical exhibition records.
- `schemas/exhibition-staging.schema.json`: target shape for generated staging reports.
- `schemas/exhibition-source.schema.json`: required shape for source configs before fetch and parse work begins.

The New Museum adapter is the first exhibition-specific official NYC venue source. David Zwirner, Whitney, ICP, The Jewish Museum, The Drawing Center, Frick, Guggenheim, MAD, Museum of the City of New York, The Morgan Library & Museum, The Noguchi Museum, The Bronx Museum, Museum at FIT, Cooper Hewitt, and Poster House now also have exhibition-specific NYC staging flows; the older David Zwirner artist adapter remains legacy context only.

## What Happens When Ingestion Runs?

Ingestion validates the source config, fetches configured source pages, parses them with source-specific adapters, compares incoming records against canonical records, validates the staging report, and writes proposals into `data/staging`.

Useful commands:

```bash
npm run ingest:exhibits:new-museum:stage
npm run ingest:exhibits:bronx-museum:stage
npm run ingest:exhibits:cooper-hewitt:stage
npm run ingest:exhibits:david-zwirner:stage
npm run ingest:exhibits:drawing-center:stage
npm run ingest:exhibits:fit:stage
npm run ingest:exhibits:frick:stage
npm run ingest:exhibits:guggenheim:stage
npm run ingest:exhibits:icp:stage
npm run ingest:exhibits:jewish-museum:stage
npm run ingest:exhibits:mad:stage
npm run ingest:exhibits:mcny:stage
npm run ingest:exhibits:morgan:stage
npm run ingest:exhibits:whitney:stage
npm run ingest:exhibits:noguchi:stage
npm run ingest:exhibits:poster-house:stage
npm run ingest:exhibits:stage
npm run compare:staging -- --baseline data/staging/david-zwirner-exhibitions.json --candidate data/staging/david-zwirner-exhibitions.live.json
npm run review:staging:new-museum:summary
npm run review:staging:bronx-museum:summary
npm run review:staging:bronx-museum:json
npm run review:staging:cooper-hewitt:summary
npm run review:staging:cooper-hewitt:json
npm run review:staging:david-zwirner:summary
npm run review:staging:david-zwirner:json
npm run review:staging:drawing-center:summary
npm run review:staging:drawing-center:json
npm run review:staging:fit:summary
npm run review:staging:fit:json
npm run review:staging:frick:summary
npm run review:staging:frick:json
npm run review:staging:guggenheim:summary
npm run review:staging:guggenheim:json
npm run review:staging:icp:summary
npm run review:staging:icp:json
npm run review:staging:jewish-museum:summary
npm run review:staging:jewish-museum:json
npm run review:staging:mad:summary
npm run review:staging:mad:json
npm run review:staging:mcny:summary
npm run review:staging:mcny:json
npm run review:staging:morgan:summary
npm run review:staging:morgan:json
npm run review:staging:noguchi:summary
npm run review:staging:noguchi:json
npm run review:staging:poster-house:summary
npm run review:staging:poster-house:json
npm run review:staging:whitney:summary
npm run review:staging:whitney:json
npm run verify:source:david-zwirner:live
npm run verify:source:bronx-museum:live
npm run verify:source:cooper-hewitt:live
npm run verify:source:drawing-center:live
npm run verify:source:fit:live
npm run verify:source:frick:live
npm run verify:source:guggenheim:live
npm run verify:source:icp:live
npm run verify:source:jewish-museum:live
npm run verify:source:mad:live
npm run verify:source:mcny:live
npm run verify:source:morgan:live
npm run verify:source:noguchi:live
npm run verify:source:poster-house:live
npm run verify:source:whitney:live
```

`npm run ingest:exhibits:new-museum:stage` stages exhibition candidates from New Museum.

`npm run ingest:exhibits:bronx-museum:stage` stages Bronx Museum exhibition candidates from the official exhibitions archive using a checked-in fixture. The current slice stages only the visible `Current` exhibition-card grid, intentionally excludes the separate featured-show hero duplicate plus the `Upcoming` and `Archive` filters, and leaves detail-page enrichment out of scope while keeping youth-program exhibition cards that appear in the current grid visible to reviewers.

`npm run ingest:exhibits:cooper-hewitt:stage` stages Cooper Hewitt exhibition candidates from the official current and upcoming exhibition pages using checked-in fixtures. The current slice stages only the visible main exhibition blocks plus `Learn more` links, intentionally excludes sponsor-logo sections, funding acknowledgements after the main exhibition copy, photo-credit blocks, previous/traveling/digital pages, and keeps detail-page enrichment out of scope.

`npm run ingest:exhibits:david-zwirner:stage` stages NYC exhibition candidates from the official David Zwirner exhibitions page using a checked-in fixture so the flow is verifiable offline.

`npm run ingest:exhibits:drawing-center:stage` stages The Drawing Center exhibition candidates from the official exhibitions page using a checked-in fixture. The current slice stages only the visible server-rendered `onview` and `upcoming` listing modules, intentionally excludes `past`, and uses the same official index-page bootstrap only as a fallback for fields the visible listing omits.

`npm run ingest:exhibits:fit:stage` stages Museum at FIT exhibition candidates from the official exhibitions page using a checked-in fixture. The current slice stages only the visible `Current` and `Upcoming` long-card sections when an official exhibition detail link is present, and intentionally excludes closure notices like `Galleries Closed`, lobby-only cards without official exhibition pages, `MFIT on the Road`, `Past Exhibitions`, and any detail-page enrichment.

`npm run ingest:exhibits:frick:stage` stages The Frick Collection exhibition candidates from the official exhibitions page using a checked-in fixture. The current slice stages only the visible `Current` and `Upcoming` card blocks, keeps `Past` plus `Virtual Exhibitions` out of scope, and uses only listing-page data so the source remains staging-only.

`npm run ingest:exhibits:icp:stage` stages ICP exhibition candidates from the official exhibitions index page plus linked official exhibition detail pages using checked-in fixtures. The current slice stages the `current` and `upcoming` card sections on the main page and intentionally excludes `past` plus the separate `future-exhibitions` landing page until that route exposes stable reviewer-relevant listings.

`npm run ingest:exhibits:jewish-museum:stage` stages The Jewish Museum exhibition candidates from the official exhibitions page using a checked-in fixture. The current slice stages only the visible server-rendered `on view` and `coming soon` cards before the client-side schedule calendar and intentionally excludes React calendar content plus detail-page enrichment until that review scope is chosen.

`npm run ingest:exhibits:guggenheim:stage` stages Guggenheim exhibition candidates from the official exhibitions page bootstrap payload using a checked-in fixture. The current slice stages only the embedded `on_view` and `upcoming` index-page items and intentionally excludes `past` plus any detail-page enrichment.

`npm run ingest:exhibits:whitney:stage` stages Whitney Museum exhibition candidates from the official exhibitions index page plus linked official exhibition detail pages using checked-in fixtures. The current slice intentionally stages only the `current` and `upcoming` in-person sections; `online` and `public art` remain excluded until their review model is defined.

`npm run ingest:exhibits:mad:stage` stages Museum of Arts and Design exhibition candidates from the official exhibitions page plus linked official exhibition detail pages using checked-in fixtures. The current slice still limits scope to `Current Exhibitions` and `Upcoming`, intentionally excludes `Installations` plus `Past`, and now carries reviewer-facing `description` coverage plus full upcoming date ranges where the official detail pages expose them.

`npm run ingest:exhibits:mcny:stage` stages Museum of the City of New York exhibition candidates from the official exhibitions page using a checked-in fixture. The current slice keeps only the visible `Exhibitions On View` and `Upcoming Exhibitions` card sections, intentionally excludes `Online Exhibitions`, `Traveling Exhibitions`, and `Past`, and does not follow detail pages yet.

`npm run ingest:exhibits:morgan:stage` stages The Morgan Library & Museum exhibition candidates from the official `current` and `upcoming` routes using checked-in fixtures. The current slice keeps only the main exhibition listing grids, intentionally excludes the separate `Collection Spotlight` block on the current page plus `online` and `past`, and does not follow detail pages yet.

`npm run ingest:exhibits:noguchi:stage` stages The Noguchi Museum exhibition candidates from the official `Current & Upcoming` page using a checked-in fixture. The current slice keeps only the museum-side listing cards that appear before the first explicit `offsite:` eyebrow, dedupes the duplicated desktop/mobile blocks by official exhibition URL, and intentionally excludes all offsite listings plus any detail-page enrichment.

`npm run ingest:exhibits:poster-house:stage` stages Poster House exhibition candidates from the official exhibitions page using a checked-in fixture. The current slice keeps only the visible `On View` and `Upcoming Exhibitions` sections, combines visible card markup for exact date strings, URLs, and images with the same page's embedded exhibition payload for descriptions, and intentionally excludes `Past Exhibitions`, the archive link, poster-loan content, and any detail-page enrichment.

`npm run review:staging:david-zwirner:summary` prints a grouped reviewer summary of pending David Zwirner staged items without mutating review statuses or canonical data. It includes aggregate venue counts, `current`/`upcoming` status-tag counts, minimum-field readiness for `title`/`venue`/`startDate`/`sourceUrl`, and recommended-coverage warnings for fields such as `description` and `imageUrl` so reviewers can judge source completeness before reading item-by-item details.

`npm run review:staging:bronx-museum:summary` and `npm run review:staging:bronx-museum:json` expose the same staging-only reviewer views for The Bronx Museum. The current artifact is already `verified_live`, stages 2 pending creates from the official current-grid slice, and keeps the first-slice scope explicit: the featured-show hero duplicate stays excluded while youth-program exhibition cards that appear in the current grid remain included until a later source decision says otherwise.

`npm run review:staging:cooper-hewitt:summary` and `npm run review:staging:cooper-hewitt:json` expose the same staging-only reviewer views for Cooper Hewitt. The current artifact is already `verified_live`, stages 4 pending creates from 2 configured official pages, carries `description=4/4` and `imageUrl=4/4`, and keeps the remaining blocker explicit at `startDate=1/4` because the 3 current exhibitions publish only `On view through ...` text on the official listing pages.

`npm run review:staging:david-zwirner:json` prints the same grouped reviewer sections as machine-readable JSON for downstream review tooling, including readiness blockers, warnings, and minimum-field failures, without mutating review statuses or canonical data.

`npm run review:staging:drawing-center:summary` and `npm run review:staging:drawing-center:json` expose the same staging-only reviewer views for The Drawing Center. The current artifact is already `verified_live`, stages 3 pending creates from the visible `onview` plus `upcoming` listing modules, and now satisfies the minimum review contract from index-page data alone.

`npm run review:staging:fit:summary` and `npm run review:staging:fit:json` expose the same staging-only reviewer views for Museum at FIT. The current artifact is already `verified_live`, stages 1 pending create from the official linked-card slice only, and keeps the first-slice scope explicit: cards without official exhibition detail pages remain excluded until a later source decision says otherwise.

`npm run review:staging:frick:summary` and `npm run review:staging:frick:json` expose the same staging-only reviewer views for The Frick Collection. The current Frick artifact is already `verified_live`, stages 4 pending creates from 1 configured official listing page, and already satisfies the minimum review contract from the visible card data alone.

`npm run review:staging:icp:summary` and `npm run review:staging:icp:json` expose the same staging-only reviewer views for ICP. The current ICP artifact now reports `verified_live` and `ready_for_human_review`, and the checked-in index-plus-detail fixture flow now carries reviewer-facing `description` and `imageUrl` metadata from linked official exhibition pages.

`npm run review:staging:jewish-museum:summary` and `npm run review:staging:jewish-museum:json` expose the same staging-only reviewer views for The Jewish Museum. The current artifact is already `verified_live` and stages the visible card slice only, so the next reviewer-facing decision is whether linked detail pages or the client-side schedule calendar belong in a later source-specific follow-up.

`npm run review:staging:guggenheim:summary` and `npm run review:staging:guggenheim:json` expose the same staging-only reviewer views for Guggenheim. The current artifact is already `verified_live`, stages 6 pending creates from the official index-page bootstrap payload, and keeps the reviewer scope limited to `on_view` plus `upcoming` without following detail pages.

`npm run review:staging:whitney:summary` and `npm run review:staging:whitney:json` expose the same staging-only reviewer views for Whitney. The current Whitney artifact now enriches records from linked official detail pages, so reviewers can see exact `startDate` and `endDate` values from the museum source before any approval work begins.

`npm run review:staging:mad:summary` and `npm run review:staging:mad:json` expose the same staging-only reviewer views for MAD. The current MAD artifact is already `verified_live`, stages 6 pending creates from 1 configured index page plus 6 followed official detail pages, now covers `description=6/6`, and keeps the remaining blocker explicit: only the single upcoming exhibition exposes an exact `startDate`, so 5 current records still need either a later official-source date-discovery slice or a human decision about whether end-date-only current records can satisfy the minimum review contract.

`npm run review:staging:mcny:summary` and `npm run review:staging:mcny:json` expose the same staging-only reviewer views for Museum of the City of New York. The current MCNY artifact is already `verified_live`, stages 11 pending creates from 1 configured official listing page, and keeps the remaining blocker explicit at `startDate=2/11` because most current cards publish only `Through ...` or `Ongoing` date text on the official listing page.

`npm run review:staging:morgan:summary` and `npm run review:staging:morgan:json` expose the same staging-only reviewer views for The Morgan Library & Museum. The current Morgan artifact is already `verified_live`, stages 9 pending creates from 2 configured official listing pages, and keeps the remaining blocker explicit: `J. Pierpont Morgan's Library` is still `Ongoing` on the official list page, so the source remains below the minimum review contract on `startDate=8/9` until a later official-source decision is made.

`npm run review:staging:noguchi:summary` and `npm run review:staging:noguchi:json` expose the same staging-only reviewer views for The Noguchi Museum. The current artifact is already `verified_live`, stages 2 pending creates from the official museum-side listing slice only, and is `ready_for_human_review` on the minimum field contract while keeping the remaining optional `description=0/2` gap explicit.

`npm run review:staging:poster-house:summary` and `npm run review:staging:poster-house:json` expose the same staging-only reviewer views for Poster House. The current artifact is already `verified_live`, stages 10 pending creates from 1 configured official page, and is `ready_for_human_review` on the minimum field contract while keeping the first-slice scope explicit at visible current/upcoming exhibition sections only.

`npm run verify:source:david-zwirner:live` dry-runs the live-verification decision for David Zwirner after a separate live staging artifact exists. It only updates source-config verification metadata when `--apply` is explicitly passed.

`npm run verify:source:bronx-museum:live` dry-runs the same live-verification decision for The Bronx Museum after a separate live staging artifact exists. The current Bronx Museum fixture-backed and live artifacts matched on 2026-06-26 for the current-grid slice, so both Bronx Museum source configs are now marked `verified_live` while the reviewer inbox stays staging-only and keeps the featured-show exclusion plus youth-program inclusion explicit.

`npm run verify:source:cooper-hewitt:live` dry-runs the same live-verification decision for Cooper Hewitt after a separate live staging artifact exists. The current Cooper Hewitt fixture-backed and live artifacts matched on 2026-06-26 for the current/upcoming listing slice, so both Cooper Hewitt source configs are now marked `verified_live` while the reviewer inbox stays staging-only and keeps the remaining `startDate` gap explicit on the 3 current exhibitions.

`npm run verify:source:drawing-center:live` dry-runs the same live-verification decision for The Drawing Center after a separate live staging artifact exists. The current Drawing Center fixture-backed and live artifacts already matched on 2026-06-24, so both Drawing Center source configs are now marked `verified_live`.

`npm run verify:source:fit:live` dry-runs the same live-verification decision for Museum at FIT after a separate live staging artifact exists. The current Museum at FIT fixture-backed and live artifacts matched on 2026-06-26 for the linked-card-only long-card slice, so both FIT source configs are now marked `verified_live` while the reviewer inbox stays staging-only and keeps the exclusion of unlinked lobby cards explicit.

`npm run verify:source:frick:live` dry-runs the same live-verification decision for The Frick Collection after a separate live staging artifact exists. The current Frick fixture-backed and live artifacts matched on 2026-06-25, so both Frick source configs are now marked `verified_live`.

`npm run verify:source:icp:live` dry-runs the same live-verification decision for ICP after a separate live staging artifact exists. The current ICP fixture-backed and live artifacts already matched on 2026-06-24, so both ICP source configs are now marked `verified_live`.

`npm run verify:source:jewish-museum:live` dry-runs the same live-verification decision for The Jewish Museum after a separate live staging artifact exists. The current Jewish Museum fixture-backed and live artifacts already matched on 2026-06-24, so both Jewish Museum source configs are now marked `verified_live`.

`npm run verify:source:guggenheim:live` dry-runs the same live-verification decision for Guggenheim after a separate live staging artifact exists. The current Guggenheim fixture-backed and live artifacts already matched on 2026-06-24, so both Guggenheim source configs are now marked `verified_live`.

`npm run verify:source:whitney:live` dry-runs the same live-verification decision for Whitney after a separate live staging artifact exists. Whitney is already `verified_live`, and the source-specific command now uses the same staging-summary refresh path as David Zwirner and ICP.

`npm run verify:source:mad:live` dry-runs the same live-verification decision for MAD after a separate live staging artifact exists. The current MAD fixture-backed and live artifacts matched again on 2026-06-25 for the updated index-plus-detail slice, so both MAD source configs remain `verified_live` while the reviewer inbox stays staging-only and keeps the remaining `startDate` gap explicit on 5 current records.

`npm run verify:source:mcny:live` dry-runs the same live-verification decision for Museum of the City of New York after a separate live staging artifact exists. The current MCNY fixture-backed and live artifacts matched on 2026-06-25 for the visible `on view` plus `upcoming` card slice, so both MCNY source configs are now marked `verified_live` while the reviewer inbox stays staging-only and keeps the remaining `startDate` gap explicit on 9 current records.

`npm run verify:source:morgan:live` dry-runs the same live-verification decision for The Morgan Library & Museum after a separate live staging artifact exists. The current Morgan fixture-backed and live artifacts matched on 2026-06-25 for the two-page current/upcoming listing slice, so both Morgan source configs are now marked `verified_live` while the reviewer inbox stays staging-only and keeps the remaining `startDate` gap explicit on the single `Ongoing` listing.

`npm run verify:source:noguchi:live` dry-runs the same live-verification decision for The Noguchi Museum after a separate live staging artifact exists. The current Noguchi fixture-backed and live artifacts matched on 2026-06-25 for the museum-only listing slice, so both Noguchi source configs are now marked `verified_live`.

`npm run verify:source:poster-house:live` dry-runs the same live-verification decision for Poster House after a separate live staging artifact exists. The current Poster House fixture-backed and live artifacts matched on 2026-06-26 for the visible `On View` plus `Upcoming Exhibitions` slice, so both Poster House source configs are now marked `verified_live` while the reviewer inbox stays staging-only and keeps `Past Exhibitions` plus detail-page fetches out of scope.

`npm run ingest:exhibits:stage` runs the older David Zwirner artist/artwork staging flow.

For a network-enabled environment, the live David Zwirner source config is:

```bash
npm run ingest:exhibits:david-zwirner:live:stage
```

To preserve the fixture-backed review artifact while checking the live page structure, write the live run to a separate staging file:

```bash
node scripts/exhibit-ingest/ingest.mjs \
  --source scripts/exhibit-ingest/sources/david-zwirner-exhibitions.json \
  --records data/exhibit-records.json \
  --stage \
  --output data/staging/david-zwirner-exhibitions.live.json
```

Then compare the live artifact against the fixture-backed artifact:

```bash
npm run compare:staging -- \
  --baseline data/staging/david-zwirner-exhibitions.json \
  --candidate data/staging/david-zwirner-exhibitions.live.json
```

If the live artifact matches the fixture-backed review artifact, dry-run the verification metadata update:

```bash
npm run verify:source:david-zwirner:live -- --verified-at 2026-06-23T15:00:00.000Z
```

Only after the dry run reports `Eligible: yes` should the source configs be updated:

```bash
npm run verify:source:david-zwirner:live -- --verified-at 2026-06-23T15:00:00.000Z --apply
```

When `--apply` is used through the source-specific verification scripts, the helper now also refreshes the fixture-backed staging report verification summary so the checked-in reviewer inbox stays aligned with the verified source config.

Ingestion does not promote records into canonical data. It should not overwrite approved canonical records directly.

## Where Does Staged Data Go?

Generated staging reports go into `data/staging/`.

Each staging report contains:

- `summary`: counts, source identity, parser, generated time.
- `summary.verification`: whether the source has been live-verified yet, when that happened, and reviewer-facing notes about fixture-only validation or pending checks.
- `summary.sourcePages`: the exact official page URLs used for the run, whether each page was configured or followed from a listing page, and whether each page was fetched live or from a checked-in fixture.
- `items`: the human review queue.
- legacy compatibility arrays such as `creates` and `updates`.

Staged item types:

- `create`: proposed new record.
- `update`: proposed change to an existing canonical record.
- `possibleDuplicate`: proposed record that may match an existing canonical record.
- `conflict`: planned future type for source disagreement.

Staged review statuses:

- `pending`: waiting for human review.
- `approved`: human approved.
- `rejected`: human rejected.
- `needs_revision`: human wants changes before approval.

When in doubt, keep data staged rather than canonical.

## What Is Canonical Data?

Canonical data is the approved record set in `data/exhibit-records.json`.

Canonical records are intended to represent exhibition facts that have passed human review. Approved exhibition records should follow `schemas/exhibition.schema.json`.

Canonical data should be treated as durable product data, even while it is still stored as JSON. Eventually this should move to PostgreSQL or another durable structured database, but the review workflow should survive that migration.

## What Is Safe For Codex To Change?

Codex may safely change:

- Documentation and task lists.
- Tests and fixtures.
- Source-specific parsers and source configs, if they only stage proposals.
- Staging report generation logic, when tests are updated and staging remains review-first.
- Conservative dedupe scoring that flags possible duplicates without auto-merging.
- Validation code that prevents malformed staging or canonical records.
- Dry-run tools and scripts that do not write canonical data unless explicitly invoked with an apply flag.

Codex should run tests after backend changes:

```bash
npm test
npm run build
```

For ingestion changes, Codex should also run the relevant staging command and verify that the output remains a review report, not a direct canonical write.

## What Requires Human Approval?

Human approval is required before:

- Promoting staged records into `data/exhibit-records.json`.
- Marking staged items as `approved`, `rejected`, or `needs_revision`.
- Merging possible duplicates.
- Resolving conflicts between sources.
- Deleting canonical records.
- Expanding source coverage beyond a focused NYC museum/gallery source.
- Switching canonical storage from JSON to PostgreSQL.
- Introducing Google Sheets sync or changing an existing external sheet workflow.
- Running dependency audit fixes that may alter broader app tooling.

Codex should not silently make destructive data changes.

## How Does Approval Work Right Now?

Approval is intentionally manual.

The current script is:

```bash
node scripts/exhibit-ingest/approve-staging.mjs --staging data/staging/new-museum-exhibitions.json
```

By default this is a dry run. It reports how many approved staged creates would be promoted.

To actually write canonical records, the script requires:

```bash
node scripts/exhibit-ingest/approve-staging.mjs --staging data/staging/new-museum-exhibitions.json --apply
```

Only staged `create` items with `reviewStatus: "approved"` are eligible. Pending items and possible duplicates are not promoted.

## What Is The Next Milestone?

The next milestone is a trustworthy review loop for one official NYC exhibition source:

1. New Museum ingestion reliably stages exhibition candidates.
2. A human can review staged items and mark approved creates.
3. Approved creates can be promoted into canonical JSON with audit metadata.
4. Dedupe prevents obvious duplicate clutter.
5. Conflict detection flags meaningful source disagreements for review.

After that, the project can safely add a second NYC official venue source.

## How Do I Verify Alignment With My Goals?

Use this checklist:

- Does ingestion stage proposals instead of overwriting canonical records?
- Can I tell where each proposed claim came from?
- Are possible duplicates flagged for review rather than merged automatically?
- Is canonical data only changed after human approval?
- Do tests pass?
- Are source additions still focused on NYC museums and galleries?
- Are docs and changelog updated after backend changes?
- Is the next task improving data quality, reviewability, source tracking, or canonical durability rather than drifting into frontend work?

Useful verification commands:

```bash
npm test
npm run build
npm run ingest:exhibits:new-museum:stage
npm run ingest:exhibits:david-zwirner:stage
npm run ingest:exhibits:icp:stage
npm run ingest:exhibits:whitney:stage
npm run compare:staging -- --baseline data/staging/david-zwirner-exhibitions.json --candidate data/staging/david-zwirner-exhibitions.live.json
npm run review:staging:new-museum
npm run review:staging:david-zwirner
npm run review:staging:new-museum:summary
npm run review:staging:david-zwirner:summary
npm run review:staging:david-zwirner:json
npm run review:staging:icp:summary
npm run review:staging:icp:json
npm run review:staging:whitney:summary
npm run review:staging:whitney:json
npm run verify:source:david-zwirner:live -- --verified-at 2026-06-23T15:00:00.000Z
npm run verify:source:icp:live -- --verified-at 2026-06-24T02:20:00.000Z
npm run verify:source:whitney:live -- --verified-at 2026-06-23T18:29:00.000Z
```

Healthy output means:

- Tests pass.
- Build passes.
- New Museum ingestion writes a validated staging report.
- David Zwirner ingestion writes a validated staging report for NYC exhibitions without canonical writes.
- ICP ingestion writes a validated staging report for current/upcoming exhibitions without canonical writes.
- Whitney ingestion writes a validated staging report for current/upcoming in-person exhibitions without canonical writes.
- ICP review output should show `verified_live` for the current/upcoming index-plus-detail flow, `ready_for_human_review`, and explicit configured-vs-followed page coverage for reviewer audit.
- Whitney review output should show `verified_live` for the index-plus-detail structure and `ready_for_human_review` once the linked detail pages fill the minimum `startDate` coverage.
- Optional live David Zwirner verification can write to a separate staging file and compare against the fixture-backed artifact without overwriting the default review inbox.
- Live-vs-fixture staging comparisons should surface both record-level differences and verification metadata changes before the source config is marked `verified_live`.
- The dry-run live verification helper should reject verification updates when staged records changed or when the candidate artifact does not show live-fetched source pages.
- Applying a successful source-specific live verification should also refresh the fixture-backed staging report verification summary so the checked-in review artifact does not drift behind the verified source config.
- Review summary commands print grouped create/update/possible-duplicate sections for human audit, including the exact reviewed source page URLs and whether the run was live or fixture-backed, without mutating staged data.
- Review summaries also print aggregate venue counts, `current`/`upcoming` status-tag counts, minimum-field readiness, and recommended field-coverage warnings so multi-location source drift and source-completeness gaps are easier to spot.
- Review JSON commands print the same grouped review sections in machine-readable form without mutating staged data.
- Source-specific staging and review commands should run sequentially, not in parallel, because they share the same staging file.
- Review dry run does not promote anything unless staged items have been explicitly marked approved.

## Current Known Risks

- The repo has a `.git` directory, but project files are currently untracked. A real initial commit would create a better rollback point.
- Conflict detection now exists for reviewer-sensitive exhibition updates, but it is still narrow: it covers meaningful canonical-vs-source field disagreements in staged updates, not multi-source disagreement resolution across venues.
- Google Sheets status is unknown.
- npm audit reports existing dependency findings after adding AJV; fixes were not applied because they may affect broader tooling.
