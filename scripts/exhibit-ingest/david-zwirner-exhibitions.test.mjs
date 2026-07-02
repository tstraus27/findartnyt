import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readSourcePage } from './ingest.mjs';
import { parseDavidZwirnerExhibitionsPage } from './parsers/david-zwirner-exhibitions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixturePath = path.join(__dirname, 'fixtures/david-zwirner-exhibitions.html');
const fixtureUrl = 'https://www.davidzwirner.com/exhibitions';

test('readSourcePage loads fixture-backed source pages without network access', async () => {
  const page = await readSourcePage(
    {
      url: fixtureUrl,
      file: './fixtures/david-zwirner-exhibitions.html'
    },
    __dirname
  );

  assert.equal(page.url, fixtureUrl);
  assert.match(page.html, /Exhibitions \| David Zwirner/);
});

test('parseDavidZwirnerExhibitionsPage stages NYC exhibition listings from the official index', async () => {
  const html = await fs.readFile(fixturePath, 'utf8');
  const records = parseDavidZwirnerExhibitionsPage({ html, url: fixtureUrl });

  assert.equal(records.length, 6);
  assert.deepEqual(
    records.map((record) => record.id),
    [
      'exhibition:david-zwirner:lisa-yuskavage',
      'exhibition:david-zwirner:set-in-stone',
      'exhibition:david-zwirner:statics-of-an-egg',
      'exhibition:david-zwirner:gerhard-richter-landschaften',
      'exhibition:david-zwirner:jasper-johns-copy-trace',
      'exhibition:david-zwirner:in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services'
    ]
  );

  const upcoming = records.at(-1);
  assert.deepEqual(upcoming, {
    id: 'exhibition:david-zwirner:in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services',
    type: 'exhibition',
    source: 'david-zwirner',
    title: 'In Solidarity A Benefit for the American Immigration Council and Journey’s End Refugee Services',
    venue: 'David Zwirner, New York: 19th Street',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    dateText: 'July 1—31, 2026',
    description: null,
    artists: [],
    curators: [],
    venueAddress: '519, 525 & 533 West 19th Street, New York, NY 10011',
    neighborhood: 'Chelsea',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: 'https://cdn.sanity.io/images/juzvn5an/release-adp/04fc9b5d7dac8ddd38629b6c218dcc4956a1d231-3000x1688.jpg',
    exhibitionUrl:
      'https://www.davidzwirner.com/exhibitions/2026/in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services',
    sourceUrl:
      'https://www.davidzwirner.com/exhibitions/2026/in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services',
    openingReceptionDate: null,
    tags: ['gallery_exhibition', 'upcoming', 'New York: 19th Street'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes: 'Parsed from the official David Zwirner exhibitions index page for NYC gallery listings.'
  });

  assert.equal(records[0].description, null);
  assert.equal(
    records[0].imageUrl,
    'https://cdn.sanity.io/images/juzvn5an/release-adp/9449021d0f7e43c54012a1e626fc205293bfb3d8-3000x1688.jpg'
  );
  assert.equal(records[1].description, null);
  assert.equal(
    records[1].imageUrl,
    'https://cdn.sanity.io/images/juzvn5an/release-adp/148e2c445d2e9383adf76314ad792b1ed7f46229-3000x1688.jpg'
  );
  assert.equal(records[3].title, 'Gerhard Richter Landschaften');
  assert.equal(records[4].title, 'Jasper Johns Copy/Trace');
  assert.ok(records.every((record) => record.city === 'New York'));
  assert.ok(records.every((record) => record.venue.startsWith('David Zwirner, New York: ')));
});
