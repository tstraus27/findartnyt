import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableJson } from './ingest.mjs';
import { validateStagingReport } from './schema-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const defaultStagingDir = path.join(projectRoot, 'data/staging');
const reviewableStatuses = new Set(['pending', 'needs_revision']);

const parseArgs = (argv) => {
  const args = {
    staging: null,
    stagingDir: defaultStagingDir,
    dryRun: false,
    asOfDate: todayLocalDate()
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--staging') args.staging = path.resolve(argv[++i]);
    else if (arg === '--staging-dir') args.stagingDir = path.resolve(argv[++i]);
    else if (arg === '--as-of') args.asOfDate = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

export function todayLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

export const isClosedExhibitionRecord = (record, asOfDate = todayLocalDate()) =>
  record?.type === 'exhibition' && isIsoDate(record.endDate) && record.endDate < asOfDate;

const proposalCounts = (items = []) => ({
  creates: items.filter((item) => item.proposalType === 'create').length,
  updates: items.filter((item) => item.proposalType === 'update').length,
  possibleDuplicates: items.filter((item) => item.proposalType === 'possibleDuplicate').length,
  conflicts: items.filter((item) => item.proposalType === 'conflict').length
});

const decrementIncomingByType = (incomingByType = {}, removedItems = []) => {
  const next = { ...incomingByType };

  for (const item of removedItems) {
    const type = item.proposed?.type;
    if (!type || typeof next[type] !== 'number') continue;
    next[type] = Math.max(0, next[type] - 1);
  }

  return next;
};

export const pruneClosedStagingReport = (report, { asOfDate = todayLocalDate() } = {}) => {
  const originalItems = report.items || [];
  const removedItems = originalItems.filter(
    (item) => reviewableStatuses.has(item.reviewStatus) && isClosedExhibitionRecord(item.proposed, asOfDate)
  );

  if (!removedItems.length) {
    return {
      report,
      removedItems: [],
      changed: false
    };
  }

  const removedItemIds = new Set(removedItems.map((item) => item.id));
  const removedProposedIds = new Set(removedItems.map((item) => item.proposed?.id).filter(Boolean));
  const items = originalItems.filter((item) => !removedItemIds.has(item.id));
  const counts = proposalCounts(items);
  const removedIncomingCount = removedProposedIds.size;

  const nextReport = {
    ...report,
    summary: {
      ...report.summary,
      ...counts,
      incomingRecords: Math.max(0, (report.summary?.incomingRecords || 0) - removedIncomingCount),
      incomingByType: decrementIncomingByType(report.summary?.incomingByType || {}, removedItems)
    },
    items,
    creates: (report.creates || []).filter((record) => !removedProposedIds.has(record.id)),
    updates: (report.updates || []).filter((update) => !removedProposedIds.has(update.after?.id))
  };

  return {
    report: nextReport,
    removedItems,
    changed: true
  };
};

export const pruneClosedStagingFile = async ({ stagingFile, asOfDate = todayLocalDate(), dryRun = false }) => {
  const report = await readJson(stagingFile);
  await validateStagingReport(report);

  const result = pruneClosedStagingReport(report, { asOfDate });
  if (result.changed && !dryRun) {
    await validateStagingReport(result.report);
    await fs.writeFile(stagingFile, stableJson(result.report));
  }

  return {
    file: stagingFile,
    asOfDate,
    changed: result.changed,
    removedItems: result.removedItems.map((item) => ({
      id: item.id,
      title: item.proposed?.title || null,
      venue: item.proposed?.venue || null,
      endDate: item.proposed?.endDate || null,
      reviewStatus: item.reviewStatus,
      sourceUrl: item.proposed?.sourceUrl || item.proposed?.exhibitionUrl || item.source?.url || null
    }))
  };
};

const listStagingFiles = async (stagingDir) => {
  const entries = await fs.readdir(stagingDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.live.json'))
    .map((entry) => path.join(stagingDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
};

export const pruneClosedStagingDirectory = async ({ stagingDir = defaultStagingDir, asOfDate = todayLocalDate(), dryRun = false } = {}) => {
  const files = await listStagingFiles(stagingDir);
  const results = [];

  for (const file of files) {
    try {
      results.push(await pruneClosedStagingFile({ stagingFile: file, asOfDate, dryRun }));
    } catch (error) {
      results.push({
        file,
        asOfDate,
        changed: false,
        removedItems: [],
        error: error.message
      });
    }
  }

  return results;
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      'Usage: node scripts/exhibit-ingest/prune-closed-staging.mjs [--staging path | --staging-dir path] [--as-of YYYY-MM-DD] [--dry-run]'
    );
    return;
  }

  const results = args.staging
    ? [await pruneClosedStagingFile({ stagingFile: args.staging, asOfDate: args.asOfDate, dryRun: args.dryRun })]
    : await pruneClosedStagingDirectory({ stagingDir: args.stagingDir, asOfDate: args.asOfDate, dryRun: args.dryRun });

  const removedCount = results.reduce((count, result) => count + result.removedItems.length, 0);
  console.log(
    stableJson({
      asOfDate: args.asOfDate,
      dryRun: args.dryRun,
      filesChecked: results.length,
      removedCount,
      results: results
        .filter((result) => result.removedItems.length || result.error)
        .map((result) => ({
          file: path.relative(projectRoot, result.file),
          removedItems: result.removedItems,
          error: result.error || null
        }))
    })
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
