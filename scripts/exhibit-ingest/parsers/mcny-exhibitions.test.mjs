import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMcnyExhibitionsPage } from './mcny-exhibitions.mjs';

const html = `
  <a name="exhibitions-on-view"></a>
  <section class="events">
    <div class="card-deck">
      <div class="row is-flex">
        <div class="col-xs-12 col-sm-7 gutter-bottom">
          <article class="card rectangle">
            <div class="img-wrap">
              <a href="https://www.mcny.org/exhibition/another-wonderland">
                <figure class="card-img">
                  <img src="/sites/default/files/styles/mcny_whats_on_rectangle/public/AnotherWonderland-Thumbnail.jpg?h=8a7fc05e&amp;itok=GW5glac7" alt="">
                </figure>
              </a>
            </div>
            <div class="card-block">
              <div class="meta-info">
                <span class="date">Through September 27, 2026</span>
              </div>
              <h2><a href="https://www.mcny.org/exhibition/another-wonderland" class="active">Another Wonderland</a></h2>
              <span class="hidden-sm-down">Celebrates the rescue and restoration of a major New Deal-era mural cycle.</span>
            </div>
          </article>
        </div>
        <div class="col-xs-12 col-sm-5 gutter-bottom">
          <article class="card square">
            <div class="img-wrap">
              <a href="https://www.mcny.org/exhibition/he-built-city">
                <figure class="card-img">
                  <img src="/sites/default/files/styles/mcny_whats_on_large_square/public/He-Built-This-City-Exhibition-Thumbnail.jpg?h=71f18c95&amp;itok=pyStRXTr" alt="">
                </figure>
              </a>
            </div>
            <div class="card-block">
              <div class="meta-info">
                <span class="date">Ongoing</span>
              </div>
              <h2><a href="https://www.mcny.org/exhibition/he-built-city" class="active">He Built This City</a></h2>
              <span class="hidden-sm-down">Explore Joe Macken's monumental model.</span>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
  <a name="exhibitions-upcoming"></a>
  <div class="card-deck">
    <div class="block-region-upcoming">
      <div class="row is-flex">
        <div class="col-xs-12 col-sm-4 gutter-bottom">
          <article class="card">
            <div class="img-wrap">
              <a href="https://www.mcny.org/exhibition/halumii-ktapihna">
                <figure class="card-img">
                  <img src="/sites/default/files/styles/mcny_col_3_thumbnail/public/Halumii-Ktapihna_Thumbnail.jpg?h=8a7fc05e&amp;itok=Y6l7cGh_" alt="">
                </figure>
              </a>
            </div>
            <div class="card-block">
              <div class="meta-info">
                <span class="date">Opens September 25, 2026</span>
              </div>
              <h2><a href="https://www.mcny.org/exhibition/halumii-ktapihna">Halumii Ktapihna</a></h2>
              <div class="hidden-sm-down">Encounter the enduring presence and living cultures of the Lenape/Lunaapeew.</div>
            </div>
          </article>
        </div>
        <div class="col-xs-12 col-sm-4 gutter-bottom">
          <article class="card">
            <div class="img-wrap">
              <a href="https://www.mcny.org/exhibition/new-york-now-after-dark">
                <figure class="card-img">
                  <img src="/sites/default/files/styles/mcny_col_3_thumbnail/public/88.1.1.3027.jpg?h=5a66cccd&amp;itok=QBXcxPF-" alt="">
                </figure>
              </a>
            </div>
            <div class="card-block">
              <div class="meta-info">
                <span class="date">Opens November 20, 2026</span>
              </div>
              <h2><a href="https://www.mcny.org/exhibition/new-york-now-after-dark">New York Now: After Dark</a></h2>
              <div class="hidden-sm-down">Will explore the vibrant and multifaceted nightlife of New York City.</div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
  <a name="exhibitions-online"></a>
  <div class="card-deck">
    <div class="block-region-online">
      <div class="row is-flex">
        <div class="col-xs-12 col-sm-4 gutter-bottom">
          <article class="card">
            <div class="card-block">
              <div class="meta-info"><span class="date">Ongoing</span></div>
              <h2><a href="https://www.mcny.org/exhibition/ignore-online">Ignore Online</a></h2>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
`;

test('parseMcnyExhibitionsPage extracts on-view and upcoming cards only', () => {
  const records = parseMcnyExhibitionsPage({
    html,
    url: 'https://www.mcny.org/exhibitions'
  });

  assert.equal(records.length, 4);
  assert.deepEqual(records[0], {
    id: 'exhibition:mcny:another-wonderland',
    type: 'exhibition',
    source: 'mcny',
    title: 'Another Wonderland',
    venue: 'Museum of the City of New York',
    startDate: null,
    endDate: '2026-09-27',
    dateText: 'Through September 27, 2026',
    description: 'Celebrates the rescue and restoration of a major New Deal-era mural cycle.',
    artists: [],
    curators: [],
    venueAddress: '1220 5th Avenue, New York, NY 10029',
    neighborhood: 'East Harlem',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl:
      'https://www.mcny.org/sites/default/files/styles/mcny_whats_on_rectangle/public/AnotherWonderland-Thumbnail.jpg?h=8a7fc05e&itok=GW5glac7',
    exhibitionUrl: 'https://www.mcny.org/exhibition/another-wonderland',
    sourceUrl: 'https://www.mcny.org/exhibition/another-wonderland',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Museum of the City of New York official exhibitions page using the visible Exhibitions On View and Upcoming Exhibitions card sections only. Online exhibitions, traveling exhibitions, past exhibitions, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, 'He Built This City');
  assert.equal(records[1].startDate, null);
  assert.equal(records[1].endDate, null);
  assert.equal(records[1].dateText, 'Ongoing');
  assert.deepEqual(records[1].tags, ['current']);

  assert.equal(records[2].title, 'Halumii Ktapihna');
  assert.equal(records[2].startDate, '2026-09-25');
  assert.equal(records[2].endDate, null);
  assert.deepEqual(records[2].tags, ['upcoming']);

  assert.equal(records[3].title, 'New York Now: After Dark');
  assert.equal(records[3].startDate, '2026-11-20');
  assert.equal(records[3].endDate, null);
});

test('parseMcnyExhibitionsPage de-duplicates repeated cards by exhibition url', () => {
  const records = parseMcnyExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://www.mcny.org/exhibitions'
  });

  assert.equal(records.length, 4);
  assert.ok(records.every((record) => record.id !== 'exhibition:mcny:ignore-online'));
});
