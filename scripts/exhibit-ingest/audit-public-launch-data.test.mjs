import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicLaunchReadiness } from './audit-public-launch-data.mjs';

const generatedAt = '2026-07-15T12:00:00.000Z';
const asOf = '2026-07-15';

test('buildPublicLaunchReadiness blocks public launch when canonical records are empty', async () => {
  const report = await buildPublicLaunchReadiness({
    recordsDb: { records: [] },
    stagingReports: [
      {
        file: 'data/staging/met-exhibitions.json',
        pendingItems: 24,
        approvedItems: 0
      }
    ],
    asOf,
    generatedAt
  });

  assert.equal(report.totals.canonicalRecords, 0);
  assert.equal(report.totals.launchReadyRecords, 0);
  assert.equal(report.launchRecommendation.readyForPublicV1, false);
  assert.match(report.launchRecommendation.summary, /Do not launch/);
  assert.equal(report.totals.stagedPendingItems, 24);
});

test('buildPublicLaunchReadiness recommends venues with enough canonical launch-ready records', async () => {
  const records = [
    {
      id: 'exhibition:test-museum:one',
      type: 'exhibition',
      title: 'One',
      venue: 'Test Museum',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      sourceUrl: 'https://example.test/one',
      exhibitionUrl: 'https://example.test/one',
      city: 'New York',
      reviewStatus: 'approved'
    },
    {
      id: 'exhibition:test-museum:two',
      type: 'exhibition',
      title: 'Two',
      venue: 'Test Museum',
      dateText: 'Through December 31, 2026',
      sourceUrl: 'https://example.test/two',
      exhibitionUrl: 'https://example.test/two',
      city: 'New York',
      reviewStatus: 'approved'
    },
    {
      id: 'exhibition:test-museum:three',
      type: 'exhibition',
      title: 'Three',
      venue: 'Test Museum',
      startDate: '2026-03-01',
      sourceUrl: 'https://example.test/three',
      exhibitionUrl: 'https://example.test/three',
      city: 'New York',
      reviewStatus: 'approved'
    },
    {
      id: 'exhibition:test-museum:past',
      type: 'exhibition',
      title: 'Past',
      venue: 'Test Museum',
      startDate: '2025-01-01',
      endDate: '2025-03-01',
      sourceUrl: 'https://example.test/past',
      exhibitionUrl: 'https://example.test/past',
      city: 'New York',
      reviewStatus: 'approved'
    },
    {
      id: 'exhibition:test-museum:missing-url',
      type: 'exhibition',
      title: 'Missing URL',
      venue: 'Test Museum',
      dateText: 'Ongoing',
      city: 'New York',
      reviewStatus: 'approved'
    },
    {
      id: 'exhibition:test-museum:pending',
      type: 'exhibition',
      title: 'Pending',
      venue: 'Test Museum',
      startDate: '2026-03-01',
      sourceUrl: 'https://example.test/pending',
      exhibitionUrl: 'https://example.test/pending',
      city: 'New York',
      reviewStatus: 'needs_review'
    }
  ];

  const report = await buildPublicLaunchReadiness({
    recordsDb: { records },
    stagingReports: [],
    asOf,
    generatedAt
  });

  assert.equal(report.totals.canonicalRecords, 6);
  assert.equal(report.totals.approvedCanonicalExhibitionRecords, 5);
  assert.equal(report.totals.launchReadyRecords, 3);
  assert.equal(report.totals.excludedRecords, 3);
  assert.equal(report.launchRecommendation.readyForPublicV1, true);
  assert.deepEqual(report.launchRecommendation.recommendedFirstPublicVenueSet, ['Test Museum']);
  assert.deepEqual(
    report.excludedRecords.map((record) => record.id),
    ['exhibition:test-museum:past', 'exhibition:test-museum:missing-url', 'exhibition:test-museum:pending']
  );
  assert.deepEqual(
    report.launchReadyRecords.map((record) => record.id),
    ['exhibition:test-museum:one', 'exhibition:test-museum:three', 'exhibition:test-museum:two']
  );
  assert.deepEqual(report.canonicalStatusCoverage, [
    { status: 'approved', count: 5 },
    { status: 'needs_review', count: 1 }
  ]);
});
