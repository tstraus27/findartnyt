# Hard Source Ingestion Plan

Last updated: 2026-06-29 18:54 America/Chicago / 2026-06-29T23:54Z

Scope: stop adding easier sources until The Met, MoMA, and Brooklyn Museum each have either a working staging path or a documented blocker with a next-best fallback. All output remains staging-only; no canonical records are written by this work.

## Plain-Language Progress Log

This section explains each run in everyday language. "Staging" means a safe review area: records can be checked there before anything is promoted into the real app data.

### 2026-06-29 Evening Run: The Met now has a staging path

What changed:

- The Met now has a staging file at `data/staging/met-exhibitions.json`.
- That file contains 23 proposed exhibition records from The Met's official exhibitions page.
- These records are not live app data yet. They are waiting for human review.

Why this matters:

- Before this run, MoMA had a staging path, but The Met did not.
- The agent is supposed to focus on MoMA, The Met, and Brooklyn Museum before adding easier sources.
- This run moved The Met from "missing staging path" to "has a working staging path, but needs review and improvement."

What the agent had to do:

- It tried normal backend access to The Met's official site first.
- The Met's site returned `429 Too Many Requests`, which is an edge/security block from Vercel.
- The agent did not try to bypass that block.
- Instead, it used the already-approved browser-assisted pattern: a compact snapshot of official exhibition cards, a parser that reads that snapshot, tests for the parser, and a staging JSON file.

What works now:

- `npm run ingest:exhibits:met:stage` can regenerate the Met staging file from the compact fixture.
- `npm run review:staging:met:summary` can summarize the proposed Met records for review.
- `npm run review-ui:met` can open the review UI for the Met staging file.
- The full test suite passed: 76 tests.
- The production build passed.

What is still stuck:

- The Met's site still blocks direct backend fetches with `429 Too Many Requests`.
- Many current Met exhibitions only showed end-date text like `Through September 27` in the listing snapshot. That means the staging records preserve the official date text, but 17 records do not have a start date yet.
- The compact snapshot does not include descriptions or image URLs, so those are still missing from this first Met pass.

Next run should do:

- Work on Brooklyn Museum next, because Brooklyn still does not have a staging file.
- Do not add easier museums or galleries before Brooklyn has either a working staging path or a documented blocker plus fallback.
- Later, come back to The Met and see whether a conservative browser-assisted detail-page refresh can add start dates, descriptions, and image URLs without bypassing security.

## Audit Summary

Old project checked: `/Users/tobystraus/Code/exhibit-sync`.

Reusable findings:

- `configs/sources.yml` had disabled configs for `moma`, `met`, and `brooklyn`.
- MoMA used `parser: moma_current` at `https://www.moma.org/calendar/exhibitions` with `request_profile: browser`.
- The Met used `parser: css_cards` at `https://www.metmuseum.org/exhibitions`; old selector strategy targeted exhibition sections and `article` cards.
- Brooklyn used `parser: anchor_list` at `https://www.brooklynmuseum.org/exhibitions`.
- Old MoMA parser logic in `exhibit_ingest/parsers/moma_current.py` was reusable: parse `Current exhibitions` / `Upcoming exhibitions`, collect `/calendar/exhibitions/` links, pick title from nested heading text, and preserve date text.
- Old tests showed explicit fetch handling:
  - Brooklyn Vercel checkpoint raises a source-specific error.
  - MoMA had a one-retry-on-403 fetch workaround.
  - Met parser logic was generic CSS-card logic, not the main blocker.
- Old reports/logs:
  - `source_reliability_matrix_june_5.md`: MoMA parser healthy but Cloudflare 403 made it watchlist/disabled; Brooklyn and Met blocked by Vercel 429 checkpoint.
  - `june_5_progress_and_rest_of_day_plan.md`: Brooklyn and Met were fetch/anti-bot blockers, not parser mismatches.
  - `logs/exhibit_sync_launchd.log`: MoMA returned `403 Forbidden` on 2026-06-05.
  - Historical MoMA raw imports existed from May 2026, proving the parser shape once worked.

Commands used:

```sh
rg -n "(MoMA|MOMA|Metropolitan|Met Museum|Brooklyn|moma|metmuseum|brooklynmuseum)" /Users/tobystraus/Code/exhibit-sync/configs /Users/tobystraus/Code/exhibit-sync/exhibit_ingest /Users/tobystraus/Code/exhibit-sync/tests /Users/tobystraus/Code/exhibit-sync -g '!**/.git/**'
sed -n '1,190p' /Users/tobystraus/Code/exhibit-sync/configs/sources.yml
sed -n '1,220p' /Users/tobystraus/Code/exhibit-sync/exhibit_ingest/parsers/moma_current.py
sed -n '1,130p' /Users/tobystraus/Code/exhibit-sync/tests/test_fetch.py
```

## Current Access Probe

Probe time: 2026-06-29T18:16Z to 2026-06-29T18:22Z.

Direct/backend probe command:

```sh
node - <<'NODE'
// Fetch official URLs with normal and browser-like headers; record status, title, markers, and size.
NODE
```

Browser render probe: in-app browser loaded each official URL once, waited for DOM content plus a short render delay, and inspected only DOM markers/links. No CAPTCHA solving, authentication, rate-limit evasion, or repeated hammering was attempted.

Alternate official URL probe command:

```sh
node - <<'NODE'
// Fetch robots.txt, sitemap.xml, simple RSS/JSON candidates, and obvious official API-style URLs.
NODE
```

## MoMA

Official URLs tested:

- `https://www.moma.org/calendar/exhibitions`
- `https://www.moma.org/sitemap.xml`
- `https://www.moma.org/robots.txt`
- `https://www.moma.org/calendar/exhibitions.rss`
- `https://www.moma.org/calendar/exhibitions.json`

Fetch result/status:

- Direct Node fetch: `403 Forbidden`, title `Just a moment...`, Cloudflare challenge page.
- Browser-like Node fetch: `403 Forbidden`, title `Just a moment...`, Cloudflare challenge page.
- `robots.txt`: `200 OK`, but not an exhibition data feed.
- Sitemap/RSS/JSON candidates: `403 Forbidden`, Cloudflare challenge page.

