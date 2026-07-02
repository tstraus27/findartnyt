import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNoguchiExhibitionsPage } from './noguchi-exhibitions.mjs';

const html = `
  <main id="main" role="main" class="museum_exhibitions wrap exhibitions-barba-view">
    <div class="grid-exhibitions">
      <div class="item hide-for-mobile-portrait block">
        <div class="text text-align-right">
          <div class="block-quarter headline title"><a href="https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/">Noguchi&rsquo;s New York</a></div>
          <div class="subheadline text-gray date"><a href="https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/">From February 4 to September 13, 2026</a></div>
        </div>
        <div class="img">
          <a href="https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/">
            <img data-srcset="https://www.noguchi.org/wp-content/uploads/2025/07/04144-scaled.jpg 1693w, https://www.noguchi.org/wp-content/uploads/2025/07/04144-1016x1536.jpg 1016w">
          </a>
        </div>
      </div>
      <div class="item show-for-mobile-portrait block">
        <div class="img">
          <a href="https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/">
            <img data-srcset="https://www.noguchi.org/wp-content/uploads/2025/07/04144-scaled.jpg 1693w, https://www.noguchi.org/wp-content/uploads/2025/07/04144-1016x1536.jpg 1016w">
          </a>
        </div>
        <div class="text text-align-center">
          <div class="block-quarter headline title"><a href="https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/">Noguchi&rsquo;s New York</a></div>
          <div class="subheadline text-gray date"><a href="https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/">From February 4 to September 13, 2026</a></div>
        </div>
      </div>
      <div class="item hide-for-mobile-portrait block">
        <div class="img">
          <a href="https://www.noguchi.org/museum/exhibitions/view/future-exhibition/">
            <img data-srcset="/wp-content/uploads/2026/09/future.jpg 1200w, /wp-content/uploads/2026/09/future-800.jpg 800w">
          </a>
        </div>
        <div class="text">
          <div class="block-quarter headline title"><a href="https://www.noguchi.org/museum/exhibitions/view/future-exhibition/">Future Forms</a></div>
          <div class="subheadline text-gray date"><a href="https://www.noguchi.org/museum/exhibitions/view/future-exhibition/">From November 1, 2026 to February 1, 2027</a></div>
        </div>
      </div>
      <div class="item hide-for-mobile-portrait block">
        <div class="text text-align-right">
          <div class="eyebrow">offsite: Atlanta, Georgia</div>
          <div class="block-quarter headline title"><a href="https://www.noguchi.org/museum/exhibitions/view/offsite-show/">Offsite Show</a></div>
          <div class="subheadline text-gray date"><a href="https://www.noguchi.org/museum/exhibitions/view/offsite-show/">From April 10 to August 2, 2026</a></div>
        </div>
      </div>
    </div>
  </main>
`;

test('parseNoguchiExhibitionsPage extracts museum-only listing cards before the first offsite entry', () => {
  const records = parseNoguchiExhibitionsPage({
    html,
    url: 'https://www.noguchi.org/museum/exhibitions/'
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'exhibition:noguchi:noguchis-new-york',
    type: 'exhibition',
    source: 'noguchi',
    title: 'Noguchi’s New York',
    venue: 'The Noguchi Museum',
    startDate: '2026-02-04',
    endDate: '2026-09-13',
    dateText: 'From February 4 to September 13, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '9-01 33rd Road, Long Island City, NY 11106',
    neighborhood: 'Long Island City',
    borough: 'Queens',
    city: 'New York',
    imageUrl: 'https://www.noguchi.org/wp-content/uploads/2025/07/04144-scaled.jpg',
    exhibitionUrl: 'https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/',
    sourceUrl: 'https://www.noguchi.org/museum/exhibitions/view/noguchis-new-york/',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Noguchi Museum official Current & Upcoming exhibitions page listing cards before the first explicit offsite entry. Desktop/mobile duplicates are deduped by exhibition URL, and offsite listings plus any detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, 'Future Forms');
  assert.equal(records[1].startDate, '2026-11-01');
  assert.equal(records[1].endDate, '2027-02-01');
  assert.deepEqual(records[1].tags, ['upcoming']);
});

test('parseNoguchiExhibitionsPage de-duplicates desktop and mobile copies by exhibition url', () => {
  const records = parseNoguchiExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://www.noguchi.org/museum/exhibitions/'
  });

  assert.equal(records.length, 2);
});
