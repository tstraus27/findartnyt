import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMomaExhibitionsPage } from './moma-exhibitions.mjs';

const fixturePath = path.resolve(import.meta.dirname, '../fixtures/moma-exhibitions.browser-2026-06-29.html');
const pageUrl = 'https://www.moma.org/calendar/exhibitions';

test('parseMomaExhibitionsPage extracts unique exhibition records from browser snapshot', async () => {
  const html = await fs.readFile(fixturePath, 'utf8');
  const records = parseMomaExhibitionsPage({ html, url: pageUrl });

  assert.ok(records.length >= 8, 'Expected the browser snapshot to include multiple MoMA exhibition links.');
  assert.equal(new Set(records.map((record) => record.id)).size, records.length);

  const arthurJafa = records.find((record) => record.id === 'exhibition:moma:5825');
  assert.ok(arthurJafa);
  assert.equal(arthurJafa.title, 'Artist’s Choice: Arthur Jafa—Less Is Morbid');
  assert.equal(arthurJafa.dateText, 'Through Jul 5');
  assert.equal(arthurJafa.endDate, '2026-07-05');
  assert.equal(arthurJafa.venue, 'The Museum of Modern Art');
  assert.equal(arthurJafa.sourceUrl, 'https://www.moma.org/calendar/exhibitions/5825');
  assert.equal(arthurJafa.sourceConfidence, 'medium');
  assert.deepEqual(arthurJafa.tags, ['browser-assisted-snapshot']);
});

test('parseMomaExhibitionsPage parses explicit dated ranges when present', () => {
  const html = `
    <section>
      <h2>Upcoming exhibitions</h2>
      <a href="/calendar/exhibitions/5906">
        <h3><p>Architects of Liberation: Modernism in Western Africa</p></h3>
        <p>Member Previews, Jul 2-4</p>
        <p>Jul 5, 2026-Jan 2, 2027</p>
      </a>
    </section>
  `;

  const [record] = parseMomaExhibitionsPage({ html, url: pageUrl });

  assert.equal(record.id, 'exhibition:moma:5906');
  assert.equal(record.title, 'Architects of Liberation: Modernism in Western Africa');
  assert.equal(record.dateText, 'Jul 5, 2026-Jan 2, 2027');
  assert.equal(record.startDate, '2026-07-05');
  assert.equal(record.endDate, '2027-01-02');
});