Browser rendering:

- Works intermittently but successfully in the in-app browser.
- Successful render produced title `Galleries and exhibitions | MoMA`, current/upcoming markers, and 25 `/calendar/exhibitions/{id}` links.
- A reload attempt fell back to `about:blank`, so this is not reliable enough to call fully automated.

Structured data:

- No JSON-LD found on the rendered listing page.
- No `__NEXT_DATA__` payload found.
- Usable structured-enough data exists in rendered exhibition anchor blocks.

Candidate parser strategy:

- Use old `moma_current.py` logic translated to the file-based backend.
- Parse rendered/snapshot anchor blocks for `/calendar/exhibitions/{id}`.
- Preserve title and date text from listing cards.
- Infer simple dates where possible, but keep human review as required.

Minimum viable staging approach:

- Implemented as browser-assisted fixture staging:
  - Fixture: `scripts/exhibit-ingest/fixtures/moma-exhibitions.browser-2026-06-29.html`
  - Config: `scripts/exhibit-ingest/sources/moma-exhibitions.fixture.json`
  - Parser: `scripts/exhibit-ingest/parsers/moma-exhibitions.mjs`
  - Staging artifact: `data/staging/moma-exhibitions.json`
- Generated 25 staging proposals.
- Review command: `npm run review-ui:moma`

Risks:

- Direct backend fetch remains blocked by Cloudflare 403.
- Browser-assisted snapshot requires human/browser refresh when MoMA changes.
- The snapshot is compacted to exhibition anchor data to avoid oversized rendered DOM transfer, so detail-page enrichment is still a future step.

Next step:

- Keep MoMA as staging-only browser-assisted ingestion.
- If a durable official data endpoint appears, replace the fixture workflow with live fetch.
- Otherwise add a documented refresh helper/workflow for browser-assisted snapshots.

## The Metropolitan Museum of Art

Official URLs tested:

- `https://www.metmuseum.org/exhibitions`
- `https://www.metmuseum.org/exhibitions/listings`
- `https://www.metmuseum.org/sitemap.xml`
- `https://www.metmuseum.org/robots.txt`
- `https://www.metmuseum.org/api/search/exhibition`

Fetch result/status:

- Direct Node fetch for `/exhibitions`: `429 Too Many Requests`, title `Vercel Security Checkpoint`, body includes `Enable JavaScript to continue`.
- Browser-like Node fetch for `/exhibitions`: `429 Too Many Requests`, same Vercel checkpoint.
- `/exhibitions/listings`: `429` by direct/backend fetch; browser render later showed it as a Met `Page Not Found`, so it is not the preferred source.
- Sitemap, robots, and API-style candidate: `429`, Vercel checkpoint.

Browser rendering:

- Works in the in-app browser for `https://www.metmuseum.org/exhibitions`.
- Successful render produced title `Exhibitions - The Metropolitan Museum of Art`, current/upcoming markers, and exhibition links such as:
  - `https://www.metmuseum.org/exhibitions/musical-bodies`
  - `https://www.metmuseum.org/exhibitions/costume-art`
  - `https://www.metmuseum.org/exhibitions/giacometti-in-the-temple-of-dendur`

Structured data:

- No JSON-LD found on the rendered listing page.
- No `__NEXT_DATA__` payload found.
- Rendered page text and links contain usable exhibition titles/date text.

Candidate parser strategy:

- Browser-assisted compact snapshot of rendered `/exhibitions` page.
- Parse sections: Featured, Recently Opened, Closing Soon, More Temporary Exhibitions, Upcoming.
- Reuse/port old CSS-card strategy, but likely write a source-specific parser for section labels and duplicate image/title links.

Minimum viable staging approach:

- Browser-assisted staging is viable.
- Do not enable direct live backend fetch until Vercel 429 is resolved or an official non-gated endpoint is found.

Risks:

- Backend fetch remains blocked at the edge.
- Browser-rendered DOM is large and likely layout-sensitive.
- Duplicate links and image-only links need careful dedupe.

Next step:

- Tackle The Met next.
- Build `met-exhibitions` fixture config, parser, parser tests, compact browser snapshot, and staging artifact.

## Brooklyn Museum

Official URLs tested:

- `https://www.brooklynmuseum.org/exhibitions`
- `https://www.brooklynmuseum.org/sitemap.xml`
- `https://www.brooklynmuseum.org/robots.txt`
- `https://www.brooklynmuseum.org/exhibitions.json`

Fetch result/status:

- Direct Node fetch: `429 Too Many Requests`, title `Vercel Security Checkpoint`, body includes `Enable JavaScript to continue`.
- Browser-like Node fetch: `429 Too Many Requests`, same Vercel checkpoint.
- Sitemap, robots, JSON candidate: `429`, Vercel checkpoint.

Browser rendering:

- Initial browser pass returned `about:blank`, showing fragility.
- Later conservative retry worked in the in-app browser.
- Successful render produced title `Exhibitions · Brooklyn Museum`, exhibition page text, and links such as:
  - `https://www.brooklynmuseum.org/exhibitions/iris-van-herpen`
  - `https://www.brooklynmuseum.org/exhibitions/donald-moffett`
  - `https://www.brooklynmuseum.org/exhibitions/everyday-rebellions`
  - `https://www.brooklynmuseum.org/exhibitions/keisha-scarville`

Structured data:

- Official alternate JSON/sitemap/robots paths are blocked to backend fetch.
- Rendered page link text includes title/date text; no reliable backend structured payload identified yet.

Candidate parser strategy:

- Browser-assisted compact snapshot of rendered exhibition links.
- Source-specific parser should filter nav links like `/exhibitions/upcoming`, parse title/date text from card text, and preserve official date text for review.

Minimum viable staging approach:

- Browser-assisted staging appears viable after retry, but not implemented in this phase because MoMA was the selected first hard source.
- Manual fallback remains acceptable: browser review of official page, compact snapshot, staged JSON, human review.

Risks:

