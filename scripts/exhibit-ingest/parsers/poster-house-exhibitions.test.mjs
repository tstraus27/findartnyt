import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePosterHouseExhibitionsPage } from './poster-house-exhibitions.mjs';

const html = `
  <div id="content-index-block_current" class="block-content-index block-content-thumbnail">
    <div class="panel-exhibitions-container data-container" data-query="{&quot;content_type&quot;:&quot;exhibition&quot;,&quot;content_source&quot;:&quot;custom&quot;,&quot;custom_contents&quot;:[{&quot;post_name&quot;:&quot;act-black-posters-from-black-american-stage-screen&quot;,&quot;post_content&quot;:&quot;&lt;p&gt;First exhibition paragraph.&lt;/p&gt;&lt;p&gt;Second exhibition paragraph.&lt;/p&gt;&lt;p&gt;&lt;strong&gt;Curator Name&lt;/strong&gt; is a historian and curator.&lt;/p&gt;&quot;}]}">
      <div class="header-title flex-child-auto">
        <h2 class="content-index-title h1-style">On View</h2>
      </div>
      <div class=" item-data" data-tax="">
        <div class="image-on-left">
          <a href="https://www.posterhouse.org/exhibition/act-black-posters-from-black-american-stage-screen/">
            <img class="image-thumbnail" data-img-src="https://www.posterhouse.org/wp-content/uploads/2025/07/act-black.jpg" alt="" />
          </a>
          <div class="desc-container">
            <a href="https://www.posterhouse.org/exhibition/act-black-posters-from-black-american-stage-screen/" class="title link border-animation ">Act Black: Posters from Black American Stage &amp; Screen<span class="visually-hidden">.</span></a>
            <div class="subtitle">Mar 13&ndash;Sep 6, 2026<span class="visually-hidden">.</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="content-index-block_upcoming" class="block-content-index block-content-grid">
    <div class="panel-exhibitions-container data-container" data-query="{&quot;content_type&quot;:&quot;exhibition&quot;,&quot;content_source&quot;:&quot;custom&quot;,&quot;custom_contents&quot;:[{&quot;post_name&quot;:&quot;cuteness-conservatism-consumption-lefor-openo-and-postwar-france&quot;,&quot;post_content&quot;:&quot;&lt;p&gt;Upcoming exhibition paragraph.&lt;/p&gt;&quot;}]}">
      <div class="header-title flex-child-auto">
        <h2 class="content-index-title h1-style">Upcoming Exhibitions</h2>
      </div>
      <div class="cell small-6 medium-4 item-data" data-tax="">
        <div class="column-thumbnail">
          <a href="https://www.posterhouse.org/exhibition/cuteness-conservatism-consumption-lefor-openo-and-postwar-france/" target="">
            <div class="image-container">
              <img class="image-thumbnail wp-post-image" src="https://www.posterhouse.org/wp-content/uploads/2025/12/lefor-openo.jpg" alt="" />
            </div>
          </a>
          <div class="desc-container">
            <a href="https://www.posterhouse.org/exhibition/cuteness-conservatism-consumption-lefor-openo-and-postwar-france/" class="title link border-animation ">Cuteness, Conservatism, &amp; Consumption: Lefor-Openo and Postwar France<span class="visually-hidden">.</span></a>
            <div class="subtitle">Sep 25, 2026&ndash;Feb 21, 2027<span class="visually-hidden">.</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="content-index-block_past" class="block-content-index block-content-grid">
    <div class="panel-exhibitions-container data-container" data-query="{&quot;content_type&quot;:&quot;exhibition&quot;,&quot;content_source&quot;:&quot;past&quot;,&quot;custom_contents&quot;:[]}">
      <div class="header-title flex-child-auto">
        <h2 class="content-index-title h1-style">Past Exhibitions</h2>
      </div>
      <div class="cell small-6 medium-4 item-data" data-tax="">
        <div class="column-thumbnail">
          <a href="https://www.posterhouse.org/exhibition/past-example/" class="title link border-animation ">Past Example<span class="visually-hidden">.</span></a>
          <div class="subtitle">Jan 1&ndash;Feb 1, 2025<span class="visually-hidden">.</span></div>
        </div>
      </div>
    </div>
  </div>

  <div id="content-index-block_other" class="block-content-index block-content-grid">
    <div class="panel-exhibitions-container data-container" data-query="{&quot;content_type&quot;:&quot;story&quot;,&quot;content_source&quot;:&quot;custom&quot;,&quot;custom_contents&quot;:[]}">
      <div class="header-title flex-child-auto">
        <h2 class="content-index-title h1-style">Upcoming Exhibitions</h2>
      </div>
      <div class="cell small-6 medium-4 item-data" data-tax="">
        <div class="column-thumbnail">
          <a href="https://example.com/not-a-poster-house-exhibition" class="title link border-animation ">Not A Poster House Exhibition<span class="visually-hidden">.</span></a>
          <div class="subtitle">Jan 1&ndash;Feb 1, 2028<span class="visually-hidden">.</span></div>
        </div>
      </div>
    </div>
  </div>
`;

test('parsePosterHouseExhibitionsPage keeps current and upcoming cards, enriches descriptions, and excludes past', () => {
  const records = parsePosterHouseExhibitionsPage({
    html,
    url: 'https://www.posterhouse.org/exhibitions/'
  });

  assert.equal(records.length, 2);

  assert.deepEqual(records[0], {
    id: 'exhibition:poster-house:act-black-posters-from-black-american-stage-screen',
    type: 'exhibition',
    source: 'poster-house',
    title: 'Act Black: Posters from Black American Stage & Screen',
    venue: 'Poster House',
    startDate: '2026-03-13',
    endDate: '2026-09-06',
    dateText: 'Mar 13–Sep 6, 2026',
    description: 'First exhibition paragraph.\n\nSecond exhibition paragraph.',
    artists: [],
    curators: [],
    venueAddress: '119 W. 23rd Street, New York, NY 10011',
    neighborhood: 'Chelsea',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.posterhouse.org/wp-content/uploads/2025/07/act-black.jpg',
    exhibitionUrl: 'https://www.posterhouse.org/exhibition/act-black-posters-from-black-american-stage-screen/',
    sourceUrl: 'https://www.posterhouse.org/exhibition/act-black-posters-from-black-american-stage-screen/',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the official Poster House exhibitions page using the visible On View and Upcoming Exhibitions cards for exact dates, URLs, and images, then enriched with the same page’s embedded exhibition payload for long-form descriptions. Past Exhibitions and detail-page fetches remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, 'Cuteness, Conservatism, & Consumption: Lefor-Openo and Postwar France');
  assert.equal(records[1].startDate, '2026-09-25');
  assert.equal(records[1].endDate, '2027-02-21');
  assert.equal(records[1].tags[0], 'upcoming');
  assert.equal(records[1].description, 'Upcoming exhibition paragraph.');
});
