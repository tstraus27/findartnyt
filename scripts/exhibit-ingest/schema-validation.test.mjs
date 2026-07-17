import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildStagingReport } from './ingest.mjs';
import { validateSourceConfig, validateStagingReport } from './schema-validation.mjs';

const sourceConfig = {
  id: 'schema-test-source',
  source: 'schema-test',
  parser: 'schema-test-parser',
  sourceType: 'official_venue',
  reliability: 'high',
  pages: [
    {
      url: 'https://example.org/exhibitions'
    }
  ]
};

const exhibition = {
  id: 'exhibition:schema-test:sample',
  type: 'exhibition',
  title: 'Sample Exhibition',
  venue: 'Schema Test Venue',
  startDate: '2026-07-01',
  sourceUrl: 'https://example.org/exhibitions/sample'
};

test('validateStagingReport accepts generated staging reports', async () => {
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-06-22T16:00:00.000Z'
  });

  await assert.doesNotReject(() => validateStagingReport(report));
});

test('validateStagingReport rejects malformed staging reports', async () => {
  await assert.rejects(
    () =>
      validateStagingReport({
        summary: {
          sourceId: 'schema-test-source',
          sourcePages: []
        },
        items: [
          {
            proposalType: 'create'
          }
        ]
      }),
    /Staging report failed schema validation/
  );
});

test('validateSourceConfig accepts official exhibition configs', async () => {
  const baseDir = path.resolve('scripts/exhibit-ingest/sources');
  const sourceFiles = [
    'bronx-museum-exhibitions.fixture.json',
    'bronx-museum-exhibitions.json',
    'cooper-hewitt-exhibitions.fixture.json',
    'cooper-hewitt-exhibitions.json',
    'david-zwirner-exhibitions.fixture.json',
    'david-zwirner-exhibitions.json',
    'drawing-center-exhibitions.fixture.json',
    'drawing-center-exhibitions.json',
    'fit-exhibitions.fixture.json',
    'fit-exhibitions.json',
    'frick-exhibitions.fixture.json',
    'frick-exhibitions.json',
    'guggenheim-exhibitions.fixture.json',
    'guggenheim-exhibitions.json',
    'icp-exhibitions.fixture.json',
    'icp-exhibitions.json',
    'jewish-museum-exhibitions.fixture.json',
    'jewish-museum-exhibitions.json',
    'mad-exhibitions.fixture.json',
    'mad-exhibitions.json',
    'mcny-exhibitions.fixture.json',
    'mcny-exhibitions.json',
    'morgan-exhibitions.fixture.json',
    'morgan-exhibitions.json',
    'new-museum-exhibitions.json',
    'noguchi-exhibitions.fixture.json',
    'noguchi-exhibitions.json',
    'whitney-exhibitions.fixture.json',
    'whitney-exhibitions.json'
  ];

  for (const file of sourceFiles) {
    const sourceConfig = JSON.parse(await fs.readFile(path.join(baseDir, file), 'utf8'));
    await assert.doesNotReject(() => validateSourceConfig(sourceConfig));
  }
});

test('validateSourceConfig rejects malformed source configs before staging runs', async () => {
  await assert.rejects(
    () =>
      validateSourceConfig({
        id: 'broken-source',
        source: 'broken-gallery',
        parser: 'david-zwirner-exhibitions',
        verification: {
          status: 'almost_verified',
          verifiedAt: null,
          notes: 'This should fail.'
        },
        pages: []
      }),
    /Source config broken-source failed schema validation/
  );
});

test('validateSourceConfig rejects fixture-backed followed-page sources without a fixture directory', async () => {
  await assert.rejects(
    () =>
      validateSourceConfig({
        id: 'broken-followed-fixture-source',
        source: 'broken-gallery',
        parser: 'icp-exhibitions',
        pages: [
          {
            url: 'https://example.org/exhibitions',
            file: '../fixtures/example-exhibitions.html',
            followRecordUrls: true
          }
        ]
      }),
    /followRecordUrlFixtureDirectory/
  );
});
