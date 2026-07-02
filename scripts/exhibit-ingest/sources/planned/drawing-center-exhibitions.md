# The Drawing Center Exhibitions Candidate

- Official source URL: `https://drawingcenter.org/exhibitions`
- Why this is the next source candidate: the official exhibitions page is fetchable from this environment without a bot challenge, exposes server-rendered `On View` and `Upcoming Exhibitions` sections, and includes reviewer-useful titles, exhibition URLs, date text, and image URLs directly in the listing HTML.
- Why not MoMA, Brooklyn Museum, or the Met right now: live requests from this environment currently return a Cloudflare block for MoMA (`403`) and Vercel security checkpoints for Brooklyn Museum and the Met (`429`), which makes a stable fixture/live parity loop riskier than The Drawing Center for the next slice.

## Observed Page Shape On 2026-06-24

- The main page body contains `<main id="exhibitions">`.
- The current slice can key off `<section role="list" id="onview" class="general_module">`.
- Upcoming listings appear under `<section role="list" id="upcoming" class="general_module">`.
- Each listing uses a repeated `<section role="listitem" ... class="exhibit_module">` structure with:
  - a `<time>` element containing reviewer-facing date text such as `Through Sep 27, 2026` or `Jun 26–Sep 27, 2026`
  - an `<h2>` title link pointing to the official exhibition detail page
  - an image preview inside the same listing module
- Some list items are series/program wrappers such as `Student Exhibition` or `Bookstore Pop-Up`, so the first parser should stay conservative and stage only the linked exhibition title plus the visible date text, without attempting to infer extra taxonomy from surrounding series labels.

## Smallest Safe First Slice

1. Capture a fixture snapshot of `https://drawingcenter.org/exhibitions`.
2. Add fixture/live source configs for `drawing-center-exhibitions`.
3. Parse only the server-rendered `onview` and `upcoming` list sections from the main index page.
4. Stage only listing-level fields: `title`, `venue`, `dateText`, parsed `startDate`/`endDate` when obvious, `sourceUrl`, `exhibitionUrl`, `imageUrl`, and standard venue metadata.
5. Exclude `past` and any detail-page enrichment until the listing-only artifact is stable and reviewable.

## Verification Notes

- Live fetch check performed on `2026-06-24`: `https://drawingcenter.org/exhibitions` returned `200` with server-rendered exhibition markup.
- Live fetch comparison on the same date:
  - `https://www.moma.org/calendar/exhibitions` returned `403`
  - `https://www.brooklynmuseum.org/exhibitions` returned `429`
  - `https://www.metmuseum.org/exhibitions/listings` returned `429`
  - `https://www.guggenheim.org/exhibitions` returned `200`, but its listing data appears embedded in a larger application payload and is a less conservative next slice than The Drawing Center
