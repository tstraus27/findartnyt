import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDrawingCenterExhibitionsPage } from './drawing-center-exhibitions.mjs';

const html = `
  <main id="exhibitions">
    <section role="list" id="onview" class="general_module">
      <nav class="page_nav type-medium overlap">
        <h1 class="type-medium section_indicator active">On View</h1>
      </nav>
      <section role="listitem" id="series-onview-0" class="exhibit_module series_module">
        <section class="gen_mod_content">
          <main class="seriesExhibit_half grid-half">
            <h3 class="type-medium">
              <time datetime="Sun Sep 27 2026 00:00:00 GMT-0400">Through Sep 27, 2026</time><br>
              <a href="/exhibitions/series/student-exhibition" class="u_link">Student Exhibition</a>
            </h3>
            <h2 class="half_page_title">
              <a href="/exhibitions/drawingconnections">Drawing Connections: Student Exhibition</a>
            </h2>
          </main>
          <a href="/exhibitions/drawingconnections" class="seriesview_preview grid-half">
            <figure class="object-fit-polyfill">
              <img src="https://cdn.example.org/drawing-connections.jpg">
            </figure>
          </a>
        </section>
      </section>
    </section>
    <section role="list" id="upcoming" class="general_module">
      <h1 class="general_section_title section_title">Upcoming Exhibitions</h1>
      <section role="listitem" id="upcoming-0" class="exhibit_module">
        <h3><time datetime="Fri Jun 26 2026 00:00:00 GMT-0400">Jun 26–Sep 27, 2026</time></h3>
        <h2 class="page_title"><a href="/exhibitions/certainly-an-act-pope-l">Certainly an Act: Works on Paper by Pope.L</a></h2>
        <div thumbnail="[object Object]" class="on_view_carousel_wrapper"><!----></div>
      </section>
      <section role="listitem" id="upcoming-1" class="exhibit_module series_module">
        <section class="gen_mod_content">
          <main class="seriesExhibit_half grid-half">
            <h3 class="type-medium">
              <time datetime="Fri Jun 26 2026 00:00:00 GMT-0400">Jun 26–Sep 27, 2026</time><br>
              <a href="/exhibitions/series/stairwell-installation-series" class="u_link">Bookstore Pop-Up</a>
            </h3>
            <h2 class="half_page_title"><a href="/exhibitions/blackartlibrary">Black Art Library at The Drawing Center</a></h2>
          </main>
          <a href="/exhibitions/blackartlibrary" class="seriesview_preview grid-half">
            <figure class="object-fit-polyfill"><img src="/images/black-art-library.jpg"></figure>
          </a>
        </section>
      </section>
    </section>
    <section id="past" class="general_module show_images">
      <h1 class="general_section_title section_title">Past Exhibitions</h1>
      <section role="listitem" id="past-0" class="exhibit_module">
        <h3><time datetime="Fri Jan 01 2026 00:00:00 GMT-0400">Jan 1–Feb 1, 2026</time></h3>
        <h2 class="page_title"><a href="/exhibitions/ignore-me">Ignore Me</a></h2>
      </section>
    </section>
  </main>
  <script>
    window.__NUXT__=(function(a,b,c,d,e){return {state:{exhibitions:{indexed:{onview:[{slug:"drawingconnections",startDate:"2026-05-20T04:00:00+00:00",endDate:a,thumbnail:[{smallpreview:"https://cdn.example.org/drawing-connections-fallback.jpg"}]}],upcoming:[{slug:"certainly-an-act-pope-l",startDate:b,endDate:a,thumbnail:[{smallpreview:c}]},{slug:"blackartlibrary",startDate:b,endDate:a,thumbnail:[{smallpreview:d}]}]}}}}}("2026-09-27T04:00:00+00:00","2026-06-26T04:00:00+00:00","https://cdn.example.org/certainly-fallback.jpg","https://cdn.example.org/black-fallback.jpg",null));
  </script>
`;

test('parseDrawingCenterExhibitionsPage extracts on-view and upcoming listing cards only', () => {
  const records = parseDrawingCenterExhibitionsPage({
    html,
    url: 'https://drawingcenter.org/exhibitions'
  });

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    id: 'exhibition:drawing-center:drawingconnections',
    type: 'exhibition',
    source: 'drawing-center',
    title: 'Drawing Connections: Student Exhibition',
    venue: 'The Drawing Center',
    startDate: '2026-05-20',
    endDate: '2026-09-27',
    dateText: 'Through Sep 27, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '35 Wooster Street, New York, NY 10013',
    neighborhood: 'SoHo',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://cdn.example.org/drawing-connections.jpg',
    exhibitionUrl: 'https://drawingcenter.org/exhibitions/drawingconnections',
    sourceUrl: 'https://drawingcenter.org/exhibitions/drawingconnections',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Drawing Center official exhibitions page server-rendered on-view and upcoming listing modules only. Past exhibitions and any detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].title, 'Certainly an Act: Works on Paper by Pope.L');
  assert.equal(records[1].startDate, '2026-06-26');
  assert.equal(records[1].endDate, '2026-09-27');
  assert.equal(records[1].imageUrl, 'https://cdn.example.org/certainly-fallback.jpg');
  assert.deepEqual(records[1].tags, ['upcoming']);

  assert.equal(records[2].title, 'Black Art Library at The Drawing Center');
  assert.equal(records[2].startDate, '2026-06-26');
  assert.equal(records[2].endDate, '2026-09-27');
  assert.equal(records[2].imageUrl, 'https://drawingcenter.org/images/black-art-library.jpg');
});

test('parseDrawingCenterExhibitionsPage de-duplicates repeated list items by exhibition url', () => {
  const records = parseDrawingCenterExhibitionsPage({
    html: `${html}${html}`,
    url: 'https://drawingcenter.org/exhibitions'
  });

  assert.equal(records.length, 3);
});
