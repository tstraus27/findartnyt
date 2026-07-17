import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildStagingReport, stableJson } from './ingest.mjs';
import { pruneClosedStagingFile, pruneClosedStagingReport } from './prune-closed-staging.mjs';

const sourceConfig = {
  id: 'closed-staging-test',
  source: 'closed-staging-test',
  parser: 'closed-staging-test-parser',
  sourceType: 'official_venue',
  reliability: 'high',
  pages: [
    {
      url: 'https://example.org/exhibitions'
    }
  ]
};

const exhibition = (id, title, endDate) => ({
  id,
  type: 'exhibition',
  title,
  venue: 'Lifecycle Test Museum',
  startDate: '2026-01-01',
  endDate,
  dateText: endDate ? `Through ${endDate}` : 'Ongoing',
  sourceUrl: `https://example.org/exhibitions/${id}`,
  exhibitionUrl: `https://example.org/exhibitions/${id}`,
  reviewStatus: 'needs_review'
});

test('pruneClosedStagingReport removes only reviewable items that ended before the as-of date', () => {
  const closedPending = exhibition('exhibition:test:closed-pending', 'Closed Pending', '2026-07-14');
  const closesToday = exhibition('exhibition:test:today', 'Still Open Today', '2026-07-15');
  const noEndDate = exhibition('exhibition:test:ongoing', 'Ongoing', null);
  const closedApproved = exhibition('exhibition:test:closed-approved', 'Closed Approved', '2026-07-01');
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [closedPending, closesToday, noEndDate, closedApproved],
    existingRecords: [],
    generatedAt: '2026-07-15T12:00:00.000Z'
  });
  report.items[3].reviewStatus = 'approved';

  const result = pruneClosedStagingReport(report, { asOfDate: '2026-07-15' });

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.removedItems.map((item) => item.proposed.id),
    [closedPending.id]
  );
  assert.deepEqual(
    result.report.items.map((item) => item.proposed.id),
    [closesToday.id, noEndDate.id, closedApproved.id]
  );
  assert.equal(result.report.summary.creates, 3);
  assert.equal(result.report.summary.incomingRecords, 3);
  assert.equal(result.report.summary.incomingByType.exhibition, 3);
  assert.deepEqual(
    result.report.creates.map((record) => record.id),
    [closesToday.id, noEndDate.id, closedApproved.id]
  );
});

test('pruneClosedStagingFile supports dry runs without writing changes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'closed-staging-'));
  const stagingFile = path.join(dir, 'staging.json');
  const closedPending = exhibition('exhibition:test:closed-pending', 'Closed Pending', '2026-07-14');
  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [closedPending],
    existingRecords: [],
    generatedAt: '2026-07-15T12:00:00.000Z'
  });

  await fs.writeFile(stagingFile, stableJson(report));

  const dryRun = await pruneClosedStagingFile({
    stagingFile,
    asOfDate: '2026-07-15',
    dryRun: true
  });
  const afterDryRun = JSON.parse(await fs.readFile(stagingFile, 'utf8'));

  assert.equal(dryRun.removedItems.length, 1);
  assert.equal(afterDryRun.items.length, 1);

  const applied = await pruneClosedStagingFile({
    stagingFile,
    asOfDate: '2026-07-15'
  });
  const afterApply = JSON.parse(await fs.readFile(stagingFile, 'utf8'));

  assert.equal(applied.removedItems.length, 1);
  assert.equal(afterApply.items.length, 0);
  assert.equal(afterApply.summary.creates, 0);
});
