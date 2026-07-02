import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWhitneyExhibitionsPage } from './whitney-exhibitions.mjs';

const html = `
<section id="current">
  <ul class="exhibitions__list">
    <li class="list-item exhibition-list-item">
      <a href="/exhibitions/2026-biennial">
        <img src="https://images.example.org/biennial.jpg" />
        <h3 class="list-item__title list-item__title--large">Whitney Biennial 2026</h3>
        <p class="list-item__subtitle list-item__subtitle--large">Through Aug 23</p>
      </a>
    </li>
    <li class="list-item exhibition-list-item">
      <a href="/exhibitions/nourish">
        <img src="/images/nourish.jpg" />
        <h3 class="list-item__title list-item__title--large">Dyani White Hawk: Nourish&nbsp;</h3>
        <p class="list-item__subtitle list-item__subtitle--large"></p>
      </a>
    </li>
  </ul>
</section>
<section id="upcoming">
  <ul class="exhibitions__list">
    <li class="list-item exhibition-list-item">
      <a href="/exhibitions/lichtenstein">
        <img src="https://images.example.org/lichtenstein.jpg" />
        <h3 class="list-item__title list-item__title--large">Roy Lichtenstein</h3>
        <p class="list-item__subtitle list-item__subtitle--large">Opens 2026</p>
      </a>
    </li>
    <li class="list-item exhibition-list-item">
      <a href="/exhibitions/opening-soon">
        <img src="https://images.example.org/opening-soon.jpg" />
        <h3 class="list-item__title list-item__title--large">Opening Soon</h3>
        <p class="list-item__subtitle list-item__subtitle--large">Opens Sep 2026</p>
      </a>
    </li>
  </ul>
</section>
<section id="online">
  <ul class="exhibitions__list">
    <li class="list-item exhibition-list-item">
      <a href="/exhibitions/ignore-online">
        <img src="https://images.example.org/online.jpg" />
        <h3 class="list-item__title list-item__title--large">Ignore Online</h3>
        <p class="list-item__subtitle list-item__subtitle--large">2026</p>
      </a>
    </li>
  </ul>
</section>
`;

test('parseWhitneyExhibitionsPage extracts current and upcoming exhibition cards only', () => {
  const records = parseWhitneyExhibitionsPage({
    html,
    url: 'https://whitney.org/exhibitions'
  });

  assert.equal(records.length, 4);
  assert.deepEqual(records[0], {
    id: 'exhibition:whitney:2026-biennial',
    type: 'exhibition',
    source: 'whitney',
    title: 'Whitney Biennial 2026',
    venue: 'Whitney Museum of American Art',
    startDate: null,
    endDate: null,
    dateText: 'Through Aug 23',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '99 Gansevoort Street, New York, NY 10014',
    neighborhood: 'Meatpacking District',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://images.example.org/biennial.jpg',
    exhibitionUrl: 'https://whitney.org/exhibitions/2026-biennial',
    sourceUrl: 'https://whitney.org/exhibitions/2026-biennial',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Whitney exhibitions index page current/upcoming sections only. Date text is preserved exactly as shown on the list page for reviewer context, even when linked official detail pages later provide exact dates and richer metadata.'
  });

  assert.equal(records[1].title, 'Dyani White Hawk: Nourish');
  assert.equal(records[1].imageUrl, 'https://whitney.org/images/nourish.jpg');
  assert.equal(records[1].dateText, null);
  assert.deepEqual(records[1].tags, ['current']);

  assert.equal(records[2].startDate, '2026');
  assert.deepEqual(records[2].tags, ['upcoming']);

  assert.equal(records[3].startDate, '2026-09');
  assert.deepEqual(records[3].tags, ['upcoming']);
});

test('parseWhitneyExhibitionsPage dedupes repeated cards by exhibition slug', () => {
  const duplicatedHtml = `${html}${html}`;
  const records = parseWhitneyExhibitionsPage({
    html: duplicatedHtml,
    url: 'https://whitney.org/exhibitions'
  });

  assert.equal(records.length, 4);
});

test('parseWhitneyExhibitionsPage extracts detail-page JSON-LD enrichment', () => {
  const detailHtml = `
    <meta name="description" content="A focused exhibition about experimental painting." />
    <meta property="og:title" content="Experimental Painting" />
    <meta property="og:image" content="https://images.example.org/painting.jpg" />
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "ExhibitionEvent",
        "@id": "https://whitney.org/exhibitions/experimental-painting",
        "name": "Experimental Painting",
        "description": "A focused exhibition about experimental painting.",
        "startDate": "2026-09-14T00:00:00-04:00",
        "endDate": "2027-01-11T00:00:00-05:00",
        "image": "https://images.example.org/painting-hero.jpg"
      }
    </script>
  `;

  const records = parseWhitneyExhibitionsPage({
    html: detailHtml,
    url: 'https://whitney.org/exhibitions/experimental-painting'
  });

  assert.deepEqual(records, [
    {
      id: 'exhibition:whitney:experimental-painting',
      type: 'exhibition',
      source: 'whitney',
      title: 'Experimental Painting',
      venue: 'Whitney Museum of American Art',
      startDate: '2026-09-14',
      endDate: '2027-01-11',
      dateText: null,
      description: 'A focused exhibition about experimental painting.',
      artists: [],
      curators: [],
      venueAddress: '99 Gansevoort Street, New York, NY 10014',
      neighborhood: 'Meatpacking District',
      borough: 'Manhattan',
      city: 'New York',
      imageUrl: 'https://images.example.org/painting-hero.jpg',
      exhibitionUrl: 'https://whitney.org/exhibitions/experimental-painting',
      sourceUrl: 'https://whitney.org/exhibitions/experimental-painting',
      openingReceptionDate: null,
      tags: [],
      sourceConfidence: 'high',
      reviewStatus: 'needs_review',
      lastCheckedAt: null,
      sourceNotes:
        'Enriched from the official Whitney exhibition detail page JSON-LD and metadata for exact dates and optional description/image fields.'
    }
  ]);
});