- Backend fetch remains blocked at Vercel 429.
- Browser render appears less stable than Met in this session.
- Card text concatenates status labels, titles, and dates, so parser tests need strong fixtures.

Next step:

- After The Met, implement Brooklyn with the same compact browser-assisted pattern.

## Current Phase Result

Implemented first viable hard source: MoMA.

Commands:

```sh
node --test scripts/exhibit-ingest/parsers/moma-exhibitions.test.mjs
node scripts/exhibit-ingest/ingest.mjs --source scripts/exhibit-ingest/sources/moma-exhibitions.fixture.json --stage
npm run review:staging:moma:summary
```

Generated:

- `data/staging/moma-exhibitions.json`

Review UI:

```sh
npm run review-ui:moma
```

Policy:

- No canonical records were edited.
- No additional easy sources were added.
- No CAPTCHA, auth bypass, rate-limit evasion, or aggressive scraping was attempted.

## 2026-06-29 Evening Agent Run

Run time: 2026-06-29 18:51 America/Chicago / 2026-06-29T23:51Z.

Selected source: The Metropolitan Museum of Art, because MoMA staging exists and `data/staging/met-exhibitions.json` was absent.

Conservative access probe:

```sh
node - <<'NODE'
// Fetched https://www.metmuseum.org/exhibitions, /exhibitions/listings,
// /sitemap.xml, /robots.txt, and /api/search/exhibition with normal and
// browser-like headers; recorded status, title, body size, and checkpoint marker.
NODE
```

Probe result:

- `https://www.metmuseum.org/exhibitions`: `429 Too Many Requests`, title `Vercel Security Checkpoint`, checkpoint marker present.
- `https://www.metmuseum.org/exhibitions/listings`: `429 Too Many Requests`, title `Vercel Security Checkpoint`, checkpoint marker present.
- `https://www.metmuseum.org/sitemap.xml`: `429 Too Many Requests`, title `Vercel Security Checkpoint`, checkpoint marker present.
- `https://www.metmuseum.org/robots.txt`: `429 Too Many Requests`, title `Vercel Security Checkpoint`, checkpoint marker present.
- `https://www.metmuseum.org/api/search/exhibition`: `429 Too Many Requests`, title `Vercel Security Checkpoint`, checkpoint marker present.
- Browser-like headers returned the same result for each URL.

Implemented staging-only browser-assisted path:

- Fixture: `scripts/exhibit-ingest/fixtures/met-exhibitions.browser-2026-06-29.html`
- Config: `scripts/exhibit-ingest/sources/met-exhibitions.fixture.json`
- Parser: `scripts/exhibit-ingest/parsers/met-exhibitions.mjs`
- Parser tests: `scripts/exhibit-ingest/parsers/met-exhibitions.test.mjs`
- Staging artifact: `data/staging/met-exhibitions.json`
- Ingest registry: `scripts/exhibit-ingest/ingest.mjs`
- Review scripts:
  - `npm run ingest:exhibits:met:stage`
  - `npm run review:staging:met:summary`
  - `npm run review:staging:met:json`
  - `npm run review-ui:met`

Commands run:

```sh
node --test scripts/exhibit-ingest/parsers/met-exhibitions.test.mjs
node scripts/exhibit-ingest/ingest.mjs --source scripts/exhibit-ingest/sources/met-exhibitions.fixture.json --stage
npm run review:staging:met:summary
npm test
npm run build
```

Results:

- Met parser test passed.
- Generated 23 staging proposals in `data/staging/met-exhibitions.json`.
- Review summary ran successfully and reports `needs_attention`, with 23 creates, 0 updates, 0 possible duplicates, and 0 conflicts.
- Full test suite passed: 76 tests.
- Production build passed.
- All proposals remain pending human review.
- No canonical records were edited.
- No easier sources were added.
- No CAPTCHA, authentication, rate-limit, or edge security challenge bypass was attempted.

Risks:

- The Met backend fetch remains blocked by Vercel 429.
- The compact fixture is browser-assisted and must be refreshed by a human/browser workflow when the live official page changes.
- Listing dates such as `Through September 27` preserve official date text and infer the current year for end-date review; items without exact start dates still require human confirmation before promotion.

Next step:

- Brooklyn Museum is the next hard source because `data/staging/brooklyn-museum-exhibitions.json` remains absent and direct backend fetch is still documented as blocked.
- Later Met improvement: enrich or refresh the browser-assisted fixture from official detail pages if a conservative browser workflow can capture start dates, descriptions, and image URLs without bypassing edge security.

## 2026-07-14 Met Missing Exhibition Patch

Run time: 2026-07-14 12:38 America/Chicago / 2026-07-14T17:38Z.

Problem found:

- The Met staging artifact missed the official exhibition `https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy`.
- Root cause: the Met source was only parsing the old browser-assisted listing fixture from 2026-06-29. That fixture did not contain the Orientalism detail URL, so the parser never had a record to create.
- Direct Node fetches to both the Met exhibitions index and the Orientalism detail URL still returned `429 Too Many Requests` / Vercel checkpoint responses in this environment.

Implemented:

- Added compact official detail fixture:
  - `scripts/exhibit-ingest/fixtures/met-exhibitions-details/orientalism-between-fact-and-fantasy.html`
- Updated Met source config so the Orientalism detail page is a configured seed fixture, not dependent on the stale listing snapshot:
  - `scripts/exhibit-ingest/sources/met-exhibitions.fixture.json`
- Updated Met parser so it can parse a standalone official detail-page snapshot when a page has no listing sections:
  - `scripts/exhibit-ingest/parsers/met-exhibitions.mjs`
- Added a regression test requiring `exhibition:met:orientalism-between-fact-and-fantasy` to parse from the detail fixture:
  - `scripts/exhibit-ingest/parsers/met-exhibitions.test.mjs`
- Regenerated Met staging:
  - `data/staging/met-exhibitions.json`

Commands run:

```sh
node --test scripts/exhibit-ingest/parsers/met-exhibitions.test.mjs
npm run ingest:exhibits:met:stage
npm run review:staging:met:summary
```

Results:

