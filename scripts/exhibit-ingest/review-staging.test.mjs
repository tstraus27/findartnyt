import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { buildReviewPayload, buildReviewSummary } from './review-staging.mjs';

const stagingPath = path.join(process.cwd(), 'data/staging/david-zwirner-exhibitions.json');
const report = {
    summary: {
      sourceId: 'david-zwirner-exhibitions',
      parser: 'david-zwirner-exhibitions',
      generatedAt: '2026-06-22T19:30:00.000Z',
      stagingNotes: 'Official David Zwirner exhibitions index page only. NYC exhibition listings stay in staging for human review.',
      verification: {
        status: 'pending_live_verification',
        verifiedAt: null,
        notes: 'Fixture-backed offline verification only.'
      },
      sourcePages: [
        {
          url: 'https://www.davidzwirner.com/exhibitions',
        pageRole: 'configured',
        fetchMode: 'fixture',
        fixtureFile: 'scripts/exhibit-ingest/fixtures/david-zwirner-exhibitions.html'
      }
    ],
    creates: 1,
    updates: 1,
    possibleDuplicates: 1,
    conflicts: 1,
    unchanged: 2
  },
  items: [
    {
      id: 'stage:create',
      proposalType: 'create',
      reviewStatus: 'pending',
      canonicalId: null,
      proposed: {
        title: 'New Show',
        venue: 'David Zwirner, New York: 19th Street',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        exhibitionUrl: 'https://example.org/new-show',
        sourceUrl: 'https://example.org/new-show',
        venueAddress: '519 West 19th Street, New York, NY 10011',
        neighborhood: 'Chelsea',
        borough: 'Manhattan',
        city: 'New York',
        description: null,
        imageUrl: null
      },
      changedFields: ['title', 'venue']
    },
    {
      id: 'stage:update',
      proposalType: 'update',
      reviewStatus: 'pending',
      canonicalId: 'exhibition:david-zwirner:old-show',
      proposed: {
        title: 'Old Show',
        venue: 'David Zwirner, New York: 20th Street',
        startDate: '2026-05-01',
        endDate: '2026-06-01',
        exhibitionUrl: 'https://example.org/old-show',
        sourceUrl: 'https://example.org/old-show',
        venueAddress: '537 West 20th Street, New York, NY 10011',
        neighborhood: 'Chelsea',
        borough: 'Manhattan',
        city: 'New York',
        description: 'Updated checklist entry.',
        imageUrl: null
      },
      changedFields: ['endDate']
    },
    {
      id: 'stage:duplicate',
      proposalType: 'possibleDuplicate',
      reviewStatus: 'pending',
      canonicalId: 'exhibition:david-zwirner:similar-show',
      proposed: {
        title: 'Similar Show',
        venue: 'David Zwirner, New York: Tribeca',
        startDate: '2026-06-10',
        endDate: '2026-07-10',
        sourceUrl: 'https://example.org/similar-show',
        exhibitionUrl: 'https://example.org/similar-show',
        venueAddress: '52 Walker Street, New York, NY 10013',
        neighborhood: 'Tribeca',
        borough: 'Manhattan',
        city: 'New York',
        description: null,
        imageUrl: 'https://images.example.org/similar-show.jpg'
      },
      changedFields: ['title'],
      dedupe: {
        status: 'possible_match',
        confidence: 0.82,
        matchedRecordIds: ['exhibition:david-zwirner:similar-show']
      }
    },
    {
      id: 'stage:conflict',
      proposalType: 'conflict',
      reviewStatus: 'pending',
      canonicalId: 'exhibition:david-zwirner:moved-show',
      proposed: {
        title: 'Moved Show',
        venue: 'David Zwirner, New York: Tribeca',
        startDate: '2026-09-01',
        endDate: '2026-10-10',
        sourceUrl: 'https://example.org/moved-show',
        exhibitionUrl: 'https://example.org/moved-show',
        venueAddress: '52 Walker Street, New York, NY 10013',
        neighborhood: 'Tribeca',
        borough: 'Manhattan',
        city: 'New York',
        description: 'Conflicting move notice.',
        imageUrl: null
      },
      changedFields: ['startDate', 'venue'],
      conflict: {
        field: 'multiple_fields',
        canonicalValue: {
          startDate: '2026-08-01',
          venue: 'David Zwirner, New York: 19th Street'
        },
        proposedValue: {
          startDate: '2026-09-01',
          venue: 'David Zwirner, New York: Tribeca'
        },
        notes: 'Official source changed reviewer-sensitive exhibition fields: startDate, venue. Human review required before canonical data changes.'
      }
    }
  ]
};

