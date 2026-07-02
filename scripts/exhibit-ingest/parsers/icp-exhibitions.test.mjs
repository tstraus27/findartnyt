import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIcpExhibitionsPage } from './icp-exhibitions.mjs';

const html = `
  <html>
    <body>
      <h1 class="banner-block__title">Current Exhibitions</h1>
      <div class="field__item cards__item">
        <div class="cards__image">
          <a href="/exhibitions/yves-saint-laurent-and-photography" class="cards__anchor"></a>
          <img src="/images/yves.jpg" alt="Yves Saint Laurent and Photography" />
        </div>
        <div class="cards__info card-info-margin">
          <a href="/exhibitions/yves-saint-laurent-and-photography" class="cards__anchor"></a>
          <H1 class="cards__title">Yves Saint Laurent and Photography</H1>
          <div class="field field--name-field-text field--text-paragraph">
            <div class="field__item">June 11, 2026–September 28, 2026</div>
          </div>
          <div class="cards__cta">
            <a href="/exhibitions/yves-saint-laurent-and-photography" class="btn-primary" target="_self">Read More</a>
          </div>
        </div>
      </div>
      <h1 class="text-align-center">Upcoming Exhibitions</h1>
      <div class="field__item cards__item">
        <div class="cards__image">
          <a href="/exhibitions/icp-incubator-space-andrea-hernandez-brice%C3%B1o-fire-becomes-spirit" class="cards__anchor"></a>
          <img src="/images/andrea.jpg" alt="Andrea Hernández Briceño Fire Becomes Spirit" />
        </div>
        <div class="cards__info card-info-margin">
          <a href="/exhibitions/icp-incubator-space-andrea-hernandez-brice%C3%B1o-fire-becomes-spirit" class="cards__anchor"></a>
          <H1 class="cards__title">Andrea Hern&aacute;ndez Brice&ntilde;o: Fire Becomes Spirit</H1>
          <div class="field field--name-field-text field--text-paragraph">
            <div class="field__item">June 24, 2026 - September 13, 2026</div>
          </div>
          <div class="cards__cta">
            <a href="/exhibitions/icp-incubator-space-andrea-hernandez-brice%C3%B1o-fire-becomes-spirit" class="btn-primary" target="_self">Read More</a>
          </div>
        </div>
      </div>
      <h1 class="text-align-center">Past Exhibitions</h1>
      <div class="field__item cards__item">
        <div class="cards__image">
          <a href="/exhibitions/past-show" class="cards__anchor"></a>
          <img src="/images/past.jpg" alt="Past Show" />
        </div>
        <div class="cards__info card-info-margin">
          <a href="/exhibitions/past-show" class="cards__anchor"></a>
          <H1 class="cards__title">Past Show</H1>
          <div class="field field--name-field-text field--text-paragraph">
            <div class="field__item">January 1, 2026 - February 1, 2026</div>
          </div>
          <div class="cards__cta">
            <a href="/exhibitions/past-show" class="btn-primary" target="_self">Read More</a>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

test('parseIcpExhibitionsPage stages current and upcoming ICP exhibitions only', () => {
  const records = parseIcpExhibitionsPage({
    html,
    url: 'https://www.icp.org/exhibitions'
  });

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'exhibition:icp:yves-saint-laurent-and-photography',
    type: 'exhibition',
    source: 'icp',
    title: 'Yves Saint Laurent and Photography',
    venue: 'International Center of Photography',
    startDate: '2026-06-11',
    endDate: '2026-09-28',
    dateText: 'June 11, 2026–September 28, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '84 Ludlow Street, New York, NY 10002',
    neighborhood: 'Lower East Side',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.icp.org/images/yves.jpg',
    exhibitionUrl: 'https://www.icp.org/exhibitions/yves-saint-laurent-and-photography',
    sourceUrl: 'https://www.icp.org/exhibitions/yves-saint-laurent-and-photography',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the official ICP exhibitions index page current and upcoming card sections. Past exhibitions and the separate future-exhibitions landing page remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].id, 'exhibition:icp:icp-incubator-space-andrea-hernandez-briceño-fire-becomes-spirit');
  assert.equal(records[1].title, 'Andrea Hernández Briceño: Fire Becomes Spirit');
  assert.equal(records[1].startDate, '2026-06-24');
  assert.equal(records[1].endDate, '2026-09-13');
  assert.deepEqual(records[1].tags, ['upcoming']);
});

test('parseIcpExhibitionsPage rejects pages without the current exhibitions heading', () => {
  assert.throws(
    () =>
      parseIcpExhibitionsPage({
        html: '<html><body><h1>Exhibitions</h1></body></html>',
        url: 'https://www.icp.org/exhibitions'
      }),
    /No ICP current exhibitions heading found/
  );
});

test('parseIcpExhibitionsPage enriches ICP exhibition detail pages', () => {
  const detailHtml = `
    <link rel="canonical" href="https://www.icp.org/exhibitions/yves-saint-laurent-and-photography" />
    <meta property="og:title" content="Yves Saint Laurent and Photography" />
    <meta property="og:description" content="Fallback ICP exhibition description." />
    <meta property="og:image" content="/images/yves-detail.jpg" />
    <div class="exibition__date section-mb-sm">
      Jun 11, 2026 - Sep 28, 2026
    </div>
    <div class="field field--name-body field--body-block-content">
      <div class="field__item">
        <p>Yves Saint Laurent and Photography explores the dialogue between fashion and photography.</p>
        <p>It traces how the exhibition uses archival objects and photographs together.</p>
        <p><strong>About Yves Saint Laurent</strong></p>
        <p>This biographical section should stay out of the staged exhibition description.</p>
      </div>
    </div>
  `;

  const records = parseIcpExhibitionsPage({
    html: detailHtml,
    url: 'https://www.icp.org/exhibitions/yves-saint-laurent-and-photography'
  });

  assert.deepEqual(records, [
    {
      id: 'exhibition:icp:yves-saint-laurent-and-photography',
      type: 'exhibition',
      source: 'icp',
      title: 'Yves Saint Laurent and Photography',
      venue: 'International Center of Photography',
      startDate: '2026-06-11',
      endDate: '2026-09-28',
      dateText: 'Jun 11, 2026 - Sep 28, 2026',
      description:
        'Yves Saint Laurent and Photography explores the dialogue between fashion and photography.\n\nIt traces how the exhibition uses archival objects and photographs together.',
      artists: [],
      curators: [],
      venueAddress: '84 Ludlow Street, New York, NY 10002',
      neighborhood: 'Lower East Side',
      borough: 'Manhattan',
      city: 'New York',
      imageUrl: 'https://www.icp.org/images/yves-detail.jpg',
      exhibitionUrl: 'https://www.icp.org/exhibitions/yves-saint-laurent-and-photography',
      sourceUrl: 'https://www.icp.org/exhibitions/yves-saint-laurent-and-photography',
      openingReceptionDate: null,
      tags: [],
      sourceConfidence: 'high',
      reviewStatus: 'needs_review',
      lastCheckedAt: null,
      sourceNotes:
        'Enriched from the official ICP exhibition detail page metadata and sidebar date block for optional description/image fields and exact review-facing date text.'
    }
  ]);
});

test('parseIcpExhibitionsPage preserves paragraph spacing and drops header-image captions in detail descriptions', () => {
  const detailHtml = `
    <link rel="canonical" href="https://www.icp.org/exhibitions/icp-incubator-space-andrea-hernandez-brice%C3%B1o-fire-becomes-spirit" />
    <meta property="og:title" content="ICP Incubator Space" />
    <div class="exibition__date section-mb-sm">
      June 24, 2026 - September 13, 2026
    </div>
    <div class="field field--name-body field--body-block-content">
      <div class="field__item">
        <p><strong>ICP’s Incubator is located on ICP’s ground floor.</strong><br><br>Photographer Andrea Hernández Briceño documents the Huöttöja community.</p>
        <p><strong>About The Artist</strong></p>
        <p>Andrea Hernández Briceño is a Venezuelan visual storyteller.</p>
        <p><strong>Header image:</strong> A light shines on the communal home.</p>
      </div>
    </div>
  `;

  const [record] = parseIcpExhibitionsPage({
    html: detailHtml,
    url: 'https://www.icp.org/exhibitions/icp-incubator-space-andrea-hernandez-brice%C3%B1o-fire-becomes-spirit'
  });

  assert.equal(
    record.description,
    'ICP’s Incubator is located on ICP’s ground floor. Photographer Andrea Hernández Briceño documents the Huöttöja community.'
  );
});

test('parseIcpExhibitionsPage stops ICP detail descriptions before featured lists and promotional links', () => {
  const detailHtml = `
    <link rel="canonical" href="https://www.icp.org/exhibitions/photobooks-usa-2000-25" />
    <meta property="og:title" content="Photobooks USA 2000–25" />
    <div class="exibition__date section-mb-sm">
      June 11, 2026 - September 28, 2026
    </div>
    <div class="field field--name-body field--body-block-content">
      <div class="field__item">
        <p><em>Photobooks USA 2000–25</em> explores how the photobook has emerged as a powerful tool for artists to respond to the forces shaping contemporary life in the United States.</p>
        <p>Featuring over 50 photobooks, the exhibition presents a cross section of creators, themes, forms, and subjects.</p>
        <p><em>Curated by ICP’s Creative Director David Campany, Associate Director of Exhibitions Sara Ickow, and Curatorial Assistant malaika newsome.</em></p>
        <p>To see more from <em>Photobooks USA 2000–25</em> visit the online archive.</p>
        <p>Featured Photobooks</p>
        <p>Farah Al Qasimi, <em>Hello Future</em>, 2022 (Capricious)</p>
      </div>
    </div>
  `;

  const [record] = parseIcpExhibitionsPage({
    html: detailHtml,
    url: 'https://www.icp.org/exhibitions/photobooks-usa-2000-25'
  });

  assert.equal(
    record.description,
    'Photobooks USA 2000–25 explores how the photobook has emerged as a powerful tool for artists to respond to the forces shaping contemporary life in the United States.\n\nFeaturing over 50 photobooks, the exhibition presents a cross section of creators, themes, forms, and subjects.\n\nCurated by ICP’s Creative Director David Campany, Associate Director of Exhibitions Sara Ickow, and Curatorial Assistant malaika newsome.'
  );
});
