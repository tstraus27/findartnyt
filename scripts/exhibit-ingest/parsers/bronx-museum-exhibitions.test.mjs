import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBronxMuseumExhibitionsPage } from './bronx-museum-exhibitions.mjs';

const html = `
  <div class="featured-show">
    <h2 class="fs-title">
      <span>
        The Seventh AIM Biennial: Forms of Connection
        <a tabindex="-1" aria-hidden="true" class="hidden-link" href="https://bronxmuseum.org/exhibition/seventh-aim-biennial/">Read more about The Seventh AIM Biennial: Forms of Connection</a>
      </span>
    </h2>
  </div>
  <div class="filter-links">
    <a href="https://bronxmuseum.org/exhibitions/" class="show-category active">
      Current
    </a>
    <a href="https://bronxmuseum.org/exhibitions/?date_filter=upcoming" class="show-category ">
      Upcoming
    </a>
  </div>
  <div class="exhibitions">
    <article class="exhibition-card">
      <div class="exhibition-image">
        <img src="https://bronxmuseum.org/wp-content/uploads/2025/09/aim.jpg" alt="" />
      </div>
      <div class="exhibition-content">
        <h2 class="exhibition-title h6 is-family-sans-serif">
          The Seventh AIM Biennial: Forms of Connection
        </h2>
        <div class="exhibition-date">
          Jan 23 - Sep 6, 2026
        </div>
        <a class="exhibition-link" href="https://bronxmuseum.org/exhibition/seventh-aim-biennial/">
          <span class="is-sr-only">Read more</span>
        </a>
      </div>
    </article>
    <article class="exhibition-card">
      <div class="exhibition-image">
        <img src="/wp-content/uploads/2026/06/teen-council.png" alt="" />
      </div>
      <div class="exhibition-content">
        <h2 class="exhibition-title h6 is-family-sans-serif">
          Teen Council Spring 2026 Exhibition: &#8216;Museum of the Self&#8217;
        </h2>
        <div class="exhibition-date">
          Jun 8 - Jul 12, 2026
        </div>
        <a class="exhibition-link" href="/exhibition/teen-council-spring26/">
          <span class="is-sr-only">Read more</span>
        </a>
      </div>
    </article>
  </div>
  <div class="pagination"></div>
`;

test('parseBronxMuseumExhibitionsPage keeps the current exhibition-card grid and ignores the featured hero', () => {
  const records = parseBronxMuseumExhibitionsPage({
    html,
    url: 'https://bronxmuseum.org/exhibitions/'
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'exhibition:bronx-museum:seventh-aim-biennial',
    type: 'exhibition',
    source: 'bronx-museum',
    title: 'The Seventh AIM Biennial: Forms of Connection',
    venue: 'The Bronx Museum',
    startDate: '2026-01-23',
    endDate: '2026-09-06',
    dateText: 'Jan 23 - Sep 6, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '1040 Grand Concourse, Bronx, NY 10456',
    neighborhood: 'Concourse',
    borough: 'Bronx',
    city: 'New York',
    imageUrl: 'https://bronxmuseum.org/wp-content/uploads/2025/09/aim.jpg',
    exhibitionUrl: 'https://bronxmuseum.org/exhibition/seventh-aim-biennial/',
    sourceUrl: 'https://bronxmuseum.org/exhibition/seventh-aim-biennial/',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Bronx Museum official exhibitions archive using visible Current and Upcoming exhibition-card grids after the filter links. The featured-show hero is ignored to avoid duplicate staging, Archive filters remain out of scope, and youth-program cards are currently staged when they appear in the same official exhibition grids.'
  });
  assert.equal(records[1].title, 'Teen Council Spring 2026 Exhibition: ‘Museum of the Self’');
  assert.equal(records[1].startDate, '2026-06-08');
  assert.equal(records[1].endDate, '2026-07-12');
  assert.equal(records[1].imageUrl, 'https://bronxmuseum.org/wp-content/uploads/2026/06/teen-council.png');
  assert.equal(records[1].exhibitionUrl, 'https://bronxmuseum.org/exhibition/teen-council-spring26/');
});

test('parseBronxMuseumExhibitionsPage de-duplicates repeated current cards', () => {
  const records = parseBronxMuseumExhibitionsPage({
    html: html.replace('</div>\n  <div class="pagination"></div>', '</div><article class="exhibition-card"><div class="exhibition-image"><img src="/wp-content/uploads/2026/06/teen-council.png" alt="" /></div><div class="exhibition-content"><h2 class="exhibition-title h6 is-family-sans-serif">Teen Council Spring 2026 Exhibition: &#8216;Museum of the Self&#8217;</h2><div class="exhibition-date">Jun 8 - Jul 12, 2026</div><a class="exhibition-link" href="/exhibition/teen-council-spring26/"><span class="is-sr-only">Read more</span></a></div></article><div class="pagination"></div>'),
    url: 'https://bronxmuseum.org/exhibitions/'
  });

  assert.equal(records.length, 2);
});

test('parseBronxMuseumExhibitionsPage stages upcoming filter cards as upcoming', () => {
  const upcomingHtml = html
    .replace('href="https://bronxmuseum.org/exhibitions/" class="show-category active"', 'href="https://bronxmuseum.org/exhibitions/" class="show-category "')
    .replace('href="https://bronxmuseum.org/exhibitions/?date_filter=upcoming" class="show-category "', 'href="https://bronxmuseum.org/exhibitions/?date_filter=upcoming" class="show-category active"')
    .replaceAll('Jan 23 - Sep 6, 2026', 'Oct 1 - Dec 12, 2026');

  const records = parseBronxMuseumExhibitionsPage({
    html: upcomingHtml,
    url: 'https://bronxmuseum.org/exhibitions/?date_filter=upcoming'
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0].tags, ['upcoming']);
  assert.equal(records[0].startDate, '2026-10-01');
});
