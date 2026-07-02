# Exhibition Backend Brief

## Current State

This workspace currently contains a small Vite/React app plus an early JSON-based ingestion prototype under `scripts/exhibit-ingest`.

The existing ingestion flow fetches configured source pages, parses them with source-specific adapters, and writes staging reports to `data/staging`. The David Zwirner parser produces `artist` and `artwork` records and should be treated as an ingestion/staging prototype. The New Museum parser is the first exhibition-specific official venue adapter and stages exhibition candidates only. David Zwirner, Whitney, ICP, The Jewish Museum, The Drawing Center, The Frick Collection, Guggenheim, Museum of Arts and Design, Museum of the City of New York, The Morgan Library & Museum, The Noguchi Museum, The Bronx Museum, The Museum at FIT, Cooper Hewitt, and Poster House now also have exhibition-specific staging flows.

Concrete JSON schema drafts now live in `schemas/exhibition.schema.json` and `schemas/exhibition-staging.schema.json`.

No Google Sheets integration is present in this repository yet. If a sheet exists outside this workspace, it should be treated as an important review surface and preserved during any backend transition.

## Product Principle

Staging is a permanent product concept. New records and meaningful proposed updates should be reviewed by a human before becoming canonical. The backend should preserve enough source context for a reviewer to understand why a record or change was proposed.

## Near-Term Backend Direction

1. Keep the JSON staging workflow intact while the exhibition model matures.
2. Use the exhibition-first canonical schema as the target contract for approved records.
3. Treat staged creates and staged updates as first-class review queue items.
4. Track claim provenance at the field or source level where practical.
5. Add dedupe logic that proposes likely matches but stages uncertain merges.
6. Consider PostgreSQL for canonical records once the schema and review workflow stabilize.

## Exhibition Record Minimum

Every canonical exhibition should support:

- `title`
- `venue`
- `startDate`
- `sourceUrl`

The model should also be able to hold:

- `endDate`
- `description`
- `artists`
- `curators`
- `venueAddress`
- `neighborhood`
- `borough`
- `city`
- `imageUrl`
- `exhibitionUrl`
- `openingReceptionDate`
- `tags`
- `sourceConfidence`
- `reviewStatus`
- `lastCheckedAt`
- `changeHistory`

## Staging Record Shape

Staging items should distinguish between:

- `create`: a proposed new exhibition.
- `update`: a proposed change to an existing exhibition.
- `possibleDuplicate`: a candidate that may match an existing exhibition but needs review.
- `conflict`: a source claim that disagrees with canonical data.

Each staged item should include:

- proposed exhibition fields
- source URL and source type
- extraction timestamp
- parser or adapter name
- confidence/reliability notes
- matching/dedupe notes
- reviewer status
- optional reviewer notes

## Source Strategy

Prioritize NYC museums and galleries. Official venue pages should be preferred when available, but credible third-party web mentions can contribute source claims if the system tracks source reliability and conflict status.

Avoid broad source expansion until the exhibition schema, staging review workflow, dedupe assumptions, and update policy are working smoothly.

Current source-by-source focus after Guggenheim, The Drawing Center, MAD, Frick, Noguchi, Morgan, MCNY, FIT, Bronx Museum, Cooper Hewitt, and Poster House: keep ICP staging-only with its cleaned, summary-first detail descriptions, keep The Jewish Museum card-only slice staging-only while deciding separately on detail pages vs. the client-side calendar, keep Guggenheim staging-only with its verified-live bootstrap payload, keep The Drawing Center staging-only with its verified-live listing parser, keep MAD staging-only with its new verified-live index-plus-detail slice while deciding how to handle the remaining `startDate` gap on 5 current exhibitions, keep The Frick Collection staging-only with its verified-live current/upcoming listing slice, keep The Noguchi Museum staging-only with its verified-live museum-only listing slice before the first explicit `offsite:` entry, keep The Morgan Library & Museum staging-only with its verified-live current/upcoming listing slice while the single `Ongoing` listing keeps `startDate=8/9`, keep Museum of the City of New York staging-only with its verified-live `on view` plus `upcoming` card slice while `startDate=2/11`, keep Museum at FIT staging-only with its verified-live linked-card current/upcoming slice while unlinked lobby cards remain excluded, keep The Bronx Museum staging-only with its verified-live current-grid slice while the youth-program inclusion decision remains open, keep Cooper Hewitt staging-only with its verified-live current/upcoming listing slice while the 3 current exhibitions still leave `startDate=1/4`, keep Poster House staging-only with its verified-live current/upcoming page slice that merges visible card dates/images with embedded payload descriptions, and treat Neue Galerie as the next focused official NYC source because the checked-in fixture’s `__NEXT_DATA__` narrows to `props.pageProps.data.page.slices[0]` as an `exhibitions_grid_module` with embedded exhibition `events`, which is a safer parser boundary than scraping the broader site payload.

## Update Policy

Do not overwrite canonical exhibition records directly from ingestion. Stage meaningful changes, especially changes to title, venue, dates, URL, description, artists, image, or status. If a source disappears, mark it for review or last-seen tracking rather than deleting the exhibition.

## Migration Note

The current `data/exhibit-records.json` file is empty and can continue acting as a lightweight canonical store during early development. Before moving to PostgreSQL, create an export or migration note that preserves any approved JSON records and staged decisions.
