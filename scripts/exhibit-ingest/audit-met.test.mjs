import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { audit, capturedAtFromHtml, normalizeUrl } from './audit-met.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../..');

test('normalizeUrl compares Met URLs without query strings, hashes, or trailing slashes', () => {
  assert.equal(
    normalizeUrl('https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy/?utm_source=x#tickets'),
    'https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy'
  );
});

test('capturedAtFromHtml reads browser-assisted fixture capture dates', () => {
  assert.equal(
    capturedAtFromHtml('<main data-captured-at="2026-06-29T19:04:00.000Z"></main>').toISOString(),
    '2026-06-29T19:04:00.000Z'
  );
});

test('Met staging covers every active required seed URL', async () => {
  const report = await audit({
    stagingPath: path.join(projectRoot, 'data/staging/met-exhibitions.json'),
    sourcePath: path.join(projectRoot, 'scripts/exhibit-ingest/sources/met-exhibitions.fixture.json'),
    registryPath: path.join(projectRoot, 'scripts/exhibit-ingest/sources/met-required-exhibitions.json'),
    allowStale: true
  });

  assert.equal(report.seedCoverage.active >= 10, true);
  assert.equal(report.seedCoverage.present, report.seedCoverage.active);
  assert.deepEqual(report.seedCoverage.missing, []);
  assert.equal(report.incomingRecords >= report.minimumExpectedRecords, true);
});

test('Met audit fails when required seed URLs are missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'met-audit-missing-seed-'));
  const stagingPath = path.join(dir, 'staging.json');
  const sourcePath = path.join(dir, 'source.json');
  const registryPath = path.join(dir, 'registry.json');
  const fixturePath = path.join(dir, 'fixture.html');

  await fs.writeFile(
    stagingPath,
    JSON.stringify(
      {
        summary: {
          sourceId: 'met-exhibitions',
          generatedAt: '2026-07-15T18:20:00.000Z',
          incomingRecords: 1
        },
        items: [
          {
            proposed: {
              sourceUrl: 'https://www.metmuseum.org/exhibitions/not-the-required-url'
            }
          }
        ]
      },
      null,
      2
    )
  );
  await fs.writeFile(
    sourcePath,
    JSON.stringify(
      {
        id: 'met-exhibitions',
        pages: [
          {
            url: 'https://www.metmuseum.org/exhibitions',
            file: './fixture.html'
          }
        ]
      },
      null,
      2
    )
  );
  await fs.writeFile(
    registryPath,
    JSON.stringify(
      {
        source: 'met',
        minimumExpectedRecords: 1,
        listingFixtureMaxAgeDays: 14,
        requiredExhibitions: [
          {
            url: 'https://www.metmuseum.org/exhibitions/orientalism-between-fact-and-fantasy',
            title: 'Orientalism: Between Fact and Fantasy',
            status: 'active'
          }
        ]
      },
      null,
      2
    )
  );
  await fs.writeFile(fixturePath, '<main data-captured-at="2026-07-15T18:20:00.000Z"></main>');

  const report = await audit({
    stagingPath,
    sourcePath,
    registryPath,
    now: new Date('2026-07-15T18:21:00.000Z')
  });

  assert.equal(report.ok, false);
  assert.equal(report.seedCoverage.present, 0);
  assert.match(report.problems.join('\n'), /Missing required Met seed URLs/);
});
