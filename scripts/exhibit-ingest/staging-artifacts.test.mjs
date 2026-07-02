import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateStagingReport } from './schema-validation.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const stagingDir = path.join(projectRoot, 'data/staging');

test('checked-in exhibition staging artifacts remain schema-valid', async () => {
  const files = (await fs.readdir(stagingDir))
    .filter((file) => file.endsWith('.json'))
    .filter((file) => !file.includes('artists'))
    .sort();

  assert.ok(files.length > 0, 'Expected checked-in exhibition staging artifacts to exist.');

  for (const file of files) {
    const stagingPath = path.join(stagingDir, file);
    const report = JSON.parse(await fs.readFile(stagingPath, 'utf8'));

    await assert.doesNotReject(
      () => validateStagingReport(report),
      `Expected ${path.relative(projectRoot, stagingPath)} to satisfy the active staging schema.`
    );
  }
});
