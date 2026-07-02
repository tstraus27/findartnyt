# ICP Exhibitions Discovery Notes

- Candidate source: `https://www.icp.org/exhibitions`
- Why this source next: official NYC museum page, server-rendered HTML, clear current/upcoming exhibition cards on one page, and card-level title/date/image/detail URLs that already satisfy the minimum exhibition contract.
- Observed on 2026-06-23:
  - The main page headline is `Current Exhibitions`.
  - Current exhibition cards appear before the `Upcoming Exhibitions` heading.
  - Upcoming exhibition cards appear on the same page before the `Past Exhibitions` section.
  - Each card exposes:
    - detail URL in `<a href="...">`
    - image URL in the child `<img src>`
    - title in `<H1 class="cards__title">`
    - date range text in `<div class="field__item">`
- Smallest safe next slice:
  - Add an ICP fixture snapshot of the official exhibitions page.
  - Add a staging-only source config and parser that stages current/upcoming cards into `data/staging/icp-exhibitions.json`.
  - Keep detail-page enrichment and the separate `future-exhibitions` landing page for a later slice if reviewers need richer metadata.
- Known caveats:
  - The page also contains `Past Exhibitions`; the parser should explicitly exclude those records.
  - The separate `https://www.icp.org/exhibitions/future-exhibitions` page currently renders without exhibition cards in this environment, so the first slice should rely on the main exhibitions page only.