- Met parser test passed with 3 tests.
- Met staging now has 24 proposed exhibition records instead of 23.
- `Orientalism: Between Fact and Fantasy` is now staged as `exhibition:met:orientalism-between-fact-and-fantasy`.
- The staged Orientalism record preserves the official URL, title, date text `Through February 28, 2027`, end date `2027-02-28`, Met venue metadata, and a compact description from the official detail page.
- Review summary still reports `needs_attention` because this is fixture-backed, pending live verification, and many Met records still lack exact start dates and images.

Plain-language progress log:

- The missing Met exhibition is now in the review data. Staging means a review area, not the final approved exhibition database.
- The bug was not that the parser could not understand the exhibition. The bug was that the system only looked at an older saved copy of the Met exhibitions list, and this important exhibition was not in that saved list.
- To reduce this risk, known important Met exhibition URLs can now be added as official detail-page seed fixtures. A seed fixture is a small saved copy of an official page that the staging system reads directly.
- This does not fully solve Met automation because the Met site still blocks direct backend fetches from this environment. The next Met improvement should add a regular freshness audit that compares the saved Met fixture against a current browser-rendered official page and flags any missing official exhibition links before staging is treated as complete.

## 2026-07-14 Met Guardrails and Refresh Workflow

Run time: 2026-07-14 12:43 America/Chicago / 2026-07-14T17:43Z.

Goal:

- Move The Met closer to "fixed forever" by making missing required exhibitions, suspiciously low record counts, and stale listing fixtures fail loudly.
- Keep the work staging-only. No canonical records were promoted or edited.
- Do not bypass the Met's Vercel/security checkpoint. Direct backend fetch remains blocked from this environment.

Implemented Phase 1 guardrails:

- Added a required Met seed registry:
  - `scripts/exhibit-ingest/sources/met-required-exhibitions.json`
  - It currently requires `https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy`.
  - It also stores `minimumExpectedRecords: 24` and `listingFixtureMaxAgeDays: 14`.
- Added a Met audit command:
  - `npm run audit:met`
  - It checks required seed URL coverage, minimum record count, and listing fixture age from `data-captured-at`.
  - It exits with failure when the listing fixture is stale or a required seed URL is missing.
  - `npm run audit:met -- --allow-stale` keeps the same report but treats known staleness as a warning, useful when testing other guardrails.
- Added required seed coverage to the test suite:
  - `scripts/exhibit-ingest/audit-met.test.mjs`
  - `npm test` now protects the active seed registry without failing only because the known listing fixture is stale.
- Added optional followed detail fixture support to the generic ingest runner:
  - `scripts/exhibit-ingest/ingest.mjs`
  - Met can now ask for detail-page enrichment from `scripts/exhibit-ingest/fixtures/met-exhibitions-details/` without requiring every detail fixture to exist on day one.

Implemented Phase 2 workflow pieces:

- Added a browser-assisted compact fixture builder:
  - `scripts/exhibit-ingest/refresh-met-fixture.mjs`
  - `npm run refresh:met:fixture -- --help`
- This script expects a human/browser-collected JSON list of official Met exhibition cards and writes compact parser-friendly fixture HTML.
- It validates the output before writing and refuses suspiciously low record counts by default.
- The Met source config now enables optional detail fixture following for listing records:
  - `followRecordUrls: true`
  - `followRecordUrlFixtureDirectory: ../fixtures/met-exhibitions-details`
  - `followRecordUrlFixtureRequired: false`

Commands run:

```sh
node --test scripts/exhibit-ingest/parsers/met-exhibitions.test.mjs scripts/exhibit-ingest/audit-met.test.mjs scripts/exhibit-ingest/refresh-met-fixture.test.mjs
npm run ingest:exhibits:met:stage
npm run audit:met
npm run audit:met -- --allow-stale
npm run refresh:met:fixture -- --help
npm run review:staging:met:summary
```

Results:

- Focused Met/audit/refresh tests passed.
- Met staging regenerated with 24 proposed exhibition records.
- `Orientalism: Between Fact and Fantasy` remains staged.
- `npm run audit:met` now fails loudly because the listing fixture was captured on 2026-06-29 and is 15 days old, beyond the 14-day threshold.
- `npm run audit:met -- --allow-stale` reports seed coverage 1/1 and records 24/24 while warning about staleness.
- Review summary still reports `needs_attention` because this remains fixture-backed and many records still lack start dates, descriptions, and images.

Future Met refresh procedure:

1. Open `https://www.metmuseum.org/exhibitions` in a normal browser session.
2. Let the public page render naturally. Do not bypass checkpoints or rate limits.
3. Copy official exhibition card data into a JSON array with `section`, `url`, `title`, `dateText`, and optional `imageUrl`.
4. Run:

```sh
npm run refresh:met:fixture -- --input /path/to/met-cards.json --output scripts/exhibit-ingest/fixtures/met-exhibitions.browser-YYYY-MM-DD.html
```

5. Point `scripts/exhibit-ingest/sources/met-exhibitions.fixture.json` at the new fixture only after validation passes.
6. Run:

```sh
npm run ingest:exhibits:met:stage
npm run audit:met
npm run review:staging:met:summary
npm test
npm run build
```

Plain-language progress log:

- The Met system now has alarms. If a known important exhibition URL is missing, if the total record count drops below 24, or if the saved Met listing is too old, the audit command says so clearly.
- A seed registry is now the place to add must-not-miss Met exhibitions. A registry is a small list of official URLs the system promises to look for.
- The Met is still not fully automatic because direct backend requests to the Met site are blocked by a security checkpoint from this environment.
- The next best work is to refresh the browser-assisted Met listing fixture using the new compact fixture builder, then add more detail fixtures for important records so descriptions, images, and better date text can be staged.

## 2026-07-14 MoMA Guardrails and Refresh Workflow

Run time: 2026-07-14 12:51 America/Chicago / 2026-07-14T17:51Z.

Goal:

- Give MoMA the same "fail loudly" guardrails that were added for The Met.
- Keep the work staging-only. No canonical records were promoted or edited.
- Do not bypass MoMA's Cloudflare challenge. Direct backend fetch remains blocked from this environment.

