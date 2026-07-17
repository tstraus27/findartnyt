import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildStagingReport, stableJson } from './ingest.mjs';
import { applyReviewDecision, applyReviewStatus, listStagingReports, previewFallbackReason } from './review-ui.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const sourceConfig = {
  id: 'review-ui-approval-test-source',
  source: 'review-ui-approval-test',
  parser: 'review-ui-approval-test-parser',
  sourceType: 'official_venue',
  reliability: 'high',
  pages: [
    {
      url: 'https://example.org/exhibitions'
    }
  ]
};

const metSourceConfig = {
  ...sourceConfig,
  id: 'met-exhibitions',
  source: 'met',
  parser: 'met-exhibitions',
  reliability: 'medium'
};

const exhibition = {
  id: 'exhibition:review-ui-approval-test:sample',
  type: 'exhibition',
  title: 'Review UI Sample Exhibition',
  venue: 'Review UI Test Venue',
  startDate: '2026-07-01',
  endDate: null,
  description: null,
  artists: [],
  curators: [],
  venueAddress: '1 Example Street, New York, NY',
  neighborhood: 'Example',
  borough: 'Manhattan',
  city: 'New York',
  imageUrl: null,
  exhibitionUrl: 'https://example.org/exhibitions/sample',
  sourceUrl: 'https://example.org/exhibitions/sample',
  openingReceptionDate: null,
  tags: ['Test'],
  sourceConfidence: 'high',
  reviewStatus: 'needs_review',
  lastCheckedAt: null
};

test('applyReviewStatus updates the staged item and proposed review status', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-'));
  const stagingFile = path.join(dir, 'staging.json');
  const fixture = JSON.parse(
    await fs.readFile(path.join(projectRoot, 'data/staging/poster-house-exhibitions.json'), 'utf8')
  );
  await fs.writeFile(stagingFile, JSON.stringify(fixture, null, 2));
  const itemId = fixture.items[0].id;

  await applyReviewStatus({
    stagingFile,
    itemId,
    status: 'approved'
  });

  const updated = JSON.parse(await fs.readFile(stagingFile, 'utf8'));
  assert.equal(updated.items[0].reviewStatus, 'approved');
  assert.equal(updated.items[0].proposed.reviewStatus, 'approved');
});

test('previewFallbackReason only flags fetched verification pages', () => {
  assert.equal(previewFallbackReason({ status: 200, html: '<h1>Orientalism: Between Fact and Fantasy</h1>' }), null);
  assert.match(
    previewFallbackReason({ status: 200, html: '<h1>Failed to verify your browser</h1><p>Code 99</p>' }),
    /browser verification/
  );
  assert.match(previewFallbackReason({ status: 429, html: '<p>Please verify your browser.</p>' }), /blocked/);
});

test('applyReviewDecision promotes approved creates into canonical records', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-promote-'));
  const stagingFile = path.join(dir, 'staging.json');
  const recordsFile = path.join(dir, 'records.json');
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-07-15T18:00:00.000Z'
  });
  const itemId = report.items[0].id;

  await fs.writeFile(stagingFile, stableJson(report));
  await fs.writeFile(recordsFile, stableJson({ records: [] }));

  const { promotion } = await applyReviewDecision({
    stagingFile,
    recordsFile,
    itemId,
    status: 'approved'
  });

  const updatedStaging = JSON.parse(await fs.readFile(stagingFile, 'utf8'));
  const updatedRecords = JSON.parse(await fs.readFile(recordsFile, 'utf8'));

  assert.equal(promotion.promoted, 1);
  assert.equal(updatedStaging.items[0].reviewStatus, 'approved');
  assert.equal(updatedRecords.records.length, 1);
  assert.equal(updatedRecords.records[0].id, exhibition.id);
  assert.equal(updatedRecords.records[0].reviewStatus, 'approved');
});

