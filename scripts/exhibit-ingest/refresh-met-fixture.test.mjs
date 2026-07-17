import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFixture } from './refresh-met-fixture.mjs';
import { parseMetExhibitionsPage } from './parsers/met-exhibitions.mjs';

test('buildFixture creates compact Met listing markup that the parser can read', () => {
  const html = buildFixture({
    capturedAt: '2026-07-14T18:00:00.000Z',
    cards: [
      {
        section: 'Featured',
        url: 'https://www.metmuseum.org/exhibitions/example',
        title: 'Example Exhibition',
        dateText: 'Through December 31, 2026',
        imageUrl: 'https://images.metmuseum.org/example.jpg'
      }
    ]
  });

  assert.match(html, /data-captured-at="2026-07-14T18:00:00.000Z"/);
  const records = parseMetExhibitionsPage({ html, url: 'https://www.metmuseum.org/exhibitions' });
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'exhibition:met:example');
  assert.equal(records[0].imageUrl, 'https://images.metmuseum.org/example.jpg');
});
