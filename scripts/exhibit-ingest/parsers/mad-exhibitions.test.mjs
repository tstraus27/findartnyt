import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMadExhibitionsPage } from './mad-exhibitions.mjs';

const html = `
  <div class="view view-see-exhibitions view-display-id-new_current_exhibitions grid">
    <div class="views-row views-row-1">
      <a href="/exhibition/haas-brothers-uncanny-valley"><img src="/sites/default/files/haas.jpg" alt="Haas"></a>
      <div class="list-text-inner">
        <div class="list-title"><h1><a href="/exhibition/haas-brothers-uncanny-valley">Haas Brothers: Uncanny Valley</a></h1></div>
        <div class="list-dates"><h4><a href="/exhibition/haas-brothers-uncanny-valley">Through <span class="date-display-">Aug 16, 2026</span></a></h4></div>
      </div>
    </div>
    <div class="views-row views-row-2">
      <a href="/exhibition/out-jewelry-box"><img src="https://madmuseum.org/sites/default/files/out.jpg"></a>
      <div class="list-text-inner">
        <div class="list-title"><h1><a href="/exhibition/out-jewelry-box">OUT of the Jewelry Box</a></h1></div>
        <div class="list-dates"><h4><a href="/exhibition/out-jewelry-box">Ongoing</a></h4></div>
      </div>
    </div>
  </div>
  <div class="exhibition-head spacer-60-top" id="upcoming"><h1>Upcoming</h1></div>
  <div class="view view-see-exhibitions view-display-id-new_future_exhibitions grid">
    <div class="views-row views-row-1">
      <div class="grid-image"><a href="/exhibition/nike-form-follows-motion"><img src="/sites/default/files/nike.jpg" alt="Nike"></a></div>
      <div class="grid-title"><h3><a href="/exhibition/nike-form-follows-motion">Nike: Form Follows Motion</a></h3></div>
      <div class="grid-dates"><h4>Opens <a href="/exhibition/nike-form-follows-motion"><span class="date-display-">Sep 12, 2026</span></a></h4></div>
    </div>
  </div>
  <div class="exhibition-head spacer-120-top" id="installations"><h1>Installations</h1></div>
  <div class="view view-see-exhibitions view-display-id-new_long_term_exhibitions grid">
    <div class="views-row views-row-1">
      <div class="grid-title"><h3><a href="/exhibition/seeing-believing">Seeing is Believing</a></h3></div>
    </div>
  </div>
`;

test('parseMadExhibitionsPage extracts current and upcoming exhibitions only', () => {
  const records = parseMadExhibitionsPage({
    html,
    url: 'https://madmuseum.org/exhibitions'
  });

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    id: 'exhibition:mad:haas-brothers-uncanny-valley',
    type: 'exhibition',
    source: 'mad',
    title: 'Haas Brothers: Uncanny Valley',
    venue: 'Museum of Arts and Design',
    startDate: null,
    endDate: '2026-08-16',
    dateText: 'Through Aug 16, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '2 Columbus Circle, New York, NY 10019',
    neighborhood: 'Columbus Circle',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://madmuseum.org/sites/default/files/haas.jpg',
    exhibitionUrl: 'https://madmuseum.org/exhibition/haas-brothers-uncanny-valley',
    sourceUrl: 'https://madmuseum.org/exhibition/haas-brothers-uncanny-valley',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Museum of Arts and Design official exhibitions page current and upcoming listing grids only. Installations and past exhibitions remain out of scope; linked official detail pages may later enrich dates and reviewer-facing metadata without promoting anything to canonical.'
  });

  assert.equal(records[1].title, 'OUT of the Jewelry Box');
  assert.equal(records[1].dateText, 'Ongoing');
  assert.equal(records[1].startDate, null);
  assert.equal(records[1].endDate, null);

  assert.equal(records[2].title, 'Nike: Form Follows Motion');
  assert.equal(records[2].startDate, '2026-09-12');
  assert.equal(records[2].endDate, null);
  assert.deepEqual(records[2].tags, ['upcoming']);
});

test('parseMadExhibitionsPage de-duplicates repeated rows by exhibition url', () => {
  const records = parseMadExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://madmuseum.org/exhibitions'
  });

  assert.equal(records.length, 3);
});

test('parseMadExhibitionsPage enriches official detail pages with visible date text and description', () => {
  const detailHtml = `
    <meta property="og:image" content="https://madmuseum.org/sites/default/files/2026/03/nike.jpg" />
    <meta property="og:title" content="Nike: Form Follows Motion" />
    <meta property="og:url" content="https://madmuseum.org/exhibition/nike-form-follows-motion" />
    <div class="page-title-alt"><h1>Nike: Form Follows Motion</h1></div>
    <h4 class="spacer-48-bottom">Sep 12, 2026–Mar 7, 2027</h4>
    <div class="grid-sidebar-right">
      <div class="grid-left oll">
        <div class="page-section">
          <p>"One of the year's must-see design shows."</p>
          <p>The ultimate exhibition of the world’s most influential sports brand traces Nike’s growth over the last five decades.</p>
          <p>Drawn primarily from the Department of Nike Archives, the exhibition assembles prototypes, design studies, rarities, and one-offs.</p>
        </div>
        <div class="mobile-none spacer-24-bottom"></div>
      </div>
    </div>
  `;

  const records = parseMadExhibitionsPage({
    html: detailHtml,
    url: 'https://madmuseum.org/exhibition/nike-form-follows-motion'
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    id: 'exhibition:mad:nike-form-follows-motion',
    type: 'exhibition',
    source: 'mad',
    title: 'Nike: Form Follows Motion',
    venue: 'Museum of Arts and Design',
    startDate: '2026-09-12',
    endDate: '2027-03-07',
    dateText: 'Sep 12, 2026–Mar 7, 2027',
    description:
      'The ultimate exhibition of the world’s most influential sports brand traces Nike’s growth over the last five decades.\n\nDrawn primarily from the Department of Nike Archives, the exhibition assembles prototypes, design studies, rarities, and one-offs.',
    artists: [],
    curators: [],
    venueAddress: '2 Columbus Circle, New York, NY 10019',
    neighborhood: 'Columbus Circle',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://madmuseum.org/sites/default/files/2026/03/nike.jpg',
    exhibitionUrl: 'https://madmuseum.org/exhibition/nike-form-follows-motion',
    sourceUrl: 'https://madmuseum.org/exhibition/nike-form-follows-motion',
    openingReceptionDate: null,
    tags: [],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Enriched from the official Museum of Arts and Design exhibition detail page for visible date text plus optional description/image metadata while keeping the source staging-only.'
  });
});