Problem:

- MoMA has the same risk shape as The Met: a browser-assisted snapshot from 2026-06-29, `pending_live_verification`, and direct backend fetch blocked by Cloudflare `403`.
- That means MoMA can miss new or important exhibitions if the saved browser snapshot is stale.

Implemented:

- Added a required MoMA seed registry:
  - `scripts/exhibit-ingest/sources/moma-required-exhibitions.json`
  - It currently requires two baseline staged URLs:
    - `https://www.moma.org/calendar/exhibitions/5825`
    - `https://www.moma.org/calendar/exhibitions/5906`
  - It stores `minimumExpectedRecords: 25` and `listingFixtureMaxAgeDays: 14`.
- Added shared browser-fixture audit utilities:
  - `scripts/exhibit-ingest/audit-browser-fixture-source.mjs`
  - The Met audit now uses the same shared logic.
- Added a MoMA audit command:
  - `npm run audit:moma`
  - It checks required seed URL coverage, minimum record count, and listing fixture age.
  - It exits with failure when the listing fixture is stale or a required seed URL is missing.
  - `npm run audit:moma -- --allow-stale` reports the same data but treats known staleness as a warning.
- Added MoMA audit tests:
  - `scripts/exhibit-ingest/audit-moma.test.mjs`
  - `npm test` now protects MoMA seed coverage without failing only because the known fixture is stale.
- Added a browser-assisted compact fixture builder:
  - `scripts/exhibit-ingest/refresh-moma-fixture.mjs`
  - `npm run refresh:moma:fixture -- --help`

Commands run:

```sh
node --test scripts/exhibit-ingest/parsers/moma-exhibitions.test.mjs scripts/exhibit-ingest/audit-moma.test.mjs scripts/exhibit-ingest/refresh-moma-fixture.test.mjs scripts/exhibit-ingest/audit-met.test.mjs
npm run ingest:exhibits:moma:stage
npm run audit:moma
npm run audit:moma -- --allow-stale
npm run refresh:moma:fixture -- --help
npm run review:staging:moma:summary
```

Results:

- Focused MoMA and shared audit tests passed.
- MoMA staging regenerated with 25 proposed exhibition records.
- `npm run audit:moma` now fails loudly because the listing fixture was captured on 2026-06-29 and is 16 days old, beyond the 14-day threshold.
- `npm run audit:moma -- --allow-stale` reports seed coverage 2/2 and records 25/25 while warning about staleness.
- Review summary still reports `needs_attention` because this is fixture-backed, pending live verification, and many records lack start dates, descriptions, and images.

Future MoMA refresh procedure:

1. Open `https://www.moma.org/calendar/exhibitions` in a normal browser session.
2. Let the public page render naturally. Do not bypass checkpoints or rate limits.
3. Copy official exhibition card data into a JSON array with `url`, `title`, `dateText`, and optional `imageUrl`.
4. Run:

```sh
npm run refresh:moma:fixture -- --input /path/to/moma-cards.json --output scripts/exhibit-ingest/fixtures/moma-exhibitions.browser-YYYY-MM-DD.html
```

5. Point `scripts/exhibit-ingest/sources/moma-exhibitions.fixture.json` at the new fixture only after validation passes.
6. Run:

```sh
npm run ingest:exhibits:moma:stage
npm run audit:moma
npm run review:staging:moma:summary
npm test
npm run build
```

Plain-language progress log:

- MoMA now has alarms like The Met. If the known required URLs disappear, if the record count drops below 25, or if the saved browser snapshot is too old, the audit command says so clearly.
- The current MoMA audit is supposed to fail because the saved snapshot is stale. That is useful: it means the system no longer quietly treats an old snapshot as complete.
- The next best MoMA work is to refresh the browser-assisted fixture from a normal browser session and add more must-not-miss seed URLs when important MoMA exhibitions are identified.

## 2026-07-14 Brooklyn Museum Guardrails and First Staging Slice

Run time: 2026-07-14 13:00 America/Chicago / 2026-07-14T18:00Z.

Goal:

- Clone the Met/MoMA guardrail pattern for Brooklyn Museum.
- Keep the work staging-only. No canonical records were promoted or edited.
- Use only official Brooklyn Museum exhibition URLs and label browser-assisted data honestly.

Problem:

- Direct backend fetches to `https://www.brooklynmuseum.org/exhibitions`, `https://www.brooklynmuseum.org/sitemap.xml`, and `https://www.brooklynmuseum.org/robots.txt` returned Vercel `429 Too Many Requests` checkpoint responses.
- The official exhibitions page could still be read in browser/search context, so the honest fallback is a compact browser-assisted fixture, not a live automated source.
- The first slice intentionally covers the linked "Included in General Admission" exhibition cards. Permanent collection galleries, museum spotlights, touring pages, and past exhibitions are out of scope until the source path is stronger.

Implemented:

- Added a Brooklyn Museum parser:
  - `scripts/exhibit-ingest/parsers/brooklyn-museum-exhibitions.mjs`
  - It parses compact official-page cards into staging records with Brooklyn Museum venue metadata.
- Added a compact browser-assisted fixture:
  - `scripts/exhibit-ingest/fixtures/brooklyn-museum-exhibitions.browser-2026-07-14.html`
  - It includes 8 linked official exhibition cards from `https://www.brooklynmuseum.org/exhibitions`.
- Added a fixture-backed source config:
  - `scripts/exhibit-ingest/sources/brooklyn-museum-exhibitions.fixture.json`
  - It marks verification as `pending_live_verification` and documents the Vercel `429` blocker.
- Added a required seed registry:
  - `scripts/exhibit-ingest/sources/brooklyn-museum-required-exhibitions.json`
  - It currently requires:
    - `https://www.brooklynmuseum.org/exhibitions/christian-marclay`
    - `https://www.brooklynmuseum.org/exhibitions/everyday-rebellions`
  - It stores `minimumExpectedRecords: 8` and `listingFixtureMaxAgeDays: 14`.
- Added Brooklyn audit and refresh helpers:
  - `scripts/exhibit-ingest/audit-brooklyn-museum.mjs`
  - `scripts/exhibit-ingest/refresh-brooklyn-museum-fixture.mjs`
