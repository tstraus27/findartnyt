import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { stableJson } from './ingest.mjs';
import { applyVerificationToStagingReport, assessLiveVerification } from './verify-source-live.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const verifyScript = path.join(__dirname, 'verify-source-live.mjs');
const execFile = promisify(execFileCallback);

const baseRecord = {
  id: 'exhibition:david-zwirner:test-show',
  type: 'exhibition',
  title: 'Test Show',
  venue: 'David Zwirner, New York: 19th Street',
  startDate: '2026-05-14',
  endDate: '2026-06-26',
  sourceUrl: 'https://www.davidzwirner.com/exhibitions/2026/test-show',
  exhibitionUrl: 'https://www.davidzwirner.com/exhibitions/2026/test-show',
  city: 'New York'
};

const buildReport = ({ fetchMode, generatedAt = '2026-06-23T13:10:02.495Z', title = baseRecord.title }) => ({
  summary: {
    sourceId: 'david-zwirner-exhibitions',
    source: 'david-zwirner',
    parser: 'david-zwirner-exhibitions',
    generatedAt,
    verification: {
      status: fetchMode === 'live' ? 'pending_live_verification' : 'pending_live_verification',
      verifiedAt: null,
      notes: 'Pending live verification.'
    },
    pagesFetched: 1,
    sourcePages: [
      {
        url: 'https://www.davidzwirner.com/exhibitions',
        pageRole: 'configured',
        fetchMode,
        fixtureFile: fetchMode === 'fixture' ? 'scripts/exhibit-ingest/fixtures/david-zwirner-exhibitions.html' : null
      }
    ],
    incomingRecords: 1,
    creates: 1,
    updates: 0,
    possibleDuplicates: 0,
    conflicts: 0,
    unchanged: 0,
    incomingByType: {
      exhibition: 1
    }
  },
  items: [
    {
      id: 'stage:david-zwirner-exhibitions:exhibition:david-zwirner:test-show:create',
      proposalType: 'create',
      reviewStatus: 'pending',
      source: {
        url: baseRecord.sourceUrl,
        sourceType: 'official_venue',
        reliability: 'high',
        parser: 'david-zwirner-exhibitions',
        notes: 'Official source.'
      },
      canonicalId: null,
      before: null,
      proposed: {
        ...baseRecord,
        title
      },
      changedFields: Object.keys(baseRecord).sort(),
      dedupe: {
        status: 'no_match',
        confidence: 0,
        matchedRecordIds: [],
        notes: 'No likely match found.'
      },
      conflict: null,
      extractedAt: generatedAt,
      reviewerNotes: null
    }
  ],
  creates: [
    {
      ...baseRecord,
      title
    }
  ],
  updates: [],
  unchangedIds: []
});

const sourceConfig = {
  id: 'david-zwirner-exhibitions',
  source: 'david-zwirner',
  sourceType: 'official_venue',
  reliability: 'high',
  parser: 'david-zwirner-exhibitions',
  verification: {
    status: 'pending_live_verification',
    verifiedAt: null,
    notes: 'Waiting for live verification.'
  },
  pages: [
    {
      url: 'https://www.davidzwirner.com/exhibitions'
    }
  ]
};

test('assessLiveVerification marks matching live-vs-fixture artifacts eligible', () => {
  const assessment = assessLiveVerification({
    baselineReport: buildReport({ fetchMode: 'fixture' }),
    candidateReport: buildReport({ fetchMode: 'live' }),
    sourceConfig,
    baselinePath: '/tmp/david-zwirner-exhibitions.json',
    candidatePath: '/tmp/david-zwirner-exhibitions.live.json',
    verifiedAt: '2026-06-23T15:00:00.000Z'
  });

  assert.equal(assessment.eligible, true);
  assert.deepEqual(assessment.blockers, []);
  assert.equal(assessment.comparison.counts.changed, 0);
  assert.equal(assessment.proposedVerification.status, 'verified_live');
  assert.equal(assessment.proposedVerification.verifiedAt, '2026-06-23T15:00:00.000Z');
});

test('assessLiveVerification blocks verification when live artifact changes staged records', () => {
  const assessment = assessLiveVerification({
    baselineReport: buildReport({ fetchMode: 'fixture' }),
    candidateReport: buildReport({ fetchMode: 'live', title: 'Test Show Revised' }),
    sourceConfig,
    baselinePath: '/tmp/david-zwirner-exhibitions.json',
    candidatePath: '/tmp/david-zwirner-exhibitions.live.json',
    verifiedAt: '2026-06-23T15:00:00.000Z'
  });

  assert.equal(assessment.eligible, false);
  assert.match(assessment.blockers[0], /Live comparison changed staged records/);
});

