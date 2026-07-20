import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const sourcesDir = path.join(projectRoot, 'scripts/exhibit-ingest/sources');
const stagingDir = path.join(projectRoot, 'data/staging');
const recordsFile = path.join(projectRoot, 'data/exhibit-records.json');

const parseArgs = (argv) => {
  const args = {
    dryRun: false,
    sourceIds: [],
    skipIngest: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--skip-ingest') args.skipIngest = true;
    else if (arg === '--source') args.sourceIds.push(argv[++i]);
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const sourceConfigs = async (selectedIds = []) => {
  const entries = await fs.readdir(sourcesDir, { withFileTypes: true });
  const configs = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('-exhibitions.json')) continue;
    if (entry.name.endsWith('.fixture.json') || entry.name.includes('required')) continue;

    const file = path.join(sourcesDir, entry.name);
    const config = await readJson(file);
    if (selectedIds.length && !selectedIds.includes(config.id)) continue;
    configs.push({ file, config });
  }

  return configs.sort((left, right) => left.config.id.localeCompare(right.config.id));
};

const runCommand = (command, args) =>
  new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString()
      });
    });
  });

const normalizeStatus = (status) => {
  if (status === 'approved') return 'reviewer_approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'needs_revision') return 'needs_revision';
  if (status === 'promoted') return 'promoted';
  return 'pending';
};

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

const statusForReport = (report) => {
  const summary = report.summary || {};
  if ((summary.conflicts || 0) > 0 || (summary.possibleDuplicates || 0) > 0) return 'warning';
  return 'healthy';
};

const summaryForReport = (report) => {
  const summary = report.summary || {};
  return {
    parser: summary.parser || null,
    source: summary.source || null,
    stagingNotes: summary.stagingNotes || null,
    verificationStatus: summary.verification?.status || null,
    verificationNotes: summary.verification?.notes || null,
    verificationVerifiedAt: summary.verification?.verifiedAt || null,
    incomingByType: summary.incomingByType || {}
  };
};

const successRun = ({ report, sourceId, startedAt, finishedAt }) => {
  const summary = report.summary || {};
  return {
    source_id: sourceId,
    status: statusForReport(report),
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
    summary: summaryForReport(report)
  };
};

const failureRun = ({ sourceId, source, parser, startedAt, finishedAt, errorMessage }) => ({
  source_id: sourceId,
  status: 'error',
  started_at: startedAt,
  finished_at: finishedAt,
  duration_ms: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)) || null,
  incoming_records: 0,
  creates: 0,
  updates: 0,
  possible_duplicates: 0,
  conflicts: 0,
  unchanged: 0,
  pages_fetched: 0,
  error_message: errorMessage,
  summary: {
    parser,
    source,
    stagingNotes: null,
    verificationStatus: null,
    verificationNotes: null,
    verificationVerifiedAt: null,
    incomingByType: {}
  }
});

const syncResults = async (supabase, results) => {
  const stagingRows = results.flatMap((result) => result.rows || []);
  for (let i = 0; i < stagingRows.length; i += 500) {
    const batch = stagingRows.slice(i, i + 500);
    const { error } = await supabase.from('staging_items').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }

  const { data: insertedRuns, error: runsError } = await supabase
    .from('intake_runs')
    .insert(results.map((result) => result.run))
    .select('id, source_id, status, error_message, incoming_records, creates, updates, possible_duplicates, conflicts, pages_fetched');
  if (runsError) throw runsError;

  const logEvents = (insertedRuns || []).map((run) => ({
    run_id: run.id,
    source_id: run.source_id,
    status: run.status,
    event_type: run.status === 'error' ? 'ingest_failed' : run.status === 'warning' ? 'ingest_warning' : 'ingest_success',
    message:
      run.status === 'error'
        ? `${run.source_id} automatic intake failed.`
        : run.status === 'warning'
          ? `${run.source_id} automatic intake completed with review warnings.`
          : `${run.source_id} automatic intake completed.`,
    details: {
      errorMessage: run.error_message || null,
      incomingRecords: run.incoming_records,
      creates: run.creates,
      updates: run.updates,
      possibleDuplicates: run.possible_duplicates,
      conflicts: run.conflicts,
      pagesFetched: run.pages_fetched
    }
  }));

  const { error: logsError } = await supabase.from('intake_log_events').insert(logEvents);
  if (logsError) throw logsError;
};

const buildResultFromExistingReport = async ({ config, outputPath }) => {
  const report = await readJson(outputPath);
  return {
    sourceId: config.id,
    ok: true,
    rows: (report.items || []).map((item) => itemToRow(item, config.id)),
    run: successRun({
      report,
      sourceId: config.id,
      startedAt: report.summary?.generatedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString()
    })
  };
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/backend/run-automatic-intake.mjs [--dry-run] [--skip-ingest] [--source source-id]');
    return;
  }

  const configs = await sourceConfigs(args.sourceIds);
  if (!configs.length) throw new Error('No live source configs matched the requested source filters.');

  await fs.mkdir(stagingDir, { recursive: true });
  const results = [];

  for (const { file, config } of configs) {
    const outputPath = path.join(stagingDir, `${config.id}.json`);
    console.log(`\n== ${config.id} ==`);

    if (args.skipIngest) {
      results.push(await buildResultFromExistingReport({ config, outputPath }));
      continue;
    }

    const commandResult = await runCommand('node', [
      'scripts/exhibit-ingest/ingest.mjs',
      '--source',
      file,
      '--records',
      recordsFile,
      '--stage',
      '--output',
      outputPath
    ]);

    if (commandResult.code === 0) {
      const report = await readJson(outputPath);
      results.push({
        sourceId: config.id,
        ok: true,
        rows: (report.items || []).map((item) => itemToRow(item, config.id)),
        run: successRun({
          report,
          sourceId: config.id,
          startedAt: commandResult.startedAt,
          finishedAt: commandResult.finishedAt
        })
      });
      continue;
    }

    const errorMessage = (commandResult.stderr || commandResult.stdout || `Process exited with ${commandResult.code}`).trim().slice(0, 2000);
    results.push({
      sourceId: config.id,
      ok: false,
      rows: [],
      run: failureRun({
        sourceId: config.id,
        source: config.source,
        parser: config.parser,
        startedAt: commandResult.startedAt,
        finishedAt: commandResult.finishedAt,
        errorMessage
      })
    });
  }

  const summary = {
    sources: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    stagingRows: results.reduce((total, result) => total + (result.rows?.length || 0), 0),
    dryRun: args.dryRun
  };

  if (!args.dryRun) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to write intake health.');

    const supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });
    await syncResults(supabase, results);
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