- Added Brooklyn tests:
  - `scripts/exhibit-ingest/parsers/brooklyn-museum-exhibitions.test.mjs`
  - `scripts/exhibit-ingest/audit-brooklyn-museum.test.mjs`
  - `scripts/exhibit-ingest/refresh-brooklyn-museum-fixture.test.mjs`
- Wired Brooklyn into ingestion and package scripts:
  - `npm run ingest:exhibits:brooklyn-museum:stage`
  - `npm run audit:brooklyn-museum`
  - `npm run refresh:brooklyn-museum:fixture`
  - `npm run review:staging:brooklyn-museum:summary`
  - `npm run review-ui:brooklyn-museum`
- Generated the staging artifact:
  - `data/staging/brooklyn-museum-exhibitions.json`

Commands run:

```sh
node --test scripts/exhibit-ingest/parsers/brooklyn-museum-exhibitions.test.mjs scripts/exhibit-ingest/refresh-brooklyn-museum-fixture.test.mjs
npm run ingest:exhibits:brooklyn-museum:stage
npm run audit:brooklyn-museum
node --test scripts/exhibit-ingest/audit-brooklyn-museum.test.mjs
npm run refresh:brooklyn-museum:fixture -- --help
npm run review:staging:brooklyn-museum:summary
```

Results:

- Focused Brooklyn parser and refresh tests passed.
- Brooklyn staging generated 8 create proposals in `data/staging/brooklyn-museum-exhibitions.json`.
- `npm run audit:brooklyn-museum` passed:
  - Records: 8/8 minimum.
  - Seed coverage: 2/2 present.
  - Listing fixture age: 0 days old, within the 14-day maximum.
- Review summary reports `needs_attention` because the source is still fixture-backed and pending live verification.
- Review summary also warns that descriptions and image URLs are missing for 8/8 records. That is expected for this first slice because the compact listing fixture prioritized official URL/title/date coverage.

Future Brooklyn refresh procedure:

1. Open `https://www.brooklynmuseum.org/exhibitions` in a normal browser session.
2. Let the public page render naturally. Do not bypass checkpoints or rate limits.
3. Copy official exhibition card data into a JSON array with `url`, `title`, `dateText`, and optional `imageUrl`.
4. Run:

```sh
npm run refresh:brooklyn-museum:fixture -- --input /path/to/brooklyn-cards.json --output scripts/exhibit-ingest/fixtures/brooklyn-museum-exhibitions.browser-YYYY-MM-DD.html
```

5. Point `scripts/exhibit-ingest/sources/brooklyn-museum-exhibitions.fixture.json` at the new fixture only after validation passes.
6. Run:

```sh
npm run ingest:exhibits:brooklyn-museum:stage
npm run audit:brooklyn-museum
npm run review:staging:brooklyn-museum:summary
npm test
npm run build
```

Plain-language progress log:

- Brooklyn Museum now has the same basic alarms as The Met and MoMA. If required exhibition URLs disappear, if the record count drops below 8, or if the saved browser snapshot gets older than 14 days, the audit command says so clearly.
- Staging means a review area, not the live database. The backend database file `data/exhibit-records.json` was not changed.
- The current Brooklyn path is useful but not fully automatic. The server-side fetch is blocked by a Vercel checkpoint from this environment, so the system uses a compact snapshot from the official page and asks for human review before promotion.
- The next best Brooklyn work is to add detail-page enrichment for descriptions/images and to refresh the official-page fixture whenever it gets stale.

## 2026-07-15 Public Launch Dataset Readiness

Run time: 2026-07-15 12:23 America/Chicago / 2026-07-15T17:23Z.

Goal:

- Define the first public dataset for launching the exhibitions site.
- Keep public data restricted to approved canonical records.
- Do not promote staging records or edit the canonical backend database as part of the audit.

Problem:

- `data/exhibit-records.json` currently contains zero canonical records.
- That means there are many staged proposals, but no approved backend records that should be shown on the public site yet.
- Some staging files contain items marked `approved`, but they have not been promoted into `data/exhibit-records.json`; they are not public data until the approval flow is intentionally applied.

Implemented:

- Added a repeatable public launch audit:
  - `scripts/exhibit-ingest/audit-public-launch-data.mjs`
  - `npm run audit:public-launch`
- Added focused tests:
  - `scripts/exhibit-ingest/audit-public-launch-data.test.mjs`
- Generated the launch-readiness artifact:
  - `data/public-launch-readiness.json`
- The artifact includes:
  - generated timestamp and `asOf` date;
  - canonical record counts;
  - launch-ready record counts;
  - excluded canonical records and reasons;
  - venue/source coverage;
  - critical and recommended field coverage;
  - duplicate groups;
  - staging inventory that is explicitly marked not public;
  - warnings, risks, and next actions.

Commands run:

```sh
node --test scripts/exhibit-ingest/audit-public-launch-data.test.mjs
npm run audit:public-launch
```

Results:

- Canonical records: 0.
- Launch-ready public records: 0.
- Recommended first public venue set: empty.
- Public v1 readiness: not ready from canonical data.
- Staging inventory: 35 staging report files, 300 pending staged items, and 10 staged items already marked approved but not promoted.
- The staging inventory count includes both ordinary fixture-backed staging files and `.live.json` verification artifacts. Treat it as review-file inventory, not a deduped public exhibit count.

Public launch interpretation:

- The public site can be built now, but the public listings dataset is empty until records are approved and promoted.
- The next launch-critical action is not another scraper. It is approving a first public slice from staging, then running the existing promotion flow into `data/exhibit-records.json`.
- Good first approval candidates are sources with `verified_live` staging and low record counts, then carefully reviewed hard sources like Met, MoMA, and Brooklyn once their fixture-backed warnings are accepted.

Plain-language progress log:

- The audit found the sharp edge: the review pipeline has lots of proposed exhibits, but the public database is empty.
- A public website should read the public database, not staging. Staging is the workbench; the public database is the shelf visitors see.
- The project is close to shareable, but the next step is a human approval pass that moves selected staged exhibits into the canonical database.
- After that approval pass, `npm run audit:public-launch` will tell us exactly what can go online.

