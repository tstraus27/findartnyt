# The Noguchi Museum Exhibitions Discovery Notes

- Candidate source: `https://www.noguchi.org/museum/exhibitions/`
- Source status as of 2026-06-25: discovery and fixture capture complete; parser/config work has not started yet.
- Why this source next: official NYC museum page, fetchable `HTTP 200` HTML in this environment, and the first visible exhibition cards already expose title, date text, detail URL, and image data directly in server-rendered markup.
- Why this source is safer than nearby alternatives right now:
  - MoMA returned a Cloudflare challenge (`403`) on 2026-06-25.
  - Brooklyn Museum and the Met returned Vercel challenge responses (`429`) on 2026-06-25.
  - Tenement Museum returned a Cloudflare challenge (`403`) on 2026-06-25.
  - Noguchi returns normal HTML without a challenge page, which makes fixture/live parity work much safer.

## Observed On 2026-06-25

- The official page returns normal server-rendered WordPress HTML in this environment, and the checked-in fixture now lives at `scripts/exhibit-ingest/fixtures/noguchi-exhibitions.html`.
- The main listing body appears under `<main id="main" ... class="museum_exhibitions ...">` with repeated cards inside `<div class="grid-exhibitions">`.
- Each exhibition appears twice in the raw HTML, once for desktop and once for mobile, so the first parser will need URL-based dedupe.
- The first visible on-site museum records currently appear before any offsite entries:
  - `Noguchi's New York`
  - `Light and Stone: Revisiting Noguchi's 1986 Venice Biennale`
- Offsite records are explicitly labeled with an eyebrow such as `offsite: Atlanta, Georgia` or `offsite: Honolulu, Hawai‘i`.
- Repeated card blocks already expose:
  - title
  - detail URL
  - date text such as `From February 4 to September 13, 2026`
  - image URLs via `img[data-srcset]`

## Smallest Safe Next Slice

1. Keep the checked-in fixture snapshot of `https://www.noguchi.org/museum/exhibitions/`.
2. Add fixture/live source configs for `noguchi-exhibitions`.
3. Parse only the first visible on-site museum cards from `grid-exhibitions` before the first explicit `offsite:` eyebrow.
4. Deduplicate desktop/mobile copies by exhibition URL before staging.
5. Exclude all offsite exhibitions and defer detail-page enrichment until the museum-only listing artifact is stable and reviewable.