test('applyReviewDecision promotes only the clicked approved item', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-promote-one-'));
  const stagingFile = path.join(dir, 'staging.json');
  const recordsFile = path.join(dir, 'records.json');
  const secondExhibition = {
    ...exhibition,
    id: 'exhibition:review-ui-approval-test:already-approved',
    title: 'Already Approved But Not Clicked',
    exhibitionUrl: 'https://example.org/exhibitions/already-approved',
    sourceUrl: 'https://example.org/exhibitions/already-approved'
  };
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [exhibition, secondExhibition],
    existingRecords: [],
    generatedAt: '2026-07-15T18:05:00.000Z'
  });
  report.items[1].reviewStatus = 'approved';
  report.items[1].proposed.reviewStatus = 'approved';

  await fs.writeFile(stagingFile, stableJson(report));
  await fs.writeFile(recordsFile, stableJson({ records: [] }));

  const { promotion } = await applyReviewDecision({
    stagingFile,
    recordsFile,
    itemId: report.items[0].id,
    status: 'approved'
  });

  const updatedRecords = JSON.parse(await fs.readFile(recordsFile, 'utf8'));

  assert.equal(promotion.promoted, 1);
  assert.deepEqual(
    updatedRecords.records.map((record) => record.id),
    [exhibition.id]
  );
});

test('applyReviewDecision promotes end-date-only canonical creates and moves on', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-end-date-only-'));
  const stagingFile = path.join(dir, 'staging.json');
  const recordsFile = path.join(dir, 'records.json');
  const endDateOnlyExhibition = {
    ...exhibition,
    id: 'exhibition:review-ui-approval-test:end-date-only',
    title: 'End Date Only',
    startDate: null,
    endDate: '2026-09-12',
    dateText: 'Through September 12, 2026',
    exhibitionUrl: 'https://example.org/exhibitions/end-date-only',
    sourceUrl: 'https://example.org/exhibitions/end-date-only'
  };
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [endDateOnlyExhibition],
    existingRecords: [],
    generatedAt: '2026-07-15T18:08:00.000Z'
  });

  await fs.writeFile(stagingFile, stableJson(report));
  await fs.writeFile(recordsFile, stableJson({ records: [] }));

  const { promotion } = await applyReviewDecision({
    stagingFile,
    recordsFile,
    itemId: report.items[0].id,
    status: 'approved'
  });

  const updatedStaging = JSON.parse(await fs.readFile(stagingFile, 'utf8'));
  const updatedRecords = JSON.parse(await fs.readFile(recordsFile, 'utf8'));

  assert.equal(promotion.promoted, 1);
  assert.equal(promotion.skipped, 0);
  assert.equal(updatedStaging.items[0].reviewStatus, 'approved');
  assert.equal(updatedStaging.items[0].proposed.reviewStatus, 'approved');
  assert.equal(updatedRecords.records.length, 1);
  assert.equal(updatedRecords.records[0].startDate, null);
  assert.equal(updatedRecords.records[0].endDate, '2026-09-12');
  assert.equal(updatedRecords.records[0].dateText, 'Through September 12, 2026');
});

test('applyReviewDecision marks dateless canonical creates as needs revision instead of throwing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-dateless-canonical-'));
  const stagingFile = path.join(dir, 'staging.json');
  const recordsFile = path.join(dir, 'records.json');
  const datelessExhibition = {
    ...exhibition,
    id: 'exhibition:review-ui-approval-test:dateless',
    title: 'Dateless',
    startDate: null,
    endDate: null,
    exhibitionUrl: 'https://example.org/exhibitions/dateless',
    sourceUrl: 'https://example.org/exhibitions/dateless'
  };
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [datelessExhibition],
    existingRecords: [],
    generatedAt: '2026-07-15T18:08:00.000Z'
  });

  await fs.writeFile(stagingFile, stableJson(report));
  await fs.writeFile(recordsFile, stableJson({ records: [] }));

  const { promotion } = await applyReviewDecision({
    stagingFile,
    recordsFile,
    itemId: report.items[0].id,
    status: 'approved'
  });

  const updatedStaging = JSON.parse(await fs.readFile(stagingFile, 'utf8'));
  const updatedRecords = JSON.parse(await fs.readFile(recordsFile, 'utf8'));

  assert.equal(promotion.promoted, 0);
  assert.equal(promotion.skipped, 1);
  assert.match(promotion.skippedDetails[0].reason, /must match a schema in anyOf/);
  assert.equal(updatedStaging.items[0].reviewStatus, 'needs_revision');
  assert.equal(updatedStaging.items[0].proposed.reviewStatus, 'needs_review');
  assert.deepEqual(updatedRecords.records, []);
});

