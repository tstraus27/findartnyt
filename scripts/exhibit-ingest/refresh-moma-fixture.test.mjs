import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMomaExhibitionsPage } from './parsers/moma-exhibitions.mjs';
import { buildFixture } from './refresh-moma-fixture.mjs';

test('buildFixture creates compact MoMA listing markup that the parser can read', () => {
  const html = buildFixture({
    capturedAt: '2026-07-14T18:00:00.000Z',
    cards: [
      {
        url: 'https://www.moma.org/calendar/exhibitions/5906',
        title: 'Architects of Liberation: Modernism in Western Africa',
        dateText: 'Jul 5, 2026-Jan 2, 2027',
        imageUrl: 'https://www.moma.org/example.jpg'
      }
    ]
  });

  assert.match(html, /data-captured-at="2026-07-14T18:00:00.000Z"/);
  const records = parseMomaExhibitionsPage({ html, url: 'https://www.moma.org/calendar/exhibitions' });
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'exhibition:moma:5906');
  assert.equal(records[0].title, 'Architects of Liberation: Modernism in Western Africa');
  assert.equal(records[0].startDate, '2026-07-05');
  assert.equal(records[0].endDate, '2027-01-02');
});
