import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildApprovalPlan } from './approve-staging.mjs';
import { stableJson } from './ingest.mjs';
import { buildStagingReport } from './ingest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const approvalScript = path.join(__dirname, 'approve-staging.mjs');
const execFile = promisify(execFileCallback);

const sourceConfig = {
  id: 'approval-test-source',
  source: 'approval-test',
  parser: 'approval-test-parser',
  sourceType: 'official_venue',
  reliability: 'high',
  pages: [
    {
      url: 'https://example.org/exhibitions'
    }
  ]
};

const exhibition = {
  id: 'exhibition:approval-test:sample',
  type: 'exhibition',
  title: 'Sample Exhibition',
  venue: 'Approval Test Venue',
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

test('buildApprovalPlan promotes approved staging creates into canonical exhibitions', async () => {
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-06-22T16:15:00.000Z'
  });
  report.items[0].reviewStatus = 'approved';

  const plan = await buildApprovalPlan({
    stagingReport: report,
    recordsDb: { records: [] },
    approvedAt: '2026-06-22T16:30:00.000Z'
  });

  assert.equal(plan.approvedCreates, 1);
  assert.equal(plan.promoted.length, 1);
  assert.equal(plan.records.length, 1);
  assert.equal(plan.promoted[0].reviewStatus, 'approved');
  assert.equal(plan.promoted[0].createdAt, '2026-06-22T16:30:00.000Z');
  assert.equal(plan.promoted[0].updatedAt, '2026-06-22T16:30:00.000Z');
  assert.deepEqual(plan.promoted[0].sources, [
    {
      url: 'https://example.org/exhibitions/sample',
      sourceType: 'official_venue',
      reliability: 'high',
      claimFields: [
        'title',
        'venue',
        'startDate',
        'endDate',
        'description',
        'artists',
        'curators',
        'venueAddress',
        'neighborhood',
        'borough',
        'city',
        'imageUrl',
        'exhibitionUrl',
        'sourceUrl',
        'openingReceptionDate',
        'tags',
        'sourceConfidence'
      ],
      checkedAt: '2026-06-22T16:15:00.000Z',
      notes: null
    }
  ]);
  assert.equal(plan.promoted[0].changeHistory[0].changeType, 'created');
});

test('buildApprovalPlan skips pending creates and possible duplicates', async () => {
  const existing = {
    ...exhibition,
    reviewStatus: 'approved',
    sources: [
      {
        url: exhibition.sourceUrl,
        sourceType: 'official_venue',
        reliability: 'high',
        claimFields: ['title', 'venue', 'startDate', 'sourceUrl'],
        checkedAt: '2026-06-22T16:00:00.000Z',
        notes: null
      }
    ],
    changeHistory: [],
    createdAt: '2026-06-22T16:00:00.000Z',
    updatedAt: '2026-06-22T16:00:00.000Z'
  };
  const duplicate = {
    ...exhibition,
    id: 'exhibition:approval-test:sample-relisted'
  };
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [duplicate],
    existingRecords: [existing],
    generatedAt: '2026-06-22T16:15:00.000Z'
  });
  report.items[0].reviewStatus = 'approved';

  const plan = await buildApprovalPlan({
    stagingReport: report,
    recordsDb: { records: [existing] },
    approvedAt: '2026-06-22T16:30:00.000Z'
  });

  assert.equal(report.items[0].proposalType, 'possibleDuplicate');
  assert.equal(plan.approvedCreates, 0);
  assert.equal(plan.promoted.length, 0);
  assert.equal(plan.records.length, 1);
});

