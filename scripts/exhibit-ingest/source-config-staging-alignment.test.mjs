import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sourcesDir = path.join(projectRoot, 'scripts/exhibit-ingest/sources');
const stagingDir = path.join(projectRoot, 'data/staging');

const toRelativeFixturePath = (sourceConfigPath, filePath) =>
  path.relative(projectRoot, path.resolve(path.dirname(sourceConfigPath), filePath)).replaceAll(path.sep, '/');

test('checked-in fixture source configs stay aligned with staged reviewer artifacts', async () => {
  const fixtureConfigFiles = (await fs.readdir(sourcesDir))
    .filter((file) => file.endsWith('.fixture.json'))
    .sort();

  assert.ok(fixtureConfigFiles.length > 0, 'Expected fixture-backed source configs to exist.');

  for (const file of fixtureConfigFiles) {
    const sourceConfigPath = path.join(sourcesDir, file);
    const sourceConfig = JSON.parse(await fs.readFile(sourceConfigPath, 'utf8'));
    const stagingPath = path.join(stagingDir, `${sourceConfig.id}.json`);
    const stagingReport = JSON.parse(await fs.readFile(stagingPath, 'utf8'));

    assert.equal(stagingReport.summary.sourceId, sourceConfig.id, `${file} sourceId drifted from its staging artifact.`);
    assert.equal(stagingReport.summary.source, sourceConfig.source, `${file} source name drifted from its staging artifact.`);
    assert.equal(stagingReport.summary.parser, sourceConfig.parser, `${file} parser drifted from its staging artifact.`);
    assert.equal(
      stagingReport.summary.stagingNotes,
      sourceConfig.stagingNotes,
      `${file} staging scope drifted from its staged reviewer inbox.`
    );
    assert.deepEqual(
      stagingReport.summary.verification,
      sourceConfig.verification,
      `${file} verification metadata drifted from its staged reviewer inbox.`
    );

    const configuredPages = stagingReport.summary.sourcePages.filter((page) => page.pageRole === 'configured');
    assert.equal(
      configuredPages.length,
      sourceConfig.pages.length,
      `${file} configured page count drifted from its staged reviewer inbox.`
    );

    for (const page of sourceConfig.pages) {
      const stagedPage = configuredPages.find((candidate) => candidate.url === page.url);

      assert.ok(stagedPage, `${file} is missing configured page ${page.url} in its staged reviewer inbox.`);
      assert.equal(
        stagedPage.fetchMode,
        page.file ? 'fixture' : 'live',
        `${file} fetch mode drifted for configured page ${page.url}.`
      );

      if (page.file) {
        assert.equal(
          stagedPage.fixtureFile,
          toRelativeFixturePath(sourceConfigPath, page.file),
          `${file} fixture path drifted for configured page ${page.url}.`
        );
      } else {
        assert.equal(stagedPage.fixtureFile, null, `${file} should not report a fixture path for ${page.url}.`);
      }
    }
  }
});
