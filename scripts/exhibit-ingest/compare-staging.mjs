import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStagingReport } from './schema-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const parseArgs = (argv) => {
  const args = {
    format: 'text'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--baseline') args.baseline = path.resolve(argv[++i]);
    else if (arg === '--candidate') args.candidate = path.resolve(argv[++i]);
    else if (arg === '--json') args.format = 'json';
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const comparePrimitive = (baseline, candidate) => {
  if (baseline === candidate) return true;
  return JSON.stringify(baseline) === JSON.stringify(candidate);
};

const normalizeItemForComparison = (item) => ({
  proposalType: item.proposalType,
  canonicalId: item.canonicalId || null,
  source: {
    url: item.source?.url || null,
    sourceType: item.source?.sourceType || null,
    reliability: item.source?.reliability || null,
    parser: item.source?.parser || null
  },
  proposed: item.proposed || null,
  changedFields: item.changedFields || [],
  dedupe: item.dedupe || null,
  conflict: item.conflict || null
});

const collectDifferences = (baseline, candidate, prefix = '') => {
  if (comparePrimitive(baseline, candidate)) return [];

  const baselineIsObject = baseline && typeof baseline === 'object' && !Array.isArray(baseline);
  const candidateIsObject = candidate && typeof candidate === 'object' && !Array.isArray(candidate);

  if (baselineIsObject && candidateIsObject) {
    const keys = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])].sort();
    return keys.flatMap((key) => collectDifferences(baseline[key], candidate[key], prefix ? `${prefix}.${key}` : key));
  }

  return [prefix || 'value'];
};

const itemKey = (item) => item?.proposed?.id || item?.canonicalId || item?.id;

const indexByKey = (items = []) =>
  new Map(
    items.map((item) => {
      const key = itemKey(item);
      return [key, item];
    })
  );

const summarizeSourcePages = (pages = []) =>
  pages.map((page) => ({
    url: page.url,
    fetchMode: page.fetchMode,
    fixtureFile: page.fixtureFile || null
  }));

const summarizeVerification = (verification = {}) => ({
  status: verification.status || 'unknown',
  verifiedAt: verification.verifiedAt || null,
  notes: verification.notes || null
});

export const compareStagingReports = (baselineReport, candidateReport) => {
  const baselineItems = indexByKey(baselineReport.items);
  const candidateItems = indexByKey(candidateReport.items);
  const allKeys = [...new Set([...baselineItems.keys(), ...candidateItems.keys()])].sort();

  const added = [];
  const removed = [];
  const changed = [];
  let unchanged = 0;

  for (const key of allKeys) {
    const baselineItem = baselineItems.get(key);
    const candidateItem = candidateItems.get(key);

    if (!baselineItem) {
      added.push(key);
      continue;
    }

    if (!candidateItem) {
      removed.push(key);
      continue;
    }

    const baselineNormalized = normalizeItemForComparison(baselineItem);
    const candidateNormalized = normalizeItemForComparison(candidateItem);
    const differences = collectDifferences(baselineNormalized, candidateNormalized);

    if (!differences.length) {
      unchanged += 1;
      continue;
    }

    changed.push({
      recordId: key,
      differences
    });
  }

  return {
    baseline: {
      stagingPath: null,
      sourceId: baselineReport.summary.sourceId,
      parser: baselineReport.summary.parser,
      verification: summarizeVerification(baselineReport.summary.verification),
      sourcePages: summarizeSourcePages(baselineReport.summary.sourcePages)
    },
    candidate: {
      stagingPath: null,
      sourceId: candidateReport.summary.sourceId,
      parser: candidateReport.summary.parser,
      verification: summarizeVerification(candidateReport.summary.verification),
      sourcePages: summarizeSourcePages(candidateReport.summary.sourcePages)
    },
    counts: {
      baselineItems: baselineReport.items.length,
      candidateItems: candidateReport.items.length,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged
    },
    added,
    removed,
    changed
  };
};

export const buildComparisonSummary = (comparison) => {
  const formatVerification = (verification) =>
    `${verification.status}${verification.verifiedAt ? ` at ${verification.verifiedAt}` : ''}${
      verification.notes ? ` - ${verification.notes}` : ''
    }`;
  const lines = [
    `Baseline: ${comparison.baseline.stagingPath}`,
    `Candidate: ${comparison.candidate.stagingPath}`,
    `Source: ${comparison.baseline.sourceId} -> ${comparison.candidate.sourceId}`,
    `Parser: ${comparison.baseline.parser} -> ${comparison.candidate.parser}`,
    `Verification: ${formatVerification(comparison.baseline.verification)} -> ${formatVerification(comparison.candidate.verification)}`,
    `Counts: baseline=${comparison.counts.baselineItems} candidate=${comparison.counts.candidateItems} added=${comparison.counts.added} removed=${comparison.counts.removed} changed=${comparison.counts.changed} unchanged=${comparison.counts.unchanged}`
  ];

  const sourcePageChanged =
    JSON.stringify(comparison.baseline.sourcePages) !== JSON.stringify(comparison.candidate.sourcePages);
  const verificationChanged =
    JSON.stringify(comparison.baseline.verification) !== JSON.stringify(comparison.candidate.verification);
  lines.push(`Source pages changed: ${sourcePageChanged ? 'yes' : 'no'}`);
  lines.push(`Verification changed: ${verificationChanged ? 'yes' : 'no'}`);

  for (const [label, values] of [
    ['Added', comparison.added],
    ['Removed', comparison.removed]
  ]) {
    lines.push('');
    lines.push(`${label}: ${values.length}`);
    lines.push(values.length ? values.map((value) => `- ${value}`).join('\n') : '- none');
  }

  lines.push('');
  lines.push(`Changed: ${comparison.changed.length}`);
  if (!comparison.changed.length) {
    lines.push('- none');
  } else {
    for (const entry of comparison.changed) {
      lines.push(`- ${entry.recordId}`);
      lines.push(`  fields=${entry.differences.join(', ')}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.baseline || !args.candidate) {
    console.log('Usage: node scripts/exhibit-ingest/compare-staging.mjs --baseline path --candidate path [--json]');
    return;
  }

  const [baselineReport, candidateReport] = await Promise.all([readJson(args.baseline), readJson(args.candidate)]);
  await Promise.all([validateStagingReport(baselineReport), validateStagingReport(candidateReport)]);

  const comparison = compareStagingReports(baselineReport, candidateReport);
  comparison.baseline.stagingPath = path.relative(projectRoot, args.baseline);
  comparison.candidate.stagingPath = path.relative(projectRoot, args.candidate);

  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
    return;
  }

  process.stdout.write(buildComparisonSummary(comparison));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
