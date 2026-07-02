import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNewMuseumExhibitionsPage } from './new-museum-exhibitions.mjs';

const nextData = {
  props: {
    pageProps: {
      __TEMPLATE_QUERY_DATA__: {
        page: {
          blocks: [
            {
              exhibitions: [
                {
                  title: 'New Humans: Memories of the Future',
                  startDate: '2026-03-21T04:00:00.000Z',
                  link: 'https://www.newmuseum.org/exhibition/new-humans-memories-of-the-future/',
                  databaseId: 134569,
                  endDate: '',
                  dateTextOverride: 'March 21, 2026-Ongoing',
                  exhibitionType: {
                    nodes: [
                      {
                        name: 'Commission',
                        slug: 'commission'
                      }
                    ]
                  },
                  featuredImage: {
                    node: {
                      sourceUrl: 'https://admin.newmuseum.org/wp-content/uploads/example.jpg'
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    }
  }
};

const html = `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
  nextData
)}</script></body></html>`;

test('parseNewMuseumExhibitionsPage extracts exhibition candidates from Next data', () => {
  const records = parseNewMuseumExhibitionsPage({
    html,
    url: 'https://www.newmuseum.org/exhibitions/'
  });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    id: 'exhibition:new-museum:new-humans-memories-of-the-future',
    type: 'exhibition',
    source: 'new-museum',
    title: 'New Humans: Memories of the Future',
    venue: 'New Museum',
    startDate: '2026-03-21',
    endDate: null,
    dateText: 'March 21, 2026-Ongoing',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '235 Bowery, New York, NY 10002',
    neighborhood: 'Lower East Side',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://admin.newmuseum.org/wp-content/uploads/example.jpg',
    exhibitionUrl: 'https://www.newmuseum.org/exhibition/new-humans-memories-of-the-future/',
    sourceUrl: 'https://www.newmuseum.org/exhibition/new-humans-memories-of-the-future/',
    openingReceptionDate: null,
    tags: ['Commission'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes: 'Parsed from New Museum official exhibitions page embedded Next/Apollo data.'
  });
});

test('parseNewMuseumExhibitionsPage dedupes repeated exhibition ids', () => {
  const duplicated = structuredClone(nextData);
  duplicated.props.pageProps.__TEMPLATE_QUERY_DATA__.page.blocks.push(
    duplicated.props.pageProps.__TEMPLATE_QUERY_DATA__.page.blocks[0]
  );

  const records = parseNewMuseumExhibitionsPage({
    html: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(duplicated)}</script>`,
    url: 'https://www.newmuseum.org/exhibitions/'
  });

  assert.equal(records.length, 1);
});