test('buildApprovalPlan promotes approved creates with end-date-only official date signals', async () => {
  const endDateOnlyExhibition = {
    ...exhibition,
    id: 'exhibition:approval-test:end-date-only',
    startDate: null,
    endDate: '2026-09-12',
    dateText: 'Through September 12, 2026',
    sourceUrl: 'https://example.org/exhibitions/end-date-only',
    exhibitionUrl: 'https://example.org/exhibitions/end-date-only'
  };
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [endDateOnlyExhibition],
    existingRecords: [],
    generatedAt: '2026-06-22T16:20:00.000Z'
  });
  report.items[0].reviewStatus = 'approved';

  const plan = await buildApprovalPlan({
    stagingReport: report,
    recordsDb: { records: [] },
    approvedAt: '2026-06-22T16:30:00.000Z'
  });

  assert.equal(plan.approvedCreates, 1);
  assert.equal(plan.promoted.length, 1);
  assert.equal(plan.skipped.length, 0);
  assert.equal(plan.records.length, 1);
  assert.equal(plan.promoted[0].startDate, null);
  assert.equal(plan.promoted[0].endDate, '2026-09-12');
  assert.equal(plan.promoted[0].dateText, 'Through September 12, 2026');
});

test('buildApprovalPlan skips approved creates that have no publishable date signal', async () => {
  const datelessExhibition = {
    ...exhibition,
    id: 'exhibition:approval-test:dateless',
    startDate: null,
    endDate: null,
    sourceUrl: 'https://example.org/exhibitions/dateless',
    exhibitionUrl: 'https://example.org/exhibitions/dateless'
  };
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [datelessExhibition],
    existingRecords: [],
    generatedAt: '2026-06-22T16:20:00.000Z'
  });
  report.items[0].reviewStatus = 'approved';

  const plan = await buildApprovalPlan({
    stagingReport: report,
    recordsDb: { records: [] },
    approvedAt: '2026-06-22T16:30:00.000Z'
  });

  assert.equal(plan.approvedCreates, 1);
  assert.equal(plan.promoted.length, 0);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.records.length, 0);
  assert.match(plan.skipped[0].reason, /must match a schema in anyOf/);
});

test('approve-staging CLI dry run reports promotions without writing canonical records', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approve-staging-dry-run-'));
  const stagingPath = path.join(tempDir, 'staging.json');
  const recordsPath = path.join(tempDir, 'records.json');

  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-06-22T19:00:00.000Z'
  });
  report.items[0].reviewStatus = 'approved';

  await fs.writeFile(stagingPath, stableJson(report));
  await fs.writeFile(recordsPath, stableJson({ records: [] }));

  const { stdout } = await execFile(process.execPath, [approvalScript, '--staging', stagingPath, '--records', recordsPath], {
    cwd: path.resolve(__dirname, '../..')
  });

  const summary = JSON.parse(stdout);
  const recordsAfter = JSON.parse(await fs.readFile(recordsPath, 'utf8'));

  assert.equal(summary.mode, 'dry-run');
  assert.equal(summary.approvedCreates, 1);
  assert.equal(summary.promoted, 1);
  assert.deepEqual(recordsAfter, { records: [] });
});

test('approve-staging CLI apply writes approved creates into the target canonical file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approve-staging-apply-'));
  const stagingPath = path.join(tempDir, 'staging.json');
  const recordsPath = path.join(tempDir, 'records.json');

  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [exhibition],
    existingRecords: [],
    generatedAt: '2026-06-22T19:05:00.000Z'
  });
  report.items[0].reviewStatus = 'approved';

  await fs.writeFile(stagingPath, stableJson(report));
  await fs.writeFile(recordsPath, stableJson({ records: [] }));

  const { stdout } = await execFile(
    process.execPath,
    [approvalScript, '--staging', stagingPath, '--records', recordsPath, '--apply'],
    {
      cwd: path.resolve(__dirname, '../..')
    }
  );

  const summary = JSON.parse(stdout);
  const recordsAfter = JSON.parse(await fs.readFile(recordsPath, 'utf8'));

  assert.equal(summary.mode, 'apply');
  assert.equal(summary.approvedCreates, 1);
  assert.equal(summary.promoted, 1);
  assert.equal(recordsAfter.records.length, 1);
  assert.equal(recordsAfter.records[0].id, exhibition.id);
  assert.equal(recordsAfter.records[0].reviewStatus, 'approved');
  assert.equal(recordsAfter.records[0].sources[0].url, exhibition.sourceUrl);
});
