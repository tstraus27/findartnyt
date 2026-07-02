import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMorganExhibitionsPage } from './morgan-exhibitions.mjs';

const currentHtml = `
  <div id="views-bootstrap-exhibitions-page-1"  class="grid views-view-grid horizontal">
    <div class="row">
      <div class="col col-xs-12 col-sm-6 col-md-6 col-lg-6 "><div class="thumbnail">
        <div class="views-field views-field-field-teaser-image"><div class="field-content">  <a href="/exhibitions/hujar-contact" hreflang="en"><img loading="lazy" src="/sites/default/files/exhibitions/teasers/Hujar-Self-portraits_t.jpg" width="600" height="400" alt="" class="img-responsive" />
        </a>
        </div></div><div class="views-field views-field-title"><strong class="field-content">Hujar:Contact</strong></div><div class="views-field views-field-field-display-date"><em class="field-content">May 22 through October 25, 2026</em></div>
      </div></div>
      <div class="col col-xs-12 col-sm-6 col-md-6 col-lg-6 "><div class="thumbnail">
        <div class="views-field views-field-field-teaser-image"><div class="field-content">  <a href="/exhibitions/J-Pierpont-Morgans-Library" hreflang="en"><img loading="lazy" src="/sites/default/files/exhibitions/teasers/pierpont-morgans-library-bs_t.jpg" width="600" height="400" alt="" class="img-responsive" />
        </a>
        </div></div><div class="views-field views-field-title"><strong class="field-content">J. Pierpont Morgan&#039;s Library</strong></div><div class="views-field views-field-field-display-date"><em class="field-content">Ongoing</em></div>
      </div></div>
    </div>
  </div>
  <div id="views-bootstrap-exhibitions-block-1"  class="grid views-view-grid horizontal">
    <div class="row">
      <div class="col col-xs-12 col-sm-6 col-md-4 col-lg-4 "><div class="thumbnail">
        <div class="views-field views-field-field-teaser-image"><div class="field-content">  <a href="/exhibitions/sol-lewitt" hreflang="en"><img loading="lazy" src="/sites/default/files/styles/mediumlarge/public/exhibitions/teasers/sol-lewitt_t.jpg?itok=M3Kt1b2S" width="320" height="213" class="img-responsive" />
        </a>
        </div></div><div class="views-field views-field-title"><strong class="field-content">Sol LeWitt&#039;s Wall Drawing 552D</strong></div><div class="views-field views-field-field-display-date"><div class="field-content">Ongoing</div></div>
      </div></div>
    </div>
  </div>
`;

const upcomingHtml = `
  <div id="views-bootstrap-exhibitions-page-2"  class="grid views-view-grid horizontal">
    <div class="row">
      <div class="col col-xs-12 col-sm-6 col-md-6 col-lg-6 "><div class="thumbnail">
        <div class="views-field views-field-field-teaser-image"><div class="field-content">  <a href="/exhibitions/tarot" hreflang="en"><img loading="lazy" src="/sites/default/files/exhibitions/teasers/tarot-medieval-modern_t.jpg" width="600" height="400" alt="" class="img-responsive" />
        </a>
        </div></div><div class="views-field views-field-title"><strong class="field-content">Tarot! Renaissance Symbols, Modern Visions</strong></div><div class="views-field views-field-field-display-date"><em class="field-content">June 26 through October 4, 2026</em></div>
      </div></div>
      <div class="col col-xs-12 col-sm-6 col-md-6 col-lg-6 "><div class="thumbnail">
        <div class="views-field views-field-field-teaser-image"><div class="field-content">  <a href="/exhibitions/rembrandts-lions" hreflang="en"><img loading="lazy" src="/sites/default/files/exhibitions/teasers/rembrandt_179931v_0001_t.jpg" width="600" height="400" alt="" class="img-responsive" />
        </a>
        </div></div><div class="views-field views-field-title"><strong class="field-content">Rembrandt’s Lions: Art and Exile in the Dutch Republic</strong></div><div class="views-field views-field-field-display-date"><em class="field-content">October 23, 2026 through January 31, 2027</em></div>
      </div></div>
    </div>
  </div>
`;

test('parseMorganExhibitionsPage extracts only the main current exhibition grid', () => {
  const records = parseMorganExhibitionsPage({
    html: currentHtml,
    url: 'https://www.themorgan.org/exhibitions/current'
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'exhibition:morgan:hujar-contact',
    type: 'exhibition',
    source: 'morgan',
    title: 'Hujar:Contact',
    venue: 'The Morgan Library & Museum',
    startDate: '2026-05-22',
    endDate: '2026-10-25',
    dateText: 'May 22 through October 25, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '225 Madison Avenue, New York, NY 10016',
    neighborhood: null,
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.themorgan.org/sites/default/files/exhibitions/teasers/Hujar-Self-portraits_t.jpg',
    exhibitionUrl: 'https://www.themorgan.org/exhibitions/hujar-contact',
    sourceUrl: 'https://www.themorgan.org/exhibitions/hujar-contact',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Morgan Library & Museum official current and upcoming exhibition listing grids only. The separate Collection Spotlight block on the current page, plus online, past, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, "J. Pierpont Morgan's Library");
  assert.equal(records[1].startDate, null);
  assert.equal(records[1].endDate, null);
  assert.equal(records[1].dateText, 'Ongoing');
});

test('parseMorganExhibitionsPage extracts upcoming exhibition ranges, including cross-year dates', () => {
  const records = parseMorganExhibitionsPage({
    html: upcomingHtml,
    url: 'https://www.themorgan.org/exhibitions/upcoming'
  });

  assert.equal(records.length, 2);
  assert.equal(records[0].title, 'Tarot! Renaissance Symbols, Modern Visions');
  assert.equal(records[0].startDate, '2026-06-26');
  assert.equal(records[0].endDate, '2026-10-04');
  assert.deepEqual(records[0].tags, ['upcoming']);

  assert.equal(records[1].title, 'Rembrandt’s Lions: Art and Exile in the Dutch Republic');
  assert.equal(records[1].startDate, '2026-10-23');
  assert.equal(records[1].endDate, '2027-01-31');
});

test('parseMorganExhibitionsPage de-duplicates repeated cards by exhibition url', () => {
  const records = parseMorganExhibitionsPage({
    html: `${upcomingHtml}${upcomingHtml}`,
    url: 'https://www.themorgan.org/exhibitions/upcoming'
  });

  assert.equal(records.length, 2);
});
