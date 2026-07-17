import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseBrooklynMuseumExhibitionsPage } from './brooklyn-museum-exhibitions.mjs';

const fixturePath = path.resolve(import.meta.dirname, '../fixtures/brooklyn-museum-exhibitions.browser-2026-07-14.html');
const pageUrl = 'https://www.brooklynmuseum.org/exhibitions';

test('parseBrooklynMuseumExhibitionsPage extracts compact browser-assisted exhibition cards', async () => {
  const html = await fs.readFile(fixturePath, 'utf8');
  const records = parseBrooklynMuseumExhibitionsPage({ html, url: pageUrl });

  assert.equal(records.length, 8);
  assert.equal(new Set(records.map((record) => record.id)).size, records.length);

  const doors = records.find((record) => record.id === 'exhibition:brooklyn-museum:christian-marclay');
  assert.ok(doors);
  assert.equal(doors.title, 'Christian Marclay: Doors');
  assert.equal(doors.startDate, '2025-06-13');
  assert.equal(doors.endDate, '2026-04-12');
  assert.equal(doors.sourceUrl, 'https://www.brooklynmuseum.org/exhibitions/christian-marclay');
  assert.deepEqual(doors.tags, ['browser-assisted-snapshot', 'included-in-general-admission']);
});
