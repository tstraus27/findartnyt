import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const stagingDir = path.join(projectRoot, 'data/staging');

const parseArgs = (argv) => {
  const args = { stagingDir, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--staging-dir') args.stagingDir = path.resolve(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const sourceIdFor = (report, file) =>
  report.summary?.sourceId || report.summary?.parser || path.basename(file, '.json');

const normalizeStatus = (status) => {
  if (status === 'approved') return 'reviewer_approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'needs_revision') return 'needs_revision';
  if (status === 'promoted') return 'promoted';
  return 'pending';
};

const isExhibitionReport = (report) =>
  (report.items || []).some((item) => item.proposed?.type === 'exhibition') ||
  Boolean(report.summary?.incomingByType?.exhibition);

const itemToRow = (item, sourceId) => ({
  id: item.id,
  source_id: sourceId,
  proposal_type: item.proposalType || 'create',
  canonical_id: item.canonicalId || null,
  review_status: normalizeStatus(item.reviewStatus),
  proposed: item.proposed || {},
  before: item.before || null,
  changed_fields: item.changedFields || [],
  dedupe: item.dedupe || null,
  conflict: item.conflict || null,
  source: item.source || null,
  extracted_at: item.extractedAt || null
});

const loadRows = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const rows = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.live.json')) continue;
    const file = path.join(dir, entry.name);
    const report = await readJson(file);
    if (!isExhibitionReport(report)) continue;
    const sourceId = sourceIdFor(report, file);
    for (const item of report.items || []) {
      rows.push(itemToRow(item, sourceId));
    }
  }

  return rows;
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/backend/sync-staging-to-db.mjs [--staging-dir data/staging] [--dry-run]');
    return;
  }

  const rows = await loadRows(args.stagingDir);
  const summary = { stagingDir: path.relative(projectRoot, args.stagingDir), rows: rows.length, dryRun: args.dryRun };
  if (args.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to sync staging data.');
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false }
  });

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('staging_items').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }

  console.log(JSON.stringify(summary, null, 2));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