## 2026-07-15 Review App Approval Promotion

Run time: 2026-07-15 12:45 America/Chicago / 2026-07-15T17:45Z.

Goal:

- Make the review app match the desired operator workflow: clicking Approve should update the public backend database, not only the staging file.

Implemented:

- Updated `scripts/exhibit-ingest/review-ui.mjs` so an `approved` decision:
  - marks the staged item approved;
  - runs the existing validated approval plan;
  - writes the clicked eligible staged create proposal into `data/exhibit-records.json`;
  - skips records that already exist in canonical data.
- Added `--records` support to the review UI for testability and future deployment flexibility.
- Updated the in-app safety note so it now says approval writes eligible create proposals to the canonical public backend database.
- Added a regression test proving `applyReviewDecision` promotes approved creates into canonical records:
  - `scripts/exhibit-ingest/review-ui.test.mjs`

Commands run:

```sh
node --test scripts/exhibit-ingest/review-ui.test.mjs scripts/exhibit-ingest/approve-staging.test.mjs scripts/exhibit-ingest/audit-public-launch-data.test.mjs
npm test
npm run build
```

Results:

- Focused approval/review tests passed.
- Full test suite passed: 92 tests.
- Production build passed.
- The local review app was restarted at `http://127.0.0.1:8765` with canonical records file `data/exhibit-records.json`.

Plain-language progress log:

- The review app now does the thing a reviewer expects: Approve means "approve and publish this record to the backend database," for eligible new exhibition records.
- Reject and Needs Revision still only affect staging.
- The public site should still read from `data/exhibit-records.json`, not staging files.
- After approving records, run `npm run audit:public-launch` to see what is launch-ready.

## 2026-07-15 Met Link Correction and Approval Guard

Run time: 2026-07-15 12:49 America/Chicago / 2026-07-15T17:49Z.

Goal:

- Fix stale or incorrect Met exhibition links before any Met records can be promoted to the public backend database.
- Keep Met records staging-only. No Met records were approved or promoted.

Problem:

- The Met staging file still came from `scripts/exhibit-ingest/fixtures/met-exhibitions.browser-2026-06-29.html`.
- That old fixture still produced 24 records, so a count-only audit looked healthy even though the official Met listing had changed.
- The live official listing on `https://www.metmuseum.org/exhibitions` now includes current URLs such as:
  - `https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy`
  - `https://www.metmuseum.org/exhibitions/creatures-of-myth-and-imagination-europe-and-the-americas`
  - `https://www.metmuseum.org/exhibitions/gothic-by-design-the-dawn-of-architectural-draftsmanship`
  - `https://www.metmuseum.org/exhibitions/the-face-of-life-modern-portraits-at-the-met`
  - `https://www.metmuseum.org/exhibitions/city-of-memory-nanjing-in-the-17th-century`
  - `https://www.metmuseum.org/exhibitions/lillian-bassman-bazaar-and-beyond`
- Old snapshot-only URLs such as `superfine-tailoring-black-style`, `sargent-dazzling-paris`, `caspar-david-friedrich-soul-of-nature`, `city-life-1700s`, and `ps-art-2025` were no longer in the refreshed current/upcoming Met staging set.

Implemented:

- Created a dated source-card artifact from the current official Met listing:
  - `scripts/exhibit-ingest/fixtures/met-exhibitions.browser-2026-07-15.cards.json`
- Built a refreshed compact fixture with the existing builder:
  - `scripts/exhibit-ingest/fixtures/met-exhibitions.browser-2026-07-15.html`
- Pointed Met source config to the refreshed fixture:
  - `scripts/exhibit-ingest/sources/met-exhibitions.fixture.json`
- Regenerated Met staging:
  - `data/staging/met-exhibitions.json`
- Expanded required Met seed coverage from 1 URL to 11 active URLs:
  - `scripts/exhibit-ingest/sources/met-required-exhibitions.json`
- Added review-app approval protection for Met:
  - `scripts/exhibit-ingest/review-ui.mjs`
  - Clicking Approve for a Met staging record now runs the Met audit first.
  - If the audit fails, the record is not marked approved and is not promoted to `data/exhibit-records.json`.
  - The error message starts with: `Met approval blocked: source audit failed.`
- Added regression tests:
  - Met audit fails when required seed URLs are missing.
  - Review approval refuses to promote Met records when the Met audit fails.
  - Review approval still works for Met when the audit passes.

Commands run:

```sh
npm run refresh:met:fixture -- --input scripts/exhibit-ingest/fixtures/met-exhibitions.browser-2026-07-15.cards.json --output scripts/exhibit-ingest/fixtures/met-exhibitions.browser-2026-07-15.html --min-records 24
npm run ingest:exhibits:met:stage
node --test scripts/exhibit-ingest/audit-met.test.mjs scripts/exhibit-ingest/review-ui.test.mjs scripts/exhibit-ingest/parsers/met-exhibitions.test.mjs scripts/exhibit-ingest/refresh-met-fixture.test.mjs
npm run audit:met
npm run review:staging:met:summary
```

Results:

- Met staging now contains 24 current official Met URLs from the refreshed 2026-07-15 listing fixture.
- `npm run audit:met` passes:
  - Records: 24/24 minimum.
  - Required seed coverage: 11/11 present.
  - Fixture age: within the 14-day maximum.
- URL sanity check confirmed the required current URLs are present and the sampled stale old fixture URLs are absent.
- Met review summary still reports `needs_attention` because this source remains `pending_live_verification` and many listing cards lack start dates, descriptions, and images. That is separate from the link-staleness fix.

Plain-language progress log:

- The Met problem was not that the parser made up bad links. The problem was that it was reading an old saved copy of the Met page.
- The saved copy has now been refreshed from the official Met exhibitions page.
- The system now checks for a list of specific important Met URLs, not just a total count.
- The review app now refuses to publish Met records if the Met audit is failing.
- The next Met improvement is detail-page enrichment for descriptions, images, and better start dates, but the stale-link failure mode is now guarded.

