import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJewishMuseumExhibitionsPage } from './jewish-museum-exhibitions.mjs';

const html = `
  <section>
    <div class="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue focus-within:outline-dotted">
      <a href="https://thejewishmuseum.org/exhibitions/collection-exhibition-and-center-for-learning-october-2025/"
        aria-label="On View, Identity, Culture, and Community: Stories from the Collection, Oct. 24, 2025 — Ongoing">
        <div class="relative">
          <img data-src="https://thejewishmuseum.org/images/identity.jpg" />
        </div>
        <div class="px-2 py-5">
          <div class="flex items-center gap-2">
            <div class="text-category font-mono text-blue">On View</div>
          </div>
          <p class="text-card-title mt-3.5 hover:text-blue">
            Identity, Culture, and Community: Stories from the Collection
          </p>
          <div class="mt-2 flex items-center gap-2 text-card-datetime font-mono">
            <span>Oct. 24, 2025 — Ongoing</span>
          </div>
        </div>
      </a>
    </div>
    <div class="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue focus-within:outline-dotted">
      <a href="/exhibitions/paul-klee-other-possible-worlds/"
        aria-label="On View, Paul Klee: Other Possible Worlds, Mar. 20 – Jul. 26, 2026">
        <div class="relative">
          <img data-src="/images/klee.jpg" />
        </div>
        <div class="px-2 py-5">
          <div class="flex items-center gap-2">
            <div class="text-category font-mono text-blue">On View</div>
          </div>
          <p class="text-card-title mt-3.5 hover:text-blue">
            Paul Klee: Other Possible Worlds
          </p>
          <div class="mt-2 flex items-center gap-2 text-card-datetime font-mono">
            <span>Mar. 20 – Jul. 26, 2026</span>
          </div>
        </div>
      </a>
    </div>
    <div class="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue focus-within:outline-dotted">
      <a href="/exhibitions/women-of-the-wiener-werkstatte/"
        aria-label="Coming Soon, Modernity and Opulence, Jul. 17 – Nov. 15, 2026">
        <div class="relative">
          <img data-src="/images/wiener.jpg" />
        </div>
        <div class="px-2 py-5">
          <div class="flex items-center gap-2">
            <div class="text-category font-mono text-blue">Coming Soon</div>
          </div>
          <p class="text-card-title mt-3.5 hover:text-blue">
            Modernity and Opulence: Women of the Wiener Werkstätte
          </p>
          <div class="mt-2 flex items-center gap-2 text-card-datetime font-mono">
            <span>Jul. 17 – Nov. 15, 2026</span>
          </div>
        </div>
      </a>
    </div>
  </section>
  <div id="schedule">
    <div class="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue focus-within:outline-dotted">
      <a href="/exhibitions/ignore-calendar-card/">
        <div class="relative">
          <img data-src="/images/ignore.jpg" />
        </div>
        <div class="px-2 py-5">
          <div class="flex items-center gap-2">
            <div class="text-category font-mono text-blue">On View</div>
          </div>
          <p class="text-card-title mt-3.5 hover:text-blue">Ignore Calendar Card</p>
          <div class="mt-2 flex items-center gap-2 text-card-datetime font-mono">
            <span>Jan. 1 – Feb. 1, 2026</span>
          </div>
        </div>
      </a>
    </div>
  </div>
`;

test('parseJewishMuseumExhibitionsPage extracts server-rendered Jewish Museum exhibition cards before the calendar mount', () => {
  const records = parseJewishMuseumExhibitionsPage({
    html,
    url: 'https://thejewishmuseum.org/exhibitions/'
  });

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    id: 'exhibition:jewish-museum:collection-exhibition-and-center-for-learning-october-2025',
    type: 'exhibition',
    source: 'jewish-museum',
    title: 'Identity, Culture, and Community: Stories from the Collection',
    venue: 'The Jewish Museum',
    startDate: '2025-10-24',
    endDate: null,
    dateText: 'Oct. 24, 2025 — Ongoing',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '1109 5th Avenue, New York, NY 10128',
    neighborhood: 'Upper East Side',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://thejewishmuseum.org/images/identity.jpg',
    exhibitionUrl: 'https://thejewishmuseum.org/exhibitions/collection-exhibition-and-center-for-learning-october-2025/',
    sourceUrl: 'https://thejewishmuseum.org/exhibitions/collection-exhibition-and-center-for-learning-october-2025/',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Jewish Museum official exhibitions page server-rendered cards that appear before the client-side schedule calendar. The React calendar and any later detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, 'Paul Klee: Other Possible Worlds');
  assert.equal(records[1].startDate, '2026-03-20');
  assert.equal(records[1].endDate, '2026-07-26');
  assert.equal(records[1].imageUrl, 'https://thejewishmuseum.org/images/klee.jpg');
  assert.deepEqual(records[1].tags, ['current']);

  assert.equal(records[2].title, 'Modernity and Opulence: Women of the Wiener Werkstätte');
  assert.equal(records[2].startDate, '2026-07-17');
  assert.equal(records[2].endDate, '2026-11-15');
  assert.deepEqual(records[2].tags, ['upcoming']);
});

test('parseJewishMuseumExhibitionsPage dedupes repeated cards by exhibition slug', () => {
  const records = parseJewishMuseumExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://thejewishmuseum.org/exhibitions/'
  });

  assert.equal(records.length, 3);
});
