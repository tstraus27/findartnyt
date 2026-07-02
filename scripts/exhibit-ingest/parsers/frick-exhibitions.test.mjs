import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFrickExhibitionsPage } from './frick-exhibitions.mjs';

const html = `
  <div class="paragraph-cards-layout__title prose prose-p:mt-0">
    <h2 class="h1-lg"><div id="current">Current</div></h2>
  </div>
  <div class="paragraph-cards-layout__cards">
    <div class="paragraph paragraph--type--card paragraph--view-mode--default paragraph-card">
      <div class="paragraph-card__img-wraper relative">
        <img src="/sites/default/files/styles/responsive_300w/public/images/2025/12/ruffles.jpg.webp?itok=abc">
      </div>
      <div class="paragraph-card__content-text prose prose-p:my-2">
        <div class="paragraph-card__body-text">
          <p><em><strong>Ruffles &amp; Ribbons: Fashion Plates from the Time of Marie Antoinette</strong></em><br>April 1 to August 3, 2026</p>
          <p>Organized in conjunction with <a href="/exhibitions/gainsborough"><em>Gainsborough: The Fashion of Portraiture</em></a>, this Cabinet installation presents twenty-four hand-colored engravings.</p>
          <p><a class="frickbutton mx-0 mb-0" href="/exhibitions/ruffles">Read More</a></p>
        </div>
      </div>
    </div>
  </div>
  <div class="paragraph-cards-layout__title prose prose-p:mt-0">
    <h2 class="h1-lg"><div id="upcoming">Upcoming</div></h2>
  </div>
  <div class="paragraph-cards-layout__cards">
    <div class="paragraph paragraph--type--card paragraph--view-mode--default paragraph-card">
      <div class="paragraph-card__img-wraper relative">
        <img src="/sites/default/files/styles/responsive_300w/public/images/2026/04/siena.jpg.webp?itok=123">
      </div>
      <div class="paragraph-card__content-text prose prose-p:my-2">
        <div class="paragraph-card__body-text">
          <p><em><strong>Siena: The Art of Bronze, 1450–1500</strong></em><br>October 15, 2026 to January 18, 2027</p>
          <p><em>Siena: The Art of Bronze, 1450–1500</em> is the first exhibition to focus on Siena as a center of artistic excellence.</p>
          <p><a class="frickbutton mx-0 mb-0" href="/exhibitions/siena">Read More</a></p>
        </div>
      </div>
    </div>
    <div class="paragraph paragraph--type--card paragraph--view-mode--default paragraph-card">
      <div class="paragraph-card__img-wraper relative">
        <img src="/sites/default/files/styles/responsive_300w/public/images/2026/05/de-court.jpg.webp?itok=456">
      </div>
      <div class="paragraph-card__content-text prose prose-p:my-2">
        <div class="paragraph-card__body-text">
          <p><em><strong>Painting with Fire: Susanne de Court and the Art of Enamel</strong></em><br>April 8 to July 12, 2027</p>
          <p>The Frick Collection will present the first exhibition dedicated to the French enameler Susanne de Court.</p>
          <p><a class="frickbutton mx-0 mb-0" href="/exhibitions/de_court">Read More<span class="sr-only">about the Susanne De Court exhibition</span></a></p>
        </div>
      </div>
    </div>
  </div>
  <div class="paragraph-cards-layout__title prose prose-p:mt-0">
    <h2 class="h1-lg"><p>Past | Featured&nbsp;</p></h2>
  </div>
  <div class="paragraph-cards-layout__cards">
    <div class="paragraph paragraph--type--card paragraph--view-mode--default paragraph-card">
      <div class="paragraph-card__content-text prose prose-p:my-2">
        <div class="paragraph-card__body-text">
          <p><em><strong>Ignore Me</strong></em><br>January 1 to February 1, 2026</p>
          <p><a class="frickbutton mx-0 mb-0" href="/exhibitions/ignore">Read More</a></p>
        </div>
      </div>
    </div>
  </div>
`;

test('parseFrickExhibitionsPage extracts current and upcoming exhibition cards only', () => {
  const records = parseFrickExhibitionsPage({
    html,
    url: 'https://www.frick.org/exhibitions'
  });

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    id: 'exhibition:frick:ruffles',
    type: 'exhibition',
    source: 'frick',
    title: 'Ruffles & Ribbons: Fashion Plates from the Time of Marie Antoinette',
    venue: 'The Frick Collection',
    startDate: '2026-04-01',
    endDate: '2026-08-03',
    dateText: 'April 1 to August 3, 2026',
    description:
      'Organized in conjunction with Gainsborough: The Fashion of Portraiture, this Cabinet installation presents twenty-four hand-colored engravings.',
    artists: [],
    curators: [],
    venueAddress: '1 East 70th Street, New York, NY 10021',
    neighborhood: 'Upper East Side',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl:
      'https://www.frick.org/sites/default/files/styles/responsive_300w/public/images/2025/12/ruffles.jpg.webp?itok=abc',
    exhibitionUrl: 'https://www.frick.org/exhibitions/ruffles',
    sourceUrl: 'https://www.frick.org/exhibitions/ruffles',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Frick Collection official exhibitions page current and upcoming card blocks only. Past exhibitions, virtual exhibitions, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, 'Siena: The Art of Bronze, 1450–1500');
  assert.equal(records[1].startDate, '2026-10-15');
  assert.equal(records[1].endDate, '2027-01-18');
  assert.deepEqual(records[1].tags, ['upcoming']);

  assert.equal(records[2].title, 'Painting with Fire: Susanne de Court and the Art of Enamel');
  assert.equal(records[2].startDate, '2027-04-08');
  assert.equal(records[2].endDate, '2027-07-12');
});

test('parseFrickExhibitionsPage de-duplicates repeated cards by exhibition url', () => {
  const records = parseFrickExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://www.frick.org/exhibitions'
  });

  assert.equal(records.length, 3);
});