test('applyReviewDecision blocks Met approval when the source audit fails', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-met-blocked-'));
  const stagingFile = path.join(dir, 'staging.json');
  const recordsFile = path.join(dir, 'records.json');
  const report = buildStagingReport({
    sourceConfig: metSourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-07-15T18:10:00.000Z'
  });

  await fs.writeFile(stagingFile, stableJson(report));
  await fs.writeFile(recordsFile, stableJson({ records: [] }));

  await assert.rejects(
    applyReviewDecision({
      stagingFile,
      recordsFile,
      itemId: report.items[0].id,
      status: 'approved',
      sourceAudits: {
        'met-exhibitions': async () => ({
          ok: false,
          label: 'Met',
          problems: ['Missing required Met seed URLs: https://www.metmuseum.org/exhibitions/example'],
          warnings: []
        })
      }
    }),
    /Met approval blocked: source audit failed/
  );

  const updatedStaging = JSON.parse(await fs.readFile(stagingFile, 'utf8'));
  const updatedRecords = JSON.parse(await fs.readFile(recordsFile, 'utf8'));

  assert.equal(updatedStaging.items[0].reviewStatus, 'pending');
  assert.deepEqual(updatedRecords.records, []);
});

test('applyReviewDecision allows Met approval when the source audit passes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-ui-met-allowed-'));
  const stagingFile = path.join(dir, 'staging.json');
  const recordsFile = path.join(dir, 'records.json');
  const report = buildStagingReport({
    sourceConfig: metSourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-07-15T18:15:00.000Z'
  });

  await fs.writeFile(stagingFile, stableJson(report));
  await fs.writeFile(recordsFile, stableJson({ records: [] }));

  const { promotion } = await applyReviewDecision({
    stagingFile,
    recordsFile,
    itemId: report.items[0].id,
    status: 'approved',
    sourceAudits: {
      'met-exhibitions': async () => ({
        ok: true,
        label: 'Met',
        problems: [],
        warnings: []
      })
    }
  });

  const updatedRecords = JSON.parse(await fs.readFile(recordsFile, 'utf8'));

  assert.equal(promotion.promoted, 1);
  assert.equal(updatedRecords.records.length, 1);
  assert.equal(updatedRecords.records[0].id, exhibition.id);
});

test('listStagingReports summarizes datasets that need review', async () => {
  const reports = await listStagingReports({
    selectedFile: path.join(projectRoot, 'data/staging/poster-house-exhibitions.json')
  });
  const posterHouse = reports.find((report) => report.source === 'poster-house-exhibitions');

  assert.ok(posterHouse);
  assert.equal(posterHouse.selected, true);
  assert.equal(posterHouse.pending > 0, true);
  assert.equal(posterHouse.total >= posterHouse.pending, true);
  assert.equal(reports.some((report) => report.source.endsWith('.live')), false);
});

test('listStagingReports skips non-exhibition source reports', async () => {
  const reports = await listStagingReports({
    selectedFile: path.join(projectRoot, 'data/staging/poster-house-exhibitions.json')
  });

  assert.equal(
    reports.some((report) => report.source === 'margot-nielsen-2026-06-16-david-zwirner-artists'),
    false
  );
});
