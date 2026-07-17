import fs from 'node:fs/promises';
import path from 'node:path';

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const normalizeUrl = (value) => {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().toLowerCase();
  } catch {
    return String(value || '').toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
};

const capturedAtFromHtml = (html) => {
  const raw =
    String(html || '').match(/\bdata-captured-at=["']([^"']+)["']/i)?.[1] ||
    String(html || '').match(/\bcapturedAt["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ||
    String(html || '').match(/snapshot\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sourceFixturePage = (sourceConfig, listingUrl) => {
  if (listingUrl) {
    return (sourceConfig.pages || []).find((page) => page.url === listingUrl && page.file) || null;
  }

  return (sourceConfig.pages || []).find((page) => page.file) || null;
};

const auditBrowserFixtureSource = async ({
  label,
  stagingPath,
  sourcePath,
  registryPath,
  listingUrl = null,
  allowStale = false,
  now = new Date()
}) => {
  const [staging, sourceConfig, registry] = await Promise.all([
    readJson(stagingPath),
    readJson(sourcePath),
    readJson(registryPath)
  ]);

  const problems = [];
  const warnings = [];
  const minimumExpectedRecords = registry.minimumExpectedRecords ?? 0;
  const maxAgeDays = registry.listingFixtureMaxAgeDays ?? 14;
  const activeSeeds = (registry.requiredExhibitions || []).filter((seed) => seed.status !== 'inactive');
  const stagedUrls = new Set(
    (staging.items || []).map((item) => normalizeUrl(item.proposed?.sourceUrl || item.proposed?.exhibitionUrl)).filter(Boolean)
  );
  const missingSeeds = activeSeeds.filter((seed) => !stagedUrls.has(normalizeUrl(seed.url)));

  if (missingSeeds.length) {
    problems.push(`Missing required ${label} seed URLs: ${missingSeeds.map((seed) => seed.url).join(', ')}`);
  }

  if ((staging.summary?.incomingRecords || 0) < minimumExpectedRecords) {
    problems.push(
      `${label} staging has ${staging.summary?.incomingRecords || 0} incoming records; minimum expected is ${minimumExpectedRecords}.`
    );
  }

  const listingPage = sourceFixturePage(sourceConfig, listingUrl);
  let fixtureCapture = null;
  let fixtureAgeDays = null;

  if (!listingPage) {
    problems.push(`${label} source config has no fixture-backed listing page${listingUrl ? ` for ${listingUrl}` : ''}.`);
  } else {
    const html = await fs.readFile(path.resolve(path.dirname(sourcePath), listingPage.file), 'utf8');
    fixtureCapture = capturedAtFromHtml(html);

    if (!fixtureCapture) {
      problems.push(`${label} listing fixture has no readable capture timestamp.`);
    } else {
      const fixtureAgeMs = now.getTime() - fixtureCapture.getTime();
      fixtureAgeDays = Math.ceil(fixtureAgeMs / 86_400_000);
      if (fixtureAgeMs > maxAgeDays * 86_400_000) {
        const message = `${label} listing fixture is stale: captured ${fixtureCapture.toISOString()} (${fixtureAgeDays} days old), max age ${maxAgeDays} days.`;
        if (allowStale) warnings.push(message);
        else problems.push(message);
      }
    }
  }

  return {
    ok: problems.length === 0,
    sourceId: staging.summary?.sourceId || sourceConfig.id,
    label,
    generatedAt: staging.summary?.generatedAt || null,
    incomingRecords: staging.summary?.incomingRecords || 0,
    minimumExpectedRecords,
    seedCoverage: {
      active: activeSeeds.length,
      present: activeSeeds.length - missingSeeds.length,
      missing: missingSeeds.map((seed) => ({ title: seed.title, url: seed.url }))
    },
    listingFixture: {
      capturedAt: fixtureCapture ? fixtureCapture.toISOString() : null,
      ageDays: fixtureAgeDays,
      maxAgeDays,
      stale: typeof fixtureAgeDays === 'number' ? fixtureAgeDays > maxAgeDays : null
    },
    problems,
    warnings
  };
};

const printAuditReport = (report) => {
  console.log(`${report.label} audit: ${report.ok ? 'ok' : 'needs_attention'}`);
  console.log(`Generated: ${report.generatedAt || 'unknown'}`);
  console.log(`Records: ${report.incomingRecords}/${report.minimumExpectedRecords} minimum`);
  console.log(
    `Seed coverage: ${report.seedCoverage.present}/${report.seedCoverage.active} present${
      report.seedCoverage.missing.length
        ? `; missing ${report.seedCoverage.missing.map((seed) => seed.url).join(', ')}`
        : ''
    }`
  );
  console.log(
    `Listing fixture: captured=${report.listingFixture.capturedAt || 'unknown'} ageDays=${
      report.listingFixture.ageDays ?? 'unknown'
    } maxAgeDays=${report.listingFixture.maxAgeDays} stale=${report.listingFixture.stale}`
  );

  for (const warning of report.warnings) console.log(`Warning: ${warning}`);
  for (const problem of report.problems) console.error(`Blocker: ${problem}`);
};

export { auditBrowserFixtureSource, capturedAtFromHtml, normalizeUrl, printAuditReport };
