import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCooperHewittExhibitionsPage } from './cooper-hewitt-exhibitions.mjs';

const currentHtml = `
  <div class="page-body row">
    <div class="col-sm-4 col-1">
      <h1>MADE IN AMERICA: THE INDUSTRIAL PHOTOGRAPHY OF CHRISTOPHER PAYNE<br />
      ON VIEW through sept. 27, 2026</h1>
      <p><a href="/channel/made-in-america/"><img src="https://www.cooperhewitt.org/wp-content/uploads/2025/05/2015CP20_SD_3-300x228.jpg" alt="" /></a></p>
      <p><em>Made in America </em>brings together more than 70 large-format photographs captured by Christopher Payne over a decade-long photographic journey to learn more about the craft of both industrial and artisanal making in the United States.</p>
      <p><a href="/channel/made-in-america/"><strong>Learn more about <em>Made in America </em>→</strong></a></p>
      <p><em>Made in America: The Industrial Photography of Christopher Payne</em> received support from Smithsonian’s Our Shared Future: 250.</p>
      <p><img src="https://www.cooperhewitt.org/wp-content/uploads/2025/06/Made_in_America_Sponsorlogos-300x64.jpg" alt="" /></p>
      <h6>Photo: Wool carders, 2012.</h6>
    </div>
    <div class="col-sm-4 col-2">
      <h1>Devon Turnbull: HiFi Pursuit Listening Room Dream No. 3<strong><br />
      </strong>ON VIEW through July 19, 2026</h1>
      <p><a href="/channel/devon-turnbull/"><img src="/wp-content/uploads/2025/12/DevonTurnbull_CH_1-300x225.jpg" alt="" /></a></p>
      <p>Part of <em>Art of Noise,</em> the installation <em>HiFi Pursuit Listening Room Dream No. 3</em> features a large scale, handmade, audio system by multi-disciplinary artist Devon Turnbull.</p>
      <p><a href="/channel/devon-turnbull/"><strong>Learn more about <em>HiFi Pursuit Listening Room Dream No. 3</em> →</strong></a></p>
      <p>This exhibition is made possible by the August Heckscher Exhibition Fund.</p>
      <p><img src="/wp-content/uploads/2025/12/Art-of-Noise_Sponsorlogos-1-1-150x150.jpg" alt="" /></p>
      <h6>Photo: Devon Turnbull.</h6>
    </div>
  </div>
`;

const upcomingHtml = `
  <div class="full-width-image-wrapper image-container ">
    <img src="https://www.cooperhewitt.org/wp-content/uploads/2026/03/WebBanner_2000x1000-DesignAcrossTime-030226-1.jpg" class="attachment-full size-full wp-post-image" alt="" />
  </div>
  <div class="page-body row">
    <div class="col-xs-12 col-1">
      <h1><strong>Design Across Time: Exploring the Smithsonian&#8217;s Design Collection<br />
      OPENS June 26, 2026</strong></h1>
      <p>Occupying the entire first floor of the museum’s Carnegie Mansion, <em>Design Across Time</em> expands public access to Cooper Hewitt’s collection.</p>
      <p><em>Design Across Time</em> organizes the museum’s vast collection around thematic clusters.</p>
      <p><a href="https://www.cooperhewitt.org/channel/design-across-time/">Learn more about <strong><em>Design Across Time</em></strong>→</a></p>
      <div class="ewa-rteLine"><em>Design Across Time</em> received major support from donors.</div>
      <div><img src="https://www.cooperhewitt.org/wp-content/uploads/2026/06/DAT-logo-lockup.jpg" alt="" /></div>
    </div>
  </div>
  <div class="ewa-rteLine"></div>
`;

test('parseCooperHewittExhibitionsPage keeps only visible current exhibition copy before sponsor and photo-credit tails', () => {
  const records = parseCooperHewittExhibitionsPage({
    html: currentHtml,
    url: 'https://www.cooperhewitt.org/exhibitions/'
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'exhibition:cooper-hewitt:made-in-america',
    type: 'exhibition',
    source: 'cooper-hewitt',
    title: 'MADE IN AMERICA: THE INDUSTRIAL PHOTOGRAPHY OF CHRISTOPHER PAYNE',
    venue: 'Cooper Hewitt, Smithsonian Design Museum',
    startDate: null,
    endDate: '2026-09-27',
    dateText: 'ON VIEW through sept. 27, 2026',
    description:
      'Made in America brings together more than 70 large-format photographs captured by Christopher Payne over a decade-long photographic journey to learn more about the craft of both industrial and artisanal making in the United States.',
    artists: [],
    curators: [],
    venueAddress: '2 East 91st Street, New York, NY 10128',
    neighborhood: 'Carnegie Hill',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.cooperhewitt.org/wp-content/uploads/2025/05/2015CP20_SD_3-300x228.jpg',
    exhibitionUrl: 'https://www.cooperhewitt.org/channel/made-in-america/',
    sourceUrl: 'https://www.cooperhewitt.org/channel/made-in-america/',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from Cooper Hewitt official current and upcoming exhibition pages using only the visible main exhibition blocks and Learn more links. Sponsor-logo sections, funding acknowledgements after the main exhibition copy, photo-credit blocks, previous/traveling/digital pages, and detail-page enrichment remain out of scope for this first staging-only slice.'
  });
  assert.equal(records[1].title, 'Devon Turnbull: HiFi Pursuit Listening Room Dream No. 3');
  assert.equal(records[1].endDate, '2026-07-19');
  assert.equal(records[1].imageUrl, 'https://www.cooperhewitt.org/wp-content/uploads/2025/12/DevonTurnbull_CH_1-300x225.jpg');
});

test('parseCooperHewittExhibitionsPage keeps the upcoming main block and stops before donor copy', () => {
  const records = parseCooperHewittExhibitionsPage({
    html: upcomingHtml,
    url: 'https://www.cooperhewitt.org/exhibitions/upcoming/'
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    id: 'exhibition:cooper-hewitt:design-across-time',
    type: 'exhibition',
    source: 'cooper-hewitt',
    title: 'Design Across Time: Exploring the Smithsonian’s Design Collection',
    venue: 'Cooper Hewitt, Smithsonian Design Museum',
    startDate: '2026-06-26',
    endDate: null,
    dateText: 'OPENS June 26, 2026',
    description:
      'Occupying the entire first floor of the museum’s Carnegie Mansion, Design Across Time expands public access to Cooper Hewitt’s collection.\n\nDesign Across Time organizes the museum’s vast collection around thematic clusters.',
    artists: [],
    curators: [],
    venueAddress: '2 East 91st Street, New York, NY 10128',
    neighborhood: 'Carnegie Hill',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.cooperhewitt.org/wp-content/uploads/2026/03/WebBanner_2000x1000-DesignAcrossTime-030226-1.jpg',
    exhibitionUrl: 'https://www.cooperhewitt.org/channel/design-across-time/',
    sourceUrl: 'https://www.cooperhewitt.org/channel/design-across-time/',
    openingReceptionDate: null,
    tags: ['upcoming'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from Cooper Hewitt official current and upcoming exhibition pages using only the visible main exhibition blocks and Learn more links. Sponsor-logo sections, funding acknowledgements after the main exhibition copy, photo-credit blocks, previous/traveling/digital pages, and detail-page enrichment remain out of scope for this first staging-only slice.'
  });
});