## 2026-07-15 Met Review Preview Fallback

Run time: 2026-07-15 13:00 America/Chicago / 2026-07-15T18:00Z.

Problem:

- The review app embedded source pages through the local `/preview` proxy.
- Met URLs can return a browser verification page in that embedded server-side preview, which made the review pane show `Failed to verify your browser` instead of useful source context.
- This should not be bypassed. The review app should route reviewers to the official page in a normal browser tab when the embedded preview is not reliable.

Implemented:

- Added a Met host preview fallback in `scripts/exhibit-ingest/review-ui.mjs`.
- Met source URLs now show a clear `Source preview unavailable` panel with a direct `Open official source` link instead of loading the broken iframe.
- The `/preview` route also returns the fallback for Met URLs if opened directly.
- Added a regression test in `scripts/exhibit-ingest/review-ui.test.mjs` so Met URLs remain classified as embedded-preview blocked.

Plain-language progress log:

- The review app is no longer surprised by the Met verification wall.
- The official Met link remains one click away for review.
- This is a reviewer workflow fix, not a scraping bypass or a data promotion.

## 2026-07-15 Closed Exhibition Staging Lifecycle

Run time: 2026-07-15 13:30 America/Chicago / 2026-07-15T18:30Z.

Problem:

- Staging reports are static JSON review inboxes.
- If an exhibition was staged while active and then its `endDate` passed before review, it remained in the review app as pending clutter.
- This made closed exhibitions look like current actionable work.

Implemented:

- Added a closed-staging pruning utility:
  - `scripts/exhibit-ingest/prune-closed-staging.mjs`
  - `npm run prune:staging:closed`
- The pruning rule is conservative:
  - removes only `pending` or `needs_revision` staged exhibition items;
  - requires a real ISO `proposed.endDate`;
  - removes only when `endDate` is before the local as-of date;
  - keeps items ending today, items without an exact end date, and approved/rejected staging history.
- Wired the review app to prune closed staging items on startup and again when a selected staging file is loaded.
- Added tests in `scripts/exhibit-ingest/prune-closed-staging.test.mjs`.
- Updated Brooklyn Museum and MoMA required seed registries so active guardrails no longer require already-closed exhibitions.

Applied cleanup:

- Ran `npm run prune:staging:closed` on 2026-07-15.
- Removed 17 closed pending staging items across Bronx Museum, Brooklyn Museum, David Zwirner, Guggenheim, MoMA, and New Museum staging files.
- One old legacy artist staging file was skipped because it does not match the current exhibition staging schema:
  - `data/staging/margot-nielsen-2026-06-16-david-zwirner-artists.json`

Commands run:

```sh
npm run prune:staging:closed -- --dry-run
npm run prune:staging:closed
node --test scripts/exhibit-ingest/audit-brooklyn-museum.test.mjs scripts/exhibit-ingest/audit-moma.test.mjs scripts/exhibit-ingest/prune-closed-staging.test.mjs
npm test
npm run build
```

Results:

- Focused lifecycle and affected audit tests passed.
- Full test suite passed with 98 tests.
- Production build passed.

Plain-language progress log:

- The review app now cleans out closed pending exhibitions instead of letting them pile up.
- The command can also be run manually before or after ingest refreshes.
- This only cleans the staging review inbox. It does not delete approved canonical public records.

## 2026-07-15 Public Launch Dataset Refresh

Run time: 2026-07-15 13:45 America/Chicago / 2026-07-15T18:45Z.

Goal:

- Refresh Phase 1, Step 1 after human approvals were made in the review app.
- Define the first public dataset from canonical approved records only.
- Do not promote any staging records during this audit.

Implemented:

- Updated the repeatable public-launch audit:
  - `scripts/exhibit-ingest/audit-public-launch-data.mjs`
  - `npm run audit:public-launch`
- The audit now explicitly treats `reviewStatus: approved` as required for public launch.
- The readiness artifact now includes a concrete `launchReadyRecords` list with id, title, venue, date fields, and official URL.
- Regenerated:
  - `data/public-launch-readiness.json`

Current public-launch dataset:

- Canonical records: 17.
- Approved canonical exhibition records: 17.
- Launch-ready records: 17.
- Excluded canonical records: 0.
- Duplicate groups: 0.
- Recommended first public venue set:
  - The Jewish Museum
  - The Morgan Library & Museum
- Additional launchable seed:
  - The Metropolitan Museum of Art: 1 record, `Orientalism: Between Fact and Fantasy`

Coverage:

- Venue/source coverage:
  - The Jewish Museum: 8 records.
  - The Morgan Library & Museum: 8 records.
  - The Metropolitan Museum of Art: 1 record.
- Critical fields:
  - title: 17/17.
  - venue: 17/17.
  - sourceUrl: 17/17.
  - exhibitionUrl: 17/17.
  - at least one date signal: 17/17.
- Recommended fields:
  - imageUrl: 16/17.
  - venueAddress, city, borough: 17/17.
  - description: 1/17.
  - neighborhood: 9/17.

Excluded from public launch:

- Staging remains not public unless approved and promoted into `data/exhibit-records.json`.
- Current staging inventory: 257 pending staged items and 33 staged items marked approved in staging.
- Those staged records are useful review work, but they are not part of the public launch dataset until the approval flow writes them to canonical data.

Public v1 decision:

- Ready for a public v1 from canonical data.
- The safest first public slice is The Jewish Museum plus The Morgan Library & Museum, with the approved Met Orientalism record included if the product wants to show all canonical records rather than only venues with three or more records.
- The site should read from `data/exhibit-records.json` or from `data/public-launch-readiness.json.launchReadyRecords`, not from `data/staging/*.json`.

Commands run:

```sh
npm run audit:public-launch
```

Plain-language progress log:

- The public shelf is no longer empty. There are 17 approved exhibition records ready to show on a website.
- The biggest difference is that approved canonical records are public-ready, while staging records are still just review candidates.
- The site can launch with a small, honest first dataset now.
- More museums can be added by approving more staged records in the review app and rerunning `npm run audit:public-launch`.
