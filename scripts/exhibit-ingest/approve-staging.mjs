import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableJson } from './ingest.mjs';
import { validateExhibitionRecord, validateStagingReport } from './schema-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const defaultRecords = path.join(projectRoot, 'data/exhibit-records.json');

const parseArgs = (argv) => {
  const args = {
    records: defaultRecords,
    apply: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--staging') args.staging = path.resolve(argv[++i]);
    else if (arg === '--records') args.records = path.resolve(argv[++i]);
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const canonicalFields = [
  'id',
  'type',
  'title',
  'venue',
  'startDate',
  'endDate',
  'dateText',
  'description',
  'artists',
  'curators',
  'venueAddress',
  'neighborhood',
  'borough',
  'city',
  'imageUrl',
  'exhibitionUrl',
  'sourceUrl',
  'openingReceptionDate',
  'tags',
  'sourceConfidence',
  'reviewStatus',
  'lastCheckedAt'
];

const compactRecord = (record) =>
  canonicalFields.reduce((canonical, field) => {
    if (record[field] !== undefined) canonical[field] = record[field];
    return canonical;
  }, {});

const sourceClaimFields = (record) =>
  canonicalFields.filter((field) => record[field] !== undefined && !['id', 'type', 'reviewStatus', 'lastCheckedAt'].includes(field));

export const stagedCreateToCanonical = ({ item, approvedAt }) => {
  const proposed = compactRecord(item.proposed);
  const sourceUrl = proposed.sourceUrl || item.source?.url;

  return {
    ...proposed,
    type: 'exhibition',
    sourceUrl,
    sourceConfidence: proposed.sourceConfidence || item.source?.reliability || 'unknown',
    reviewStatus: 'approved',
    lastCheckedAt: item.extractedAt || approvedAt,
    sources: [
      {
        url: sourceUrl,
        sourceType: item.source?.sourceType || 'other',
        reliability: item.source?.reliability || 'unknown',
        claimFields: sourceClaimFields(proposed),
        checkedAt: item.extractedAt || approvedAt,
        notes: item.source?.notes || null
      }
    ],
    changeHistory: [
      {
        changedAt: approvedAt,
        changeType: 'created',
        actor: 'staging-approval-script',
        summary: `Approved staged create ${item.id}.`,
        sourceUrl
      }
    ],
    createdAt: approvedAt,
    updatedAt: approvedAt
  };
};

export const buildApprovalPlan = async ({ stagingReport, recordsDb, approvedAt = new Date().toISOString() }) => {
  await validateStagingReport(stagingReport);
  const existingIds = new Set((recordsDb.records || []).map((record) => record.id));
  const approvedCreates = stagingReport.items.filter(
    (item) => item.proposalType === 'create' && item.reviewStatus === 'approved' && item.proposed?.type === 'exhibition'
  );

  const promoted = [];
  const skipped = [];

  for (const item of approvedCreates) {
    if (existingIds.has(item.proposed.id)) {
      skipped.push({
        stagingId: item.id,
        recordId: item.proposed.id,
        reason: 'canonical record id already exists'
      });
      continue;
    }

    const canonical = stagedCreateToCanonical({ item, approvedAt });
    try {
      await validateExhibitionRecord(canonical);
    } catch (error) {
      skipped.push({
        stagingId: item.id,
        recordId: item.proposed.id,
        reason: `canonical record validation failed: ${error.message}`
      });
      continue;
    }

    promoted.push(canonical);
    existingIds.add(canonical.id);
  }

  return {
    approvedCreates: approvedCreates.length,
    promoted,
    skipped,
    records: [...(recordsDb.records || []), ...promoted]
  };
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.staging) {
    console.log(
      'Usage: node scripts/exhibit-ingest/approve-staging.mjs --staging path [--records path] [--apply]\n\nWithout --apply, this command performs a dry run only.'
    );
    return;
  }

  const stagingReport = await readJson(args.staging);
  const recordsDb = await readJson(args.records);
  const plan = await buildApprovalPlan({ stagingReport, recordsDb });
  const summary = {
    staging: path.relative(projectRoot, args.staging),
    records: path.relative(projectRoot, args.records),
    mode: args.apply ? 'apply' : 'dry-run',
    approvedCreates: plan.approvedCreates,
    promoted: plan.promoted.length,
    skipped: plan.skipped.length,
    skippedDetails: plan.skipped
  };

  if (args.apply) {
    await fs.writeFile(args.records, stableJson({ records: plan.records }));
  }

  console.log(stableJson(summary));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
