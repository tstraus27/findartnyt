import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { buildStagingReport, dedupeScore, diffRecords, findDedupeCandidates, mergeIncomingRecords, summarizeByType } from './ingest.mjs';

const sourceConfig = {
  id: 'test-source-2026-06-22',
  source: 'test-venue',
  parser: 'test-parser',
  sourceType: 'official_venue',
  reliability: 'high',
  stagingNotes: 'Stages official exhibition listings into review-only staging for human approval.',
  pages: [
    {
      url: 'https://example.org/exhibitions'
    }
  ]
};

const existingRecord = {
  id: 'exhibition:test-venue:quiet-rooms-2026',
  type: 'exhibition',
  title: 'Quiet Rooms',
  venue: 'Test Venue',
  startDate: '2026-07-01',
  sourceUrl: 'https://example.org/exhibitions/quiet-rooms'
};

test('diffRecords separates creates, updates, and unchanged records', () => {
  const changedRecord = {
    ...existingRecord,
    endDate: '2026-09-01'
  };
  const newRecord = {
    id: 'exhibition:test-venue:night-work-2026',
    type: 'exhibition',
    title: 'Night Work',
    venue: 'Test Venue',
    startDate: '2026-08-15',
    sourceUrl: 'https://example.org/exhibitions/night-work'
  };

  const diff = diffRecords([existingRecord], [existingRecord, changedRecord, newRecord]);

  assert.deepEqual(diff.unchanged.map((record) => record.id), [existingRecord.id]);
  assert.deepEqual(diff.updates.map((update) => update.after.id), [existingRecord.id]);
  assert.deepEqual(diff.creates.map((record) => record.id), [newRecord.id]);
});

test('buildStagingReport creates pending review items without changing canonical records', () => {
  const generatedAt = '2026-06-22T15:30:00.000Z';
  const changedRecord = {
    ...existingRecord,
    description: 'Updated wall text from the official exhibition page.'
  };
  const newRecord = {
    id: 'exhibition:test-venue:night-work-2026',
    type: 'exhibition',
    title: 'Night Work',
    venue: 'Test Venue',
    startDate: '2026-08-15',
    sourceUrl: 'https://example.org/exhibitions/night-work'
  };

  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [changedRecord, newRecord],
    existingRecords: [existingRecord],
    generatedAt
  });

  assert.equal(report.summary.creates, 1);
  assert.equal(report.summary.updates, 1);
  assert.equal(report.summary.possibleDuplicates, 0);
  assert.equal(report.summary.conflicts, 0);
  assert.deepEqual(report.summary.verification, {
    status: 'unknown',
    verifiedAt: null,
    notes: null
  });
  assert.equal(report.summary.stagingNotes, sourceConfig.stagingNotes);
  assert.deepEqual(report.summary.sourcePages, [
    {
      url: 'https://example.org/exhibitions',
      pageRole: 'configured',
      fetchMode: 'live',
      fixtureFile: null
    }
  ]);
  assert.equal(report.items.length, 2);

  const createItem = report.items.find((item) => item.proposalType === 'create');
  const updateItem = report.items.find((item) => item.proposalType === 'update');

  assert.equal(createItem.reviewStatus, 'pending');
  assert.equal(createItem.canonicalId, null);
  assert.equal(createItem.source.sourceType, 'official_venue');
  assert.equal(createItem.source.reliability, 'high');
  assert.deepEqual(createItem.dedupe, {
    status: 'no_match',
    confidence: 0,
    matchedRecordIds: [],
    notes: 'Compared against existing canonical exhibition records; no likely match found.'
  });

  assert.equal(updateItem.reviewStatus, 'pending');
  assert.equal(updateItem.canonicalId, existingRecord.id);
  assert.deepEqual(updateItem.changedFields, ['description']);
  assert.deepEqual(updateItem.before, existingRecord);
  assert.deepEqual(updateItem.proposed, changedRecord);
  assert.deepEqual(report.creates, [newRecord]);
  assert.deepEqual(report.updates, [{ before: existingRecord, after: changedRecord }]);
});

test('buildStagingReport classifies reviewer-sensitive exhibition changes as conflicts', () => {
  const generatedAt = '2026-06-23T05:45:00.000Z';
  const rescheduledRecord = {
    ...existingRecord,
    startDate: '2026-07-15',
    endDate: '2026-09-15',
    dateText: 'July 15-September 15, 2026'
  };

  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [rescheduledRecord],
    existingRecords: [existingRecord],
    generatedAt
  });

  assert.equal(report.summary.creates, 0);
  assert.equal(report.summary.updates, 0);
  assert.equal(report.summary.possibleDuplicates, 0);
  assert.equal(report.summary.conflicts, 1);
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].proposalType, 'conflict');
  assert.equal(report.items[0].canonicalId, existingRecord.id);
  assert.deepEqual(report.items[0].changedFields, ['dateText', 'endDate', 'startDate']);
  assert.deepEqual(report.items[0].conflict, {
    field: 'multiple_fields',
    canonicalValue: {
      dateText: null,
      endDate: null,
      startDate: '2026-07-01'
    },
    proposedValue: {
      dateText: 'July 15-September 15, 2026',
      endDate: '2026-09-15',
      startDate: '2026-07-15'
    },
    notes:
      'Official source changed reviewer-sensitive exhibition fields: dateText, endDate, startDate. Human review required before canonical data changes.'
  });
});

