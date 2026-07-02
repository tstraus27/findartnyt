# Whitney Exhibitions Discovery Notes

- Candidate source: `https://whitney.org/exhibitions`
- Why this source next: official NYC museum page, server-rendered HTML, separate `current` and `upcoming` sections, and stable per-exhibition detail links.
- Observed on 2026-06-23:
  - Current exhibitions are listed under `<section id="current">`.
  - Upcoming exhibitions are listed under `<section id="upcoming">`.
  - Each exhibition card is an `<li class="exhibition-list-item">` with:
    - detail URL in the child `<a href>`
    - title in `<h3 class="list-item__title">`
    - date/status text in `<p class="list-item__subtitle">`
    - image URL in the child `<img src>`
- Smallest safe next slice:
  - Add a Whitney fixture snapshot of the exhibitions index page. Done.
  - Add a staging-only source config and parser that stages current/upcoming exhibition cards into `data/staging/whitney-exhibitions.json`. Done.
  - Follow linked official Whitney exhibition detail pages and merge their `ExhibitionEvent` JSON-LD into the staged records so exact dates come from the official source. Done: the current artifact now has `startDate` on 7 of 7 staged items and `endDate` on 7 of 7 staged items.
- Known caveats:
  - The list page exposes compact date text such as `Through Aug 23` or `Opens 2026`; a parser will need explicit review notes when exact start/end dates are missing.
  - Brooklyn Museum and MoMA surfaced bot checkpoints in this environment, so Whitney is the clearest next official source for a low-risk staging-first slice.
  - Live verification is now complete for the index-plus-detail page flow: the live Whitney staging artifact matched the fixture-backed artifact on 2026-06-23 with `added=0`, `removed=0`, and `changed=0`.
