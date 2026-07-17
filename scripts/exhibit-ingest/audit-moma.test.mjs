import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { auditBrowserFixtureSource, capturedAtFromHtml, normalizeUrl } from './audit-browser-fixture-source.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');

test('normalizeUrl compares MoMA URLs without query strings, hashes, or trailing slashes', () => {
  assert.equal(
    normalizeUrl('https://www.moma.org/calendar/exhibitions/5906/?utm_source=x#tickets'),
    'https://www.moma.org/calendar/exhibitions/5906'
  );
});

test('capturedAtFromHtml reads MoMA fixture dates from title text when data attributes are absent', () => {
  assert.equal(
    capturedAtFromHtml('<title>MoMA browser-assisted exhibition snapshot 2026-06-29</title>').toISOString(),
    '2026-06-29T00:00:00.000Z'
  );
});

test('MoMA staging covers every active required seed URL', async () => {
  const report = await auditBrowserFixtureSource({
    label: 'MoMA',
    listingUrl: 'https://www.moma.org/calendar/exhibitions',
    stagingPath: path.join(projectRoot, 'data/staging/moma-exhibitions.json'),
    sourcePath: path.join(projectRoot, 'scripts/exhibit-ingest/sources/moma-exhibitions.fixture.json'),
    registryPath: path.join(projectRoot, 'scripts/exhibit-ingest/sources/moma-required-exhibitions.json'),
    allowStale: true
  });

  assert.equal(report.seedCoverage.active, 2);
  assert.equal(report.seedCoverage.present, 2);
  assert.deepEqual(report.seedCoverage.missing, []);
  assert.equal(report.incomingRecords >= report.minimumExpectedRecords, true);
});
