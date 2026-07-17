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

  assert.equal(records.length, 5);
  assert.deepEqual(
    records.map((record) => record.id),
    [
      'exhibition:david-zwirner:in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services',
      'exhibition:david-zwirner:scott-kahn',
      'exhibition:david-zwirner:nate-lowman',
      'exhibition:david-zwirner:thomas-ruff-jpegs-ny',
      'exhibition:david-zwirner:emma-mcintyre'
    ]
  );

  const current = records[0];
  assert.deepEqual(current, {
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
    imageUrl: 'https://cdn.sanity.io/images/juzvn5an/release-adp/545d1b1e4cb36813db607cd4288adb01980ef9fb-3000x1688.jpg',
    exhibitionUrl:
      'https://www.davidzwirner.com/exhibitions/2026/in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services',
    sourceUrl:
      'https://www.davidzwirner.com/exhibitions/2026/in-solidarity-a-benefit-for-the-american-immigration-council-and-journey-s-end-refugee-services',
    openingReceptionDate: null,
    tags: ['gallery_exhibition', 'current', 'New York: 19th Street'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes: 'Parsed from the official David Zwirner exhibitions index page for NYC gallery listings.'
  });

  const upcoming = records.slice(1);
  assert.equal(upcoming.length, 4);
  assert.ok(upcoming.every((record) => record.tags.includes('upcoming')));
  assert.deepEqual(
    upcoming.map((record) => [record.title, record.startDate, record.endDate, record.venue]),
    [
      ['Scott Kahn', '2026-09-10', null, 'David Zwirner, New York: 20th Street'],
      ['Nate Lowman', '2026-09-10', null, 'David Zwirner, New York: 19th Street'],
      ['Thomas Ruff jpegs ny', '2026-09-10', null, 'David Zwirner, New York: 19th Street'],
      ['Emma McIntyre', '2026-09-18', null, 'David Zwirner, New York: Tribeca']
    ]
  );
  assert.equal(records[1].dateText, 'Opening September 10, 2026');
  assert.equal(records[4].dateText, 'Opening September 18, 2026');
  assert.ok(records.every((record) => record.city === 'New York'));
  assert.ok(records.every((record) => record.venue.startsWith('David Zwirner, New York: ')));
});

test('parseDavidZwirnerExhibitionsPage captures future NYC listings with opening-only dates', () => {
  const html = `
    <a href="/exhibitions/2026/scott-kahn">
      Scott Kahn
      New York: 20th Street
      Opening September 10, 2026
      Learn More
    </a>
    <a href="/exhibitions/2026/nate-lowman">
      Nate Lowman
      New York: 19th Street
      Opening September 10, 2026
      Learn More
    </a>
    <a href="/exhibitions/2026/louis-fratino">
      Louis Fratino
      London
      Opening September 18, 2026
      Learn More
    </a>
  `;

  const records = parseDavidZwirnerExhibitionsPage({ html, url: fixtureUrl });

  assert.deepEqual(
    records.map((record) => record.id),
    ['exhibition:david-zwirner:scott-kahn', 'exhibition:david-zwirner:nate-lowman']
  );
  assert.equal(records[0].startDate, '2026-09-10');
  assert.equal(records[0].endDate, null);
  assert.equal(records[0].dateText, 'Opening September 10, 2026');
  assert.deepEqual(records[0].tags, ['gallery_exhibition', 'upcoming', 'New York: 20th Street']);
});
