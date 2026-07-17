import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCanPromote, assertCanReview, stagedItemToExhibitionRow } from '../promotion.mjs';

test('reviewers can review but cannot promote', () => {
  assert.doesNotThrow(() => assertCanReview('reviewer'));
  assert.throws(() => assertCanPromote('reviewer'), /Only admins/);
});

test('admins can review and promote', () => {
  assert.doesNotThrow(() => assertCanReview('admin'));
  assert.doesNotThrow(() => assertCanPromote('admin'));
});

test('visitors cannot review or promote', () => {
  assert.throws(() => assertCanReview('visitor'), /Only reviewers/);
  assert.throws(() => assertCanPromote('visitor'), /Only admins/);
});

test('staged item maps to published exhibition row', () => {
  const row = stagedItemToExhibitionRow({
    id: 'stage:example',
    source: { url: 'https://example.com/fallback' },
    proposed: {
      id: 'exhibition:test',
      title: 'Test Show',
      venue: 'Test Museum',
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      sourceUrl: 'https://example.com/show',
      imageUrl: 'https://example.com/image.jpg'
    }
  });

  assert.equal(row.id, 'exhibition:test');
  assert.equal(row.publication_status, 'published');
  assert.equal(row.review_status, 'approved');
  assert.equal(row.promoted_from_staging_item_id, 'stage:example');
  assert.equal(row.source_url, 'https://example.com/show');
});