test('dedupeScore uses normalized URL, title, venue, date, and city signals', () => {
  assert.deepEqual(
    dedupeScore(
      {
        ...existingRecord,
        id: 'exhibition:test-venue:quiet-rooms-copy',
        sourceUrl: 'https://example.org/exhibitions/quiet-rooms/?utm_source=test#tickets'
      },
      {
        ...existingRecord,
        sourceUrl: 'https://example.org/exhibitions/quiet-rooms'
      }
    ),
    {
      confidence: 0.98,
      reasons: ['same normalized source/exhibition URL']
    }
  );

  assert.deepEqual(
    dedupeScore(
      {
        ...existingRecord,
        id: 'exhibition:test-venue:quiet-rooms-copy',
        title: 'Quiet Rooms',
        venue: 'Test Venue',
        startDate: '2026-07-22',
        city: 'New York',
        sourceUrl: 'https://example.org/exhibitions/quiet-rooms-copy'
      },
      {
        ...existingRecord,
        startDate: '2026-07-01',
        city: 'New York'
      }
    ),
    {
      confidence: 0.82,
      reasons: ['same normalized title', 'same normalized venue', 'same start month']
    }
  );
});

test('buildStagingReport stages likely duplicate exhibition candidates for human review', () => {
  const generatedAt = '2026-06-22T15:45:00.000Z';
  const incomingDuplicate = {
    ...existingRecord,
    id: 'exhibition:test-venue:quiet-rooms-relisted',
    sourceUrl: 'https://example.org/exhibitions/quiet-rooms/'
  };

  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: [incomingDuplicate],
    existingRecords: [existingRecord],
    generatedAt
  });

  assert.equal(report.summary.creates, 0);
  assert.equal(report.summary.possibleDuplicates, 1);
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].proposalType, 'possibleDuplicate');
  assert.equal(report.items[0].canonicalId, existingRecord.id);
  assert.deepEqual(report.items[0].before, existingRecord);
  assert.deepEqual(report.items[0].dedupe, {
    status: 'likely_match',
    confidence: 0.98,
    matchedRecordIds: [existingRecord.id],
    notes: `Best match ${existingRecord.id}: same normalized source/exhibition URL. Human review required before merging.`
  });
  assert.deepEqual(report.creates, [incomingDuplicate]);
});

test('findDedupeCandidates filters weak matches and ranks plausible matches', () => {
  const possibleMatch = {
    ...existingRecord,
    id: 'exhibition:test-venue:quiet-rooms-possible',
    sourceUrl: 'https://example.org/exhibitions/quiet-rooms-possible'
  };
  const weakMatch = {
    ...existingRecord,
    id: 'exhibition:test-venue:other',
    title: 'Other',
    sourceUrl: 'https://example.org/exhibitions/other'
  };

  const candidates = findDedupeCandidates(
    {
      ...existingRecord,
      id: 'exhibition:test-venue:quiet-rooms-incoming',
      startDate: '2026-07-22',
      sourceUrl: 'https://example.org/exhibitions/quiet-rooms-incoming'
    },
    [weakMatch, possibleMatch]
  );

  assert.deepEqual(
    candidates.map((candidate) => [candidate.record.id, candidate.score.confidence]),
    [[possibleMatch.id, 0.82]]
  );
});

test('summarizeByType counts incoming record types for staging summaries', () => {
  assert.deepEqual(
    summarizeByType([
      { type: 'exhibition' },
      { type: 'exhibition' },
      { type: 'venue' }
    ]),
    {
      exhibition: 2,
      venue: 1
    }
  );
});

test('buildStagingReport records fixture-backed source page metadata for review audit trails', () => {
  const fixtureSourceConfig = {
    ...sourceConfig,
    pages: [
      {
        url: 'https://example.org/exhibitions',
        file: '../fixtures/example.html'
      }
    ]
  };

  const report = buildStagingReport({
    sourceConfig: fixtureSourceConfig,
    incomingRecords: [existingRecord],
    existingRecords: [],
    sourcePath: path.join(process.cwd(), 'scripts/exhibit-ingest/sources/example.fixture.json'),
    generatedAt: '2026-06-22T21:00:00.000Z'
  });

  assert.deepEqual(report.summary.sourcePages, [
    {
      url: 'https://example.org/exhibitions',
      pageRole: 'configured',
      fetchMode: 'fixture',
      fixtureFile: 'scripts/exhibit-ingest/fixtures/example.html'
    }
  ]);
  assert.deepEqual(report.summary.verification, {
    status: 'unknown',
    verifiedAt: null,
    notes: null
  });
  assert.equal(report.summary.stagingNotes, sourceConfig.stagingNotes);
});

test('mergeIncomingRecords preserves the most complete staged exhibition fields across source pages', () => {
  const merged = mergeIncomingRecords([
    {
      id: 'exhibition:test-venue:quiet-rooms-2026',
      type: 'exhibition',
      title: 'Quiet Rooms',
      venue: 'Test Venue',
      startDate: '2026',
      endDate: null,
      dateText: 'Opens 2026',
      description: null,
      tags: ['upcoming'],
      sourceNotes: 'Parsed from the official index page.'
    },
    {
      id: 'exhibition:test-venue:quiet-rooms-2026',
      type: 'exhibition',
      title: 'Quiet Rooms',
      venue: 'Test Venue',
      startDate: '2026-10-14',
      endDate: '2027-01-11',
      dateText: null,
      description: 'Expanded detail-page description.',
      tags: [],
      sourceNotes: 'Enriched from the official detail page.'
    }
  ]);

  assert.deepEqual(merged, [
    {
      id: 'exhibition:test-venue:quiet-rooms-2026',
      type: 'exhibition',
      title: 'Quiet Rooms',
      venue: 'Test Venue',
      startDate: '2026-10-14',
      endDate: '2027-01-11',
      dateText: 'Opens 2026',
      description: 'Expanded detail-page description.',
      tags: ['upcoming'],
      sourceNotes: 'Parsed from the official index page. Enriched from the official detail page.'
    }
  ]);
});