test('buildReviewSummary groups staged items into reviewer-friendly sections', () => {
  const output = buildReviewSummary(report, stagingPath);

  assert.match(output, /Staging review: data\/staging\/david-zwirner-exhibitions\.json/);
  assert.match(
    output,
    /Scope: Official David Zwirner exhibitions index page only\. NYC exhibition listings stay in staging for human review\./
  );
  assert.match(output, /Readiness: needs_attention/);
  assert.match(output, /Verification: pending_live_verification - Fixture-backed offline verification only\./);
  assert.match(output, /Page coverage: configured=1 followed=0 fixture=1 live=0/);
  assert.match(
    output,
    /Pages: configured\/fixture:https:\/\/www\.davidzwirner\.com\/exhibitions \[scripts\/exhibit-ingest\/fixtures\/david-zwirner-exhibitions\.html\]/
  );
  assert.match(output, /Counts: creates=1 updates=1 possibleDuplicates=1 conflicts=1 unchanged=2/);
  assert.match(output, /Minimum ready: yes/);
  assert.match(output, /Minimum field coverage: title=4\/4, venue=4\/4, startDate=4\/4, sourceUrl=4\/4/);
  assert.match(output, /Minimum field failures: none/);
  assert.match(
    output,
    /Venue counts: David Zwirner, New York: Tribeca=2, David Zwirner, New York: 19th Street=1, David Zwirner, New York: 20th Street=1/
  );
  assert.match(output, /Status tags: n\/a/);
  assert.match(
    output,
    /Field coverage: description=2\/4, imageUrl=1\/4, venueAddress=4\/4, neighborhood=4\/4, borough=4\/4, city=4\/4, exhibitionUrl=4\/4, sourceUrl=4\/4/
  );
  assert.match(output, /Blockers: Source verification is pending_live_verification;/);
  assert.match(output, /Warnings: Recommended field coverage gap: description missing on 2\/4 staged items\./);
  assert.match(output, /Warnings: .*1 staged item\(s\) are marked possible duplicates/);
  assert.match(output, /Warnings: .*1 staged item\(s\) contain reviewer-sensitive conflicts against canonical data/);
  assert.match(
    output,
    /Recommended gap details: description: New Show \[create\] <https:\/\/example\.org\/new-show>; Similar Show \[possibleDuplicate\] <https:\/\/example\.org\/similar-show>/
  );
  assert.match(
    output,
    /Recommended gap details: .*imageUrl: New Show \[create\] <https:\/\/example\.org\/new-show>; Old Show \[update\] <https:\/\/example\.org\/old-show>; Moved Show \[conflict\] <https:\/\/example\.org\/moved-show>/
  );
  assert.match(output, /Next actions: Run the live source staging command in a network-enabled environment\./);
  assert.match(output, /\[create\] 1/);
  assert.match(output, /\[update\] 1/);
  assert.match(output, /\[possibleDuplicate\] 1/);
  assert.match(output, /\[conflict\] 1/);
  assert.match(output, /dedupe=possible_match \(0.82\) vs exhibition:david-zwirner:similar-show/);
  assert.match(output, /canonical=exhibition:david-zwirner:old-show/);
  assert.match(output, /conflict=\{\"field\":\"multiple_fields\"/);
  assert.match(output, /missing=description, imageUrl/);
});

test('buildReviewPayload returns grouped reviewer sections as JSON-safe data', () => {
  const payload = buildReviewPayload(report, stagingPath);

  assert.equal(payload.stagingPath, 'data/staging/david-zwirner-exhibitions.json');
  assert.equal(payload.source.sourceId, 'david-zwirner-exhibitions');
  assert.equal(
    payload.source.stagingNotes,
    'Official David Zwirner exhibitions index page only. NYC exhibition listings stay in staging for human review.'
  );
  assert.deepEqual(payload.source.pageCoverage, {
    configured: 1,
    followed: 0,
    fixture: 1,
    live: 0
  });
  assert.equal(payload.source.pages[0].pageRole, 'configured');
  assert.equal(payload.source.pages[0].fetchMode, 'fixture');
  assert.equal(payload.counts.creates, 1);
  assert.equal(payload.counts.possibleDuplicates, 1);
  assert.equal(payload.counts.conflicts, 1);
  assert.equal(payload.readiness.status, 'needs_attention');
  assert.equal(payload.readiness.verificationStatus, 'pending_live_verification');
  assert.equal(payload.readiness.counts.pendingItems, 4);
  assert.equal(payload.readiness.counts.possibleDuplicates, 1);
  assert.equal(payload.readiness.counts.conflicts, 1);
  assert.match(payload.readiness.blockers[0], /Source verification is pending_live_verification/);
  assert.match(payload.readiness.warnings[0], /description missing on 2\/4 staged items/);
  assert.deepEqual(payload.readiness.minimumFieldCoverage, [
    { field: 'title', populated: 4, total: 4 },
    { field: 'venue', populated: 4, total: 4 },
    { field: 'startDate', populated: 4, total: 4 },
    { field: 'sourceUrl', populated: 4, total: 4 }
  ]);
  assert.deepEqual(payload.readiness.recommendedFieldCoverage, [
    { field: 'description', populated: 2, total: 4 },
    { field: 'imageUrl', populated: 1, total: 4 },
    { field: 'venueAddress', populated: 4, total: 4 },
    { field: 'neighborhood', populated: 4, total: 4 },
    { field: 'borough', populated: 4, total: 4 },
    { field: 'city', populated: 4, total: 4 },
    { field: 'exhibitionUrl', populated: 4, total: 4 },
    { field: 'sourceUrl', populated: 4, total: 4 }
  ]);
  assert.deepEqual(payload.readiness.recommendedGapDetails, [
    {
      field: 'description',
      items: [
        {
          id: 'stage:create',
          title: 'New Show',
          proposalType: 'create',
          sourceUrl: 'https://example.org/new-show'
        },
        {
          id: 'stage:duplicate',
          title: 'Similar Show',
          proposalType: 'possibleDuplicate',
          sourceUrl: 'https://example.org/similar-show'
        }
      ]
    },
    {
      field: 'imageUrl',
      items: [
        {
          id: 'stage:create',
          title: 'New Show',
          proposalType: 'create',
          sourceUrl: 'https://example.org/new-show'
        },
        {
          id: 'stage:update',
          title: 'Old Show',
          proposalType: 'update',
          sourceUrl: 'https://example.org/old-show'
        },
        {
          id: 'stage:conflict',
          title: 'Moved Show',
          proposalType: 'conflict',
          sourceUrl: 'https://example.org/moved-show'
        }
      ]
    }
  ]);
  assert.deepEqual(payload.insights.venues, [
    { venue: 'David Zwirner, New York: Tribeca', count: 2 },
    { venue: 'David Zwirner, New York: 19th Street', count: 1 },
    { venue: 'David Zwirner, New York: 20th Street', count: 1 },
  ]);
  assert.deepEqual(payload.insights.statusTags, []);
  assert.equal(payload.insights.minimumReady, true);
  assert.deepEqual(payload.insights.minimumFieldCoverage, [
    { field: 'title', populated: 4, total: 4 },
    { field: 'venue', populated: 4, total: 4 },
    { field: 'startDate', populated: 4, total: 4 },
    { field: 'sourceUrl', populated: 4, total: 4 }
  ]);
  assert.deepEqual(payload.insights.minimumFailures, []);
  assert.deepEqual(payload.insights.fieldCoverage, [
    { field: 'description', populated: 2, total: 4 },
    { field: 'imageUrl', populated: 1, total: 4 },
    { field: 'venueAddress', populated: 4, total: 4 },
    { field: 'neighborhood', populated: 4, total: 4 },
    { field: 'borough', populated: 4, total: 4 },
    { field: 'city', populated: 4, total: 4 },
    { field: 'exhibitionUrl', populated: 4, total: 4 },
    { field: 'sourceUrl', populated: 4, total: 4 }
  ]);
  assert.equal(payload.sections.create.length, 1);
  assert.equal(payload.sections.update.length, 1);
  assert.equal(payload.sections.possibleDuplicate.length, 1);
  assert.equal(payload.sections.conflict.length, 1);
  assert.equal(payload.sections.possibleDuplicate[0].canonicalId, 'exhibition:david-zwirner:similar-show');
  assert.equal(payload.sections.conflict[0].canonicalId, 'exhibition:david-zwirner:moved-show');
});

test('buildReviewSummary aggregates exhibition status tags from staged proposals', () => {
  const taggedReport = {
    ...report,
    items: report.items.map((item, index) => ({
      ...item,
      proposed: {
        ...item.proposed,
        tags: index === 2 ? ['gallery_exhibition', 'upcoming'] : ['gallery_exhibition', 'current']
      }
    }))
  };

  const output = buildReviewSummary(taggedReport, stagingPath);
  const payload = buildReviewPayload(taggedReport, stagingPath);

  assert.match(output, /Status tags: current=3, upcoming=1/);
  assert.deepEqual(payload.insights.statusTags, [
    { tag: 'current', count: 3 },
    { tag: 'upcoming', count: 1 }
  ]);
});

test('buildReviewSummary flags staged items that miss minimum exhibition fields', () => {
  const incompleteReport = {
    ...report,
    items: [
      {
        ...report.items[0],
        proposed: {
          ...report.items[0].proposed,
          sourceUrl: null
        }
      },
      ...report.items.slice(1)
    ]
  };

  const output = buildReviewSummary(incompleteReport, stagingPath);
  const payload = buildReviewPayload(incompleteReport, stagingPath);

  assert.match(output, /Minimum ready: no/);
  assert.match(output, /Minimum field coverage: title=4\/4, venue=4\/4, startDate=4\/4, sourceUrl=3\/4/);
  assert.match(output, /Minimum field failures: New Show \[create\] missing=sourceUrl/);
  assert.match(output, /minimumMissing=sourceUrl/);
  assert.equal(payload.insights.minimumReady, false);
  assert.deepEqual(payload.insights.minimumFailures, [
    {
      id: 'stage:create',
      title: 'New Show',
      proposalType: 'create',
      missingFields: ['sourceUrl']
    }
  ]);
});
