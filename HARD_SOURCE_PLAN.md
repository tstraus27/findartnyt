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
