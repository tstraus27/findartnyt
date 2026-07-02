import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyReviewStatus, listStagingReports } from './review-ui.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

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
