import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGuggenheimExhibitionsPage } from './guggenheim-exhibitions.mjs';

const bootstrap = {
  initial: {
    main: {
      posts: {
        featuredExhibitions: {
          on_view: {
            items: [
              {
                slug: 'carol-bove',
                title: 'Carol Bove',
                excerpt: "A survey of Carol Bove's practice.",
                featuredImage: {
                  sourceUrl: '/images/carol-bove.jpg'
                },
                dates: {
                  start: { month: 'March', day: '5', year: '2026' },
                  end: { month: 'August', day: '2', year: '2026' },
                  label: ''
                }
              },
              {
                slug: 'collection-in-focus-zidane-a-21st-century-portrait',
                title: 'Collection in Focus | Zidane, a 21st century portrait',
                excerpt: 'A focused presentation.',
                featuredImage: {
                  sourceUrl: 'https://images.example.org/zidane.jpg'
                },
                dates: {
                  start: { month: 'June', day: '11', year: '2026' },
                  end: { month: 'July', day: '19', year: '2026' },
                  label: 'On view now'
                }
              }
            ]
          },
          upcoming: {
            items: [
              {
                slug: 'taryn-simon',
                title: 'Taryn Simon',
                excerpt: 'An interactive installation.',
                featuredImage: {
                  sourceUrl: '/images/taryn-simon.jpg'
                },
                dates: {
                  start: { month: 'September', day: '18', year: '2026' },
                  end: { month: 'March', day: '14', year: '2027' },
                  label: ''
                }
              }
            ]
          },
          past: {
            items: [
              {
                slug: 'ignore-past',
                title: 'Ignore Past'
              }
            ]
          }
        }
      }
    }
  }
};

const html = `
  <script>
    const bootstrap = ${JSON.stringify(bootstrap)}; const footerNav = {};
  </script>
`;

test('parseGuggenheimExhibitionsPage extracts on-view and upcoming exhibition items from bootstrap data', () => {
  const records = parseGuggenheimExhibitionsPage({
    html,
    url: 'https://www.guggenheim.org/exhibitions'
  });

  assert.equal(records.length, 3);
  assert.deepEqual(records[0], {
    id: 'exhibition:guggenheim:carol-bove',
    type: 'exhibition',
    source: 'guggenheim',
    title: 'Carol Bove',
    venue: 'Solomon R. Guggenheim Museum',
    startDate: '2026-03-05',
    endDate: '2026-08-02',
    dateText: null,
    description: "A survey of Carol Bove's practice.",
    artists: [],
    curators: [],
    venueAddress: '1071 5th Avenue, New York, NY 10128',
    neighborhood: 'Upper East Side',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://www.guggenheim.org/images/carol-bove.jpg',
    exhibitionUrl: 'https://www.guggenheim.org/exhibition/carol-bove',
    sourceUrl: 'https://www.guggenheim.org/exhibition/carol-bove',
    openingReceptionDate: null,
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Guggenheim official exhibitions page bootstrap payload. Stages only the embedded on_view and upcoming exhibition items from the index page; past items and any detail-page enrichment remain out of scope for this first staging-only slice.'
  });

  assert.equal(records[1].dateText, 'On view now');
  assert.deepEqual(records[1].tags, ['current']);
  assert.equal(records[2].title, 'Taryn Simon');
  assert.equal(records[2].startDate, '2026-09-18');
  assert.equal(records[2].endDate, '2027-03-14');
  assert.deepEqual(records[2].tags, ['upcoming']);
});

test('parseGuggenheimExhibitionsPage dedupes repeated items by slug and ignores past items', () => {
  const duplicatedBootstrap = structuredClone(bootstrap);
  duplicatedBootstrap.initial.main.posts.featuredExhibitions.on_view.items.unshift({
    slug: 'carol-bove',
    title: 'Carol Bove',
    excerpt: 'Duplicate.',
    featuredImage: {
      sourceUrl: '/images/duplicate.jpg'
    },
    dates: {
      start: { month: 'March', day: '5', year: '2026' },
      end: { month: 'August', day: '2', year: '2026' },
      label: ''
    }
  });
  const duplicatedHtml = `<script>const bootstrap = ${JSON.stringify(duplicatedBootstrap)}; const footerNav = {};</script>`;

  const records = parseGuggenheimExhibitionsPage({
    html: duplicatedHtml,
    url: 'https://www.guggenheim.org/exhibitions'
  });

  assert.equal(records.length, 3);
  assert.ok(records.every((record) => record.id !== 'exhibition:guggenheim:ignore-past'));
});
