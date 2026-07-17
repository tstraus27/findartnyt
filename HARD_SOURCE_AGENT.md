# Hard Source Agent

Purpose: keep The Met, MoMA, and Brooklyn Museum moving toward credible staging ingestion without drifting into easier sources.

## Mission

Maintain and improve staging-only ingestion paths for:

1. The Museum of Modern Art
2. The Metropolitan Museum of Art
3. Brooklyn Museum

Do not add small museums, galleries, auction houses, or unrelated sources while any of these three lacks either a working staging path or a documented blocker plus next-best fallback.

## Operating Rules

- Never write directly to `data/exhibit-records.json`.
- Always produce or update staging artifacts under `data/staging/`.
- Keep human review required before promotion.
- Keep `scripts/exhibit-ingest/review-ui.mjs` compatible with generated artifacts.
- Do not bypass CAPTCHAs, authentication, rate limits, or edge security challenges.
- Prefer official URLs, official structured data, and conservative browser-assisted snapshots.
- Label browser-assisted/manual workflows honestly.
- Run `npm test` and `npm run build` before reporting done.
- Maintain a plain-language progress log in `HARD_SOURCE_PLAN.md` for a CS beginner: explain what changed, why it matters, what is blocked, and what happens next without assuming the reader knows backend or ingestion terminology.

## State Files

Primary state:

- `HARD_SOURCE_PLAN.md`
- `data/staging/moma-exhibitions.json`
- `data/staging/met-exhibitions.json`
- `data/staging/brooklyn-museum-exhibitions.json`

Source configs:

- `scripts/exhibit-ingest/sources/moma-exhibitions.fixture.json`
- `scripts/exhibit-ingest/sources/met-exhibitions.fixture.json`
- `scripts/exhibit-ingest/sources/brooklyn-museum-exhibitions.fixture.json`

Parsers:

- `scripts/exhibit-ingest/parsers/moma-exhibitions.mjs`
- `scripts/exhibit-ingest/parsers/met-exhibitions.mjs`
- `scripts/exhibit-ingest/parsers/brooklyn-museum-exhibitions.mjs`

## Agent Loop

1. Read `HARD_SOURCE_PLAN.md`.
2. Inspect current source configs, parsers, tests, and staging artifacts for MoMA, The Met, and Brooklyn.
3. Pick the next source:
   - If MoMA staging is absent or broken, fix MoMA.
   - Else if The Met staging is absent or broken, work on The Met.
   - Else if Brooklyn staging is absent or broken, work on Brooklyn.
   - Else improve the weakest existing path, prioritizing live official data over browser-assisted snapshots.
4. Probe access conservatively:
   - Node fetch with normal headers.
   - Node fetch with browser-like headers.
   - Browser render, if available.
   - Official alternates: structured data, JSON-LD, sitemap, RSS, documented APIs, embedded page payloads.
5. Update `HARD_SOURCE_PLAN.md` with:
   - exact timestamps, URLs, commands, results, risks, and next step;
   - a plain-language progress log entry for a CS beginner.
6. Implement only the first viable path for the chosen source:
   - fixture-backed config first,
   - parser,
   - parser tests,
   - staging artifact,
   - review command/script if useful.
7. Verify:
   - source-specific parser test,
   - staging generation,
   - review summary,
   - `npm test`,
   - `npm run build`.
8. Report:
   - what works now,
   - what remains blocked,
   - exact next source,
   - any human/browser action required.

## Plain-Language Progress Log Rules

Every run must add or update a short entry in the `Plain-Language Progress Log` section of `HARD_SOURCE_PLAN.md`.

Write it for a smart reader who is new to computer science:

- Start with the plain outcome: for example, "The Met now has a staging file with 23 proposed exhibition records."
- Explain technical words briefly the first time they matter. Example: "staging means a review area, not the live public data."
- Say why the work matters to the overall goal.
- Say what remains stuck or risky in normal language.
- Say exactly what the next run should try.
- Keep the tone calm and direct. Avoid burying the useful news under command output.

## Current Dynamic Priority

As of 2026-07-14:

1. MoMA has a browser-assisted fixture-backed staging path with 25 proposals and stale-fixture guardrails.
2. The Met has a browser-assisted fixture-backed staging path with 24 proposals, including `Orientalism: Between Fact and Fantasy`, plus stale-fixture and required-seed guardrails.
3. Brooklyn Museum has a browser-assisted fixture-backed first staging slice with 8 proposals and matching guardrails. It still needs live verification or a refreshed browser-assisted fixture when direct backend fetch is no longer blocked.

## Reusable Prompt

Use this prompt to start the agent in a future Codex thread:

```text
You are the Hard Source Agent for the exhibition backend.

Read HARD_SOURCE_AGENT.md and HARD_SOURCE_PLAN.md first. Continue the agent loop exactly as documented. Do not add easier sources. Do not promote canonical records. Work staging-only.

Pick the next hard source by dynamic priority. Probe access conservatively, update HARD_SOURCE_PLAN.md, implement only the first viable staging path, generate staging JSON, verify review compatibility, run npm test and npm run build, then report what works, what remains blocked, the next source, and any human action required.

Also update the Plain-Language Progress Log in HARD_SOURCE_PLAN.md so a CS beginner can understand what changed, why it matters, what is blocked, and what the next run should do.
```

## Manual Browser Snapshot Pattern

When direct backend fetch is blocked but browser render works:

1. Open the official source URL in a normal browser session.
2. Wait for the page to render naturally.
3. Extract only the official exhibition card/link data needed by the parser.
4. Save a compact fixture in `scripts/exhibit-ingest/fixtures/`.
5. Mark the source config verification as `pending_live_verification`.
6. Make `stagingNotes` explicitly say `browser-assisted`.
7. Generate staging JSON through `scripts/exhibit-ingest/ingest.mjs`.
8. Require human review before promotion.

This is an honest staging workflow, not a fully automated live ingestion path.
