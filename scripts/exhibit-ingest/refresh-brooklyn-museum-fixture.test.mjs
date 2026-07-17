import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBrooklynMuseumExhibitionsPage } from './parsers/brooklyn-museum-exhibitions.mjs';
import { buildFixture } from './refresh-brooklyn-museum-fixture.mjs';

test('buildFixture creates compact Brooklyn Museum listing markup that the parser can read', () => {
  const html = buildFixture({
    capturedAt: '2026-07-14T18:15:00.000Z',
    cards: [
      {
        url: 'https://www.brooklynmuseum.org/exhibitions/christian-marclay',
        title: 'Christian Marclay: Doors',
        dateText: 'June 13, 2025–April 12, 2026'
      }
    ]
  });

  const records = parseBrooklynMuseumExhibitionsPage({ html, url: 'https://www.brooklynmuseum.org/exhibitions' });
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'exhibition:brooklyn-museum:christian-marclay');
  assert.equal(records[0].startDate, '2025-06-13');
  assert.equal(records[0].endDate, '2026-04-12');
});
