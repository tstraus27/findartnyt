import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseGagosianExhibitionsPage } from './gagosian-exhibitions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures');

test('parseGagosianExhibitionsPage keeps one source with explicit NYC venue locations', async () => {
  const currentHtml = await fs.readFile(path.join(fixturesDir, 'gagosian-exhibitions-current.html'), 'utf8');
  const upcomingHtml = await fs.readFile(path.join(fixturesDir, 'gagosian-exhibitions-upcoming.html'), 'utf8');
  const records = [
    ...parseGagosianExhibitionsPage({
      html: currentHtml,
      url: 'https://gagosian.com/exhibitions/'
    }),
    ...parseGagosianExhibitionsPage({
      html: upcomingHtml,
      url: 'https://gagosian.com/exhibitions/upcoming/'
    })
  ];

  assert.equal(records.length, 5);
  assert.ok(records.every((record) => record.source === 'gagosian'));
  assert.ok(records.every((record) => record.city === 'New York'));
  assert.ok(records.every((record) => record.borough === 'Manhattan'));
  assert.ok(records.every((record) => record.venue.startsWith('Gagosian, ')));
  assert.ok(records.every((record) => record.venueAddress?.includes('New York, NY')));
  assert.ok(!records.some((record) => /London|Paris|Beverly Hills/.test(record.venue)));

  const duchamp = records.find((record) => record.title === 'Marcel Duchamp');
  assert.equal(duchamp?.venue, 'Gagosian, 980 Madison at 76th Street');
  assert.equal(duchamp?.venueAddress, '974 Madison Avenue, New York, NY 10075');
  assert.equal(duchamp?.startDate, '2026-04-25');
  assert.equal(duchamp?.endDate, '2026-07-31');

  const park = records.find((record) => record.title === 'Eliza Douglas: GHOSTS');
  assert.equal(park?.venue, 'Gagosian, Park & 75');
  assert.equal(park?.venueAddress, '821 Park Avenue, New York, NY 10021');
  assert.deepEqual(park?.curators, ['Francesco Bonami']);

  const west21 = records.find((record) => record.title === 'Brice Marden: I Am Plane Image');
  assert.equal(west21?.venue, 'Gagosian, 522 West 21st Street');
  assert.equal(west21?.venueAddress, '522 West 21st Street, New York, NY 10011');
  assert.deepEqual(west21?.tags, ['gallery', 'upcoming']);
});
