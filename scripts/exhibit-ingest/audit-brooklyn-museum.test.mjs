import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { auditBrowserFixtureSource } from './audit-browser-fixture-source.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');

test('Brooklyn Museum staging covers every active required seed URL', async () => {
  const report = await auditBrowserFixtureSource({
    label: 'Brooklyn Museum',
    listingUrl: 'https://www.brooklynmuseum.org/exhibitions',
    stagingPath: path.join(projectRoot, 'data/staging/brooklyn-museum-exhibitions.json'),
    sourcePath: path.join(projectRoot, 'scripts/exhibit-ingest/sources/brooklyn-museum-exhibitions.fixture.json'),
    registryPath: path.join(projectRoot, 'scripts/exhibit-ingest/sources/brooklyn-museum-required-exhibitions.json'),
    allowStale: true
  });

  assert.equal(report.seedCoverage.active, 2);
  assert.equal(report.seedCoverage.present, 2);
  assert.deepEqual(report.seedCoverage.missing, []);
  assert.equal(report.incomingRecords >= report.minimumExpectedRecords, true);
});
