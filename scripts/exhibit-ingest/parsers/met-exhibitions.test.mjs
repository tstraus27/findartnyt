import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMetExhibitionsPage } from './met-exhibitions.mjs';

const fixturePath = path.resolve(import.meta.dirname, '../fixtures/met-exhibitions.browser-2026-06-29.html');
const pageUrl = 'https://www.metmuseum.org/exhibitions';

test('parseMetExhibitionsPage extracts unique exhibition records from compact browser snapshot', async () => {
  const html = await fs.readFile(fixturePath, 'utf8');
  const records = parseMetExhibitionsPage({ html, url: pageUrl });

  assert.equal(records.length, 23);
  assert.equal(new Set(records.map((record) => record.id)).size, records.length);

  const musicalBodies = records.find((record) => record.id === 'exhibition:met:musical-bodies');
  assert.ok(musicalBodies);
  assert.equal(musicalBodies.title, 'Musical Bodies: Works from The Met Collection 1960-2024');
  assert.equal(musicalBodies.venue, 'The Metropolitan Museum of Art');
  assert.equal(musicalBodies.dateText, 'Through September 27');
  assert.equal(musicalBodies.startDate, null);
  assert.equal(musicalBodies.endDate, '2026-09-27');
  assert.equal(musicalBodies.sourceUrl, 'https://www.metmuseum.org/exhibitions/musical-bodies');
  assert.deepEqual(musicalBodies.tags, ['browser-assisted-snapshot', 'featured']);
  assert.equal(musicalBodies.sourceConfidence, 'medium');

  const georgeHarvey = records.find((record) => record.id === 'exhibition:met:george-harvey');
  assert.ok(georgeHarvey);
  assert.equal(georgeHarvey.startDate, '2026-09-08');
  assert.equal(georgeHarvey.endDate, '2028-03-05');
});

test('parseMetExhibitionsPage extracts seeded official detail pages missing from the listing snapshot', async () => {
  const html = await fs.readFile(
    path.resolve(import.meta.dirname, '../fixtures/met-exhibitions-details/orientalism-between-fact-and-fantasy.html'),
    'utf8'
  );
  const records = parseMetExhibitionsPage({
    html,
    url: 'https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy'
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'exhibition:met:orientalism-between-fact-and-fantasy');
  assert.equal(records[0].title, 'Orientalism: Between Fact and Fantasy');
  assert.equal(records[0].dateText, 'Through February 28, 2027');
  assert.equal(records[0].startDate, null);
  assert.equal(records[0].endDate, '2027-02-28');
  assert.match(records[0].description, /19th-century European and Ottoman images/);
  assert.deepEqual(records[0].tags, ['browser-assisted-snapshot', 'seeded-detail-page']);
  assert.equal(
    records[0].sourceUrl,
    'https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy'
  );
});

test('parseMetExhibitionsPage parses open-ended and seasonal dates', () => {
  const html = `
    <section data-met-section="Upcoming">
      <article>
        <a href="/exhibitions/feather-fashion">
          <h3>Feather Fashion</h3>
          <p class="date">July 25-Ongoing</p>
        </a>
      </article>
      <article>
        <a href="/exhibitions/michael-c-rockefeller-wing">
          <h3>The Michael C. Rockefeller Wing</h3>
          <p class="date">Reopens-Spring 2027</p>
        </a>
      </article>
    </section>
  `;

  const records = parseMetExhibitionsPage({ html, url: pageUrl });

  assert.equal(records[0].startDate, '2026-07-25');
  assert.equal(records[0].endDate, null);
  assert.equal(records[1].startDate, '2027-03');
  assert.equal(records[1].endDate, null);
});
