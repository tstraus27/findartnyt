import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { buildComparisonSummary, compareStagingReports } from './compare-staging.mjs';
import { buildStagingReport, stableJson } from './ingest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compareScript = path.join(__dirname, 'compare-staging.mjs');
const ingestScript = path.join(__dirname, 'ingest.mjs');
const execFile = promisify(execFileCallback);

const sourceConfig = {
  id: 'compare-test-source',
  source: 'compare-test',
  parser: 'compare-test-parser',
  sourceType: 'official_venue',
  reliability: 'high',
  pages: [
    {
      url: 'https://example.org/exhibitions'
    }
  ]
};

const baseRecord = {
  id: 'exhibition:compare-test:quiet-rooms',
  type: 'exhibition',
  title: 'Quiet Rooms',
  venue: 'Compare Test Venue',
  startDate: '2026-07-01',
  sourceUrl: 'https://example.org/exhibitions/quiet-rooms'
};

test('compareStagingReports detects added, removed, and changed staged items without volatile timestamp noise', () => {
  const baseline = buildStagingReport({
    sourceConfig,
    incomingRecords: [baseRecord],
    existingRecords: [],
    generatedAt: '2026-06-22T18:00:00.000Z'
  });
  const candidate = buildStagingReport({
    sourceConfig,
    incomingRecords: [
      {
        ...baseRecord,
        title: 'Quiet Rooms Revised'
      },
      {
        ...baseRecord,
        id: 'exhibition:compare-test:new-show',
        title: 'New Show',
        sourceUrl: 'https://example.org/exhibitions/new-show'
      }
    ],
    existingRecords: [],
    generatedAt: '2026-06-22T19:00:00.000Z'
  });

  baseline.summary.verification = {
    status: 'pending_live_verification',
    verifiedAt: null,
    notes: 'Fixture-backed offline verification only.'
  };
  candidate.summary.verification = {
    status: 'verified_live',
    verifiedAt: '2026-06-23T04:15:00.000Z',
    notes: 'Live source comparison matched the fixture-backed sample.'
  };
  baseline.summary.sourcePages = [
    {
      url: 'https://example.org/exhibitions',
      pageRole: 'configured',
      fetchMode: 'fixture',
      fixtureFile: 'scripts/exhibit-ingest/fixtures/example.html'
    }
  ];
  candidate.summary.sourcePages = [
    {
      url: 'https://example.org/exhibitions',
      pageRole: 'configured',
      fetchMode: 'live',
      fixtureFile: null
    }
  ];

  const comparison = compareStagingReports(baseline, candidate);

  assert.deepEqual(comparison.added, ['exhibition:compare-test:new-show']);
  assert.deepEqual(comparison.removed, []);
  assert.equal(comparison.counts.changed, 1);
  assert.equal(comparison.counts.unchanged, 0);
  assert.deepEqual(comparison.changed[0], {
    recordId: 'exhibition:compare-test:quiet-rooms',
    differences: ['proposed.title']
  });
  assert.deepEqual(comparison.baseline.verification, {
    status: 'pending_live_verification',
    verifiedAt: null,
    notes: 'Fixture-backed offline verification only.'
  });
  assert.deepEqual(comparison.candidate.verification, {
    status: 'verified_live',
    verifiedAt: '2026-06-23T04:15:00.000Z',
    notes: 'Live source comparison matched the fixture-backed sample.'
  });
  assert.equal(comparison.baseline.sourcePages[0].fetchMode, 'fixture');
  assert.equal(comparison.candidate.sourcePages[0].fetchMode, 'live');
});

test('compare-staging CLI emits machine-readable comparison output', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compare-staging-'));
  const baselinePath = path.join(tempDir, 'baseline.json');
  const candidatePath = path.join(tempDir, 'candidate.json');

  const baseline = buildStagingReport({
    sourceConfig,
    incomingRecords: [baseRecord],
    existingRecords: [],
    generatedAt: '2026-06-22T18:00:00.000Z'
  });
  const candidate = buildStagingReport({
    sourceConfig,
    incomingRecords: [
      {
        ...baseRecord,
        description: 'Now with wall text.'
      }
    ],
    existingRecords: [],
    generatedAt: '2026-06-22T18:30:00.000Z'
  });

  await fs.writeFile(baselinePath, stableJson(baseline));
  await fs.writeFile(candidatePath, stableJson(candidate));

  const { stdout } = await execFile(process.execPath, [compareScript, '--baseline', baselinePath, '--candidate', candidatePath, '--json'], {
    cwd: path.resolve(__dirname, '../..')
  });

  const comparison = JSON.parse(stdout);
  assert.equal(comparison.counts.changed, 1);
  assert.equal(comparison.changed[0].recordId, baseRecord.id);
  assert.ok(comparison.changed[0].differences.includes('proposed.description'));
  assert.equal(comparison.baseline.verification.status, 'unknown');
  assert.equal(comparison.candidate.verification.status, 'unknown');
});

test('buildComparisonSummary prints verification metadata changes alongside record diffs', () => {
  const baseline = buildStagingReport({
    sourceConfig,
    incomingRecords: [baseRecord],
    existingRecords: [],
    generatedAt: '2026-06-22T18:00:00.000Z'
  });
  const candidate = buildStagingReport({
    sourceConfig,
    incomingRecords: [baseRecord],
    existingRecords: [],
    generatedAt: '2026-06-22T18:30:00.000Z'
  });

  baseline.summary.verification = {
    status: 'pending_live_verification',
    verifiedAt: null,
    notes: 'Fixture-backed offline verification only.'
  };
  candidate.summary.verification = {
    status: 'verified_live',
    verifiedAt: '2026-06-23T04:15:00.000Z',
    notes: 'Live source comparison matched the fixture-backed sample.'
  };

  const comparison = compareStagingReports(baseline, candidate);
  comparison.baseline.stagingPath = 'data/staging/david-zwirner-exhibitions.json';
  comparison.candidate.stagingPath = 'data/staging/david-zwirner-exhibitions.live.json';

  const summary = buildComparisonSummary(comparison);

  assert.match(
    summary,
    /Verification: pending_live_verification - Fixture-backed offline verification only\. -> verified_live at 2026-06-23T04:15:00\.000Z - Live source comparison matched the fixture-backed sample\./
  );
  assert.match(summary, /Verification changed: yes/);
});

test('ingest CLI supports custom staging output paths for source verification runs', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ingest-output-'));
  const sourcePath = path.join(tempDir, 'source.json');
  const recordsPath = path.join(tempDir, 'records.json');
  const outputPath = path.join(tempDir, 'nested', 'staging-output.json');

  await fs.writeFile(
    sourcePath,
    stableJson({
      id: 'david-zwirner-exhibitions',
      source: 'david-zwirner',
      parser: 'david-zwirner-exhibitions',
      sourceType: 'official_venue',
      reliability: 'high',
      pages: [
        {
          url: 'https://www.davidzwirner.com/exhibitions',
          file: path.join(__dirname, 'fixtures/david-zwirner-exhibitions.html')
        }
      ]
    })
  );
  await fs.writeFile(recordsPath, stableJson({ records: [] }));

  await execFile(
    process.execPath,
    [ingestScript, '--source', sourcePath, '--records', recordsPath, '--stage', '--output', outputPath],
    {
      cwd: path.resolve(__dirname, '../..')
    }
  );

  const written = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  assert.equal(written.summary.sourceId, 'david-zwirner-exhibitions');
  assert.equal(written.items.length, 6);
  assert.equal(written.summary.sourcePages[0].pageRole, 'configured');
  assert.equal(written.summary.sourcePages[0].fetchMode, 'fixture');
});