test('verify-source-live CLI applies verification metadata to live and fixture source configs', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-source-live-'));
  const baselinePath = path.join(tempDir, 'baseline.json');
  const candidatePath = path.join(tempDir, 'candidate.json');
  const sourceConfigPath = path.join(tempDir, 'david-zwirner-exhibitions.json');
  const fixtureSourceConfigPath = path.join(tempDir, 'david-zwirner-exhibitions.fixture.json');

  await fs.writeFile(baselinePath, stableJson(buildReport({ fetchMode: 'fixture' })));
  await fs.writeFile(candidatePath, stableJson(buildReport({ fetchMode: 'live' })));
  await fs.writeFile(sourceConfigPath, stableJson(sourceConfig));
  await fs.writeFile(
    fixtureSourceConfigPath,
    stableJson({
      ...sourceConfig,
      stagingNotes: 'Fixture-backed verification config.',
      pages: [
        {
          url: 'https://www.davidzwirner.com/exhibitions',
          file: '../fixtures/david-zwirner-exhibitions.html'
        }
      ]
    })
  );

  const { stdout } = await execFile(
    process.execPath,
    [
      verifyScript,
      '--baseline',
      baselinePath,
      '--candidate',
      candidatePath,
      '--source-config',
      sourceConfigPath,
      '--fixture-source-config',
      fixtureSourceConfigPath,
      '--verified-at',
      '2026-06-23T15:00:00.000Z',
      '--apply',
      '--json'
    ],
    {
      cwd: path.resolve(__dirname, '../..')
    }
  );

  const result = JSON.parse(stdout);
  assert.equal(result.eligible, true);
  assert.equal(result.applied, true);
  assert.deepEqual(result.updatedConfigs.sort(), [
    path.relative(path.resolve(__dirname, '../..'), fixtureSourceConfigPath),
    path.relative(path.resolve(__dirname, '../..'), sourceConfigPath)
  ]);

  const updatedSourceConfig = JSON.parse(await fs.readFile(sourceConfigPath, 'utf8'));
  const updatedFixtureSourceConfig = JSON.parse(await fs.readFile(fixtureSourceConfigPath, 'utf8'));
  assert.equal(updatedSourceConfig.verification.status, 'verified_live');
  assert.equal(updatedFixtureSourceConfig.verification.status, 'verified_live');
  assert.equal(updatedSourceConfig.verification.verifiedAt, '2026-06-23T15:00:00.000Z');
});

test('applyVerificationToStagingReport refreshes fixture-backed review metadata after verification', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-source-live-staging-'));
  const stagingPath = path.join(tempDir, 'icp-exhibitions.json');
  const verification = {
    status: 'verified_live',
    verifiedAt: '2026-06-24T02:20:00.000Z',
    notes: 'Live staging artifact matched the fixture-backed review artifact for icp-exhibitions.'
  };

  const report = buildReport({ fetchMode: 'fixture' });
  report.summary.sourceId = 'icp-exhibitions';
  report.summary.source = 'icp';
  report.summary.parser = 'icp-exhibitions';
  report.summary.verification = {
    status: 'pending_live_verification',
    verifiedAt: null,
    notes: 'Fixture-backed ICP current/upcoming exhibition staging has parser coverage, but the live-vs-fixture comparison has not been applied yet.'
  };

  await fs.writeFile(stagingPath, stableJson(report));

  const updatedPath = await applyVerificationToStagingReport({
    stagingPath,
    report,
    verification
  });

  assert.equal(updatedPath, path.relative(path.resolve(__dirname, '../..'), stagingPath));

  const updatedReport = JSON.parse(await fs.readFile(stagingPath, 'utf8'));
  assert.deepEqual(updatedReport.summary.verification, verification);
  assert.equal(updatedReport.items[0].reviewStatus, 'pending');
});

test('verify-source-live CLI can refresh the baseline staging report on apply', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-source-live-refresh-'));
  const baselinePath = path.join(tempDir, 'baseline.json');
  const candidatePath = path.join(tempDir, 'candidate.json');
  const sourceConfigPath = path.join(tempDir, 'icp-exhibitions.json');

  const baselineReport = buildReport({ fetchMode: 'fixture' });
  baselineReport.summary.sourceId = 'icp-exhibitions';
  baselineReport.summary.source = 'icp';
  baselineReport.summary.parser = 'icp-exhibitions';
  baselineReport.summary.verification = {
    status: 'pending_live_verification',
    verifiedAt: null,
    notes: 'Fixture-backed ICP current/upcoming exhibition staging has parser coverage, but the live-vs-fixture comparison has not been applied yet.'
  };

  const candidateReport = buildReport({ fetchMode: 'live' });
  candidateReport.summary.sourceId = 'icp-exhibitions';
  candidateReport.summary.source = 'icp';
  candidateReport.summary.parser = 'icp-exhibitions';

  const icpSourceConfig = {
    ...sourceConfig,
    id: 'icp-exhibitions',
    source: 'icp',
    parser: 'icp-exhibitions',
    pages: [
      {
        url: 'https://www.icp.org/exhibitions'
      }
    ]
  };

  await fs.writeFile(baselinePath, stableJson(baselineReport));
  await fs.writeFile(candidatePath, stableJson(candidateReport));
  await fs.writeFile(sourceConfigPath, stableJson(icpSourceConfig));

  const { stdout } = await execFile(
    process.execPath,
    [
      verifyScript,
      '--baseline',
      baselinePath,
      '--candidate',
      candidatePath,
      '--source-config',
      sourceConfigPath,
      '--verified-at',
      '2026-06-24T02:20:00.000Z',
      '--apply',
      '--refresh-baseline-staging',
      '--json'
    ],
    {
      cwd: path.resolve(__dirname, '../..')
    }
  );

  const result = JSON.parse(stdout);
  assert.equal(result.eligible, true);
  assert.equal(result.applied, true);
  assert.deepEqual(result.updatedStagingReports, [
    path.relative(path.resolve(__dirname, '../..'), baselinePath)
  ]);

  const updatedReport = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
  assert.equal(updatedReport.summary.verification.status, 'verified_live');
  assert.equal(updatedReport.summary.verification.verifiedAt, '2026-06-24T02:20:00.000Z');
});
