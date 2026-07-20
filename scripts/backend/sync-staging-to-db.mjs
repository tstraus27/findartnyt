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

const healthStatusForReport = (report) => {
  const summary = report.summary || {};
  if ((summary.conflicts || 0) > 0 || (summary.possibleDuplicates || 0) > 0) return 'warning';
  return 'healthy';
};

const runRowForReport = (report, sourceId) => {
  const summary = report.summary || {};
  const startedAt = summary.generatedAt || new Date().toISOString();
  const finishedAt = new Date().toISOString();

  return {
    source_id: sourceId,
    status: healthStatusForReport(report),
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)) || null,
    incoming_records: summary.incomingRecords || 0,
    creates: summary.creates || 0,
    updates: summary.updates || 0,
    possible_duplicates: summary.possibleDuplicates || 0,
    conflicts: summary.conflicts || 0,
    unchanged: summary.unchanged || 0,
    pages_fetched: summary.pagesFetched || 0,
    error_message: null,
    summary: {
      parser: summary.parser || null,
      source: summary.source || null,
      stagingNotes: summary.stagingNotes || null,
      verificationStatus: summary.verification?.status || null,
      verificationNotes: summary.verification?.notes || null,
      verificationVerifiedAt: summary.verification?.verifiedAt || null,
      incomingByType: summary.incomingByType || {}
    }
  };
};

const loadReports = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const reports = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.live.json')) continue;
    const file = path.join(dir, entry.name);
    const report = await readJson(file);
    if (!isExhibitionReport(report)) continue;
    const sourceId = sourceIdFor(report, file);
    const rows = [];
    for (const item of report.items || []) {
      rows.push(itemToRow(item, sourceId));
    }
    reports.push({ file, report, sourceId, rows, run: runRowForReport(report, sourceId) });
  }

  return reports;
};

const recordIntakeRuns = async (supabase, reports) => {
  const runs = reports.map((entry) => entry.run);
  const { data: insertedRuns, error: runsError } = await supabase
    .from('intake_runs')
    .insert(runs)
    .select('id, source_id, status, incoming_records, creates, updates, possible_duplicates, conflicts, pages_fetched');
  if (runsError) {
    console.warn(`Could not record intake health runs: ${runsError.message}`);
    return;
  }

  const logEvents = (insertedRuns || []).map((run) => ({
    run_id: run.id,
    source_id: run.source_id,
    status: run.status,
    event_type: run.status === 'warning' ? 'sync_warning' : 'sync_success',
    message:
      run.status === 'warning'
        ? `${run.source_id} synced with records needing attention.`
        : `${run.source_id} synced successfully.`,
    details: {
      incomingRecords: run.incoming_records,
      creates: run.creates,
      updates: run.updates,
      possibleDuplicates: run.possible_duplicates,
      conflicts: run.conflicts,
      pagesFetched: run.pages_fetched
    }
  }));

  const { error: logsError } = await supabase.from('intake_log_events').insert(logEvents);
  if (logsError) console.warn(`Could not record intake log events: ${logsError.message}`);
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/backend/sync-staging-to-db.mjs [--staging-dir data/staging] [--dry-run]');
    return;
  }

  const reports = await loadReports(args.stagingDir);
  const rows = reports.flatMap((entry) => entry.rows);
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

  await recordIntakeRuns(supabase, reports);

  console.log(JSON.stringify(summary, null, 2));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
