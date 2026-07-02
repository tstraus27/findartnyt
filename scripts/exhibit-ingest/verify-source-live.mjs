import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareStagingReports } from './compare-staging.mjs';
import { stableJson } from './ingest.mjs';
import { validateSourceConfig, validateStagingReport } from './schema-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const parseArgs = (argv) => {
  const args = {
    format: 'text',
    apply: false,
    fixtureSourceConfigs: [],
    refreshBaselineStaging: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--baseline') args.baseline = path.resolve(argv[++i]);
    else if (arg === '--candidate') args.candidate = path.resolve(argv[++i]);
    else if (arg === '--source-config') args.sourceConfig = path.resolve(argv[++i]);
    else if (arg === '--fixture-source-config') args.fixtureSourceConfigs.push(path.resolve(argv[++i]));
    else if (arg === '--verified-at') args.verifiedAt = argv[++i];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--refresh-baseline-staging') args.refreshBaselineStaging = true;
    else if (arg === '--json') args.format = 'json';
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const relativePath = (value) => path.relative(projectRoot, value);

const hasFetchMode = (pages = [], mode) => pages.some((page) => page.fetchMode === mode);

const buildVerificationNotes = (sourceId, candidatePath) =>
  `Live staging artifact matched the fixture-backed review artifact for ${sourceId}; verified against ${relativePath(
    candidatePath
  )}.`;

export const assessLiveVerification = ({
  baselineReport,
  candidateReport,
  sourceConfig,
  baselinePath,
  candidatePath,
  verifiedAt = new Date().toISOString()
}) => {
  const comparison = compareStagingReports(baselineReport, candidateReport);
  comparison.baseline.stagingPath = relativePath(baselinePath);
  comparison.candidate.stagingPath = relativePath(candidatePath);

  const blockers = [];
  const warnings = [];

  if (comparison.baseline.sourceId !== comparison.candidate.sourceId) {
    blockers.push(
      `Source ID mismatch: ${comparison.baseline.sourceId} vs ${comparison.candidate.sourceId}.`
    );
  }

  if (comparison.baseline.parser !== comparison.candidate.parser) {
    blockers.push(`Parser mismatch: ${comparison.baseline.parser} vs ${comparison.candidate.parser}.`);
  }

  if (comparison.counts.added || comparison.counts.removed || comparison.counts.changed) {
    blockers.push(
      `Live comparison changed staged records: added=${comparison.counts.added} removed=${comparison.counts.removed} changed=${comparison.counts.changed}.`
    );
  }

  if (!hasFetchMode(comparison.baseline.sourcePages, 'fixture')) {
    warnings.push('Baseline staging artifact is not fixture-backed.');
  }

  if (!hasFetchMode(comparison.candidate.sourcePages, 'live')) {
    blockers.push('Candidate staging artifact does not show any live-fetched source pages.');
  }

  if (sourceConfig.id !== comparison.candidate.sourceId) {
    blockers.push(`Source config ${sourceConfig.id} does not match candidate source ${comparison.candidate.sourceId}.`);
  }

  const proposedVerification = {
    status: 'verified_live',
    verifiedAt,
    notes: buildVerificationNotes(comparison.candidate.sourceId, candidatePath)
  };

  return {
    eligible: blockers.length === 0,
    verifiedAt,
    blockers,
    warnings,
    comparison,
    proposedVerification
  };
};

export const applyVerificationToSourceConfig = async ({ sourceConfigPath, verification }) => {
  const sourceConfig = await readJson(sourceConfigPath);
  const updated = {
    ...sourceConfig,
    verification
  };
  await validateSourceConfig(updated);
  await fs.writeFile(sourceConfigPath, stableJson(updated));
  return relativePath(sourceConfigPath);
};

export const applyVerificationToStagingReport = async ({ stagingPath, report, verification }) => {
  const updated = {
    ...report,
    summary: {
      ...(report.summary || {}),
      verification
    }
  };
  await validateStagingReport(updated);
  await fs.writeFile(stagingPath, stableJson(updated));
  return relativePath(stagingPath);
};

export const buildVerificationSummary = (assessment) => {
  const lines = [
    `Eligible: ${assessment.eligible ? 'yes' : 'no'}`,
    `Baseline: ${assessment.comparison.baseline.stagingPath}`,
    `Candidate: ${assessment.comparison.candidate.stagingPath}`,
    `Source config verification target: ${assessment.proposedVerification.status} at ${assessment.proposedVerification.verifiedAt}`,
    `Counts: added=${assessment.comparison.counts.added} removed=${assessment.comparison.counts.removed} changed=${assessment.comparison.counts.changed} unchanged=${assessment.comparison.counts.unchanged}`
  ];

  lines.push('');
  lines.push(`Blockers: ${assessment.blockers.length}`);
  lines.push(assessment.blockers.length ? assessment.blockers.map((value) => `- ${value}`).join('\n') : '- none');

  lines.push('');
  lines.push(`Warnings: ${assessment.warnings.length}`);
  lines.push(assessment.warnings.length ? assessment.warnings.map((value) => `- ${value}`).join('\n') : '- none');

  lines.push('');
  lines.push(`Proposed verification notes: ${assessment.proposedVerification.notes}`);

  return `${lines.join('\n')}\n`;
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.baseline || !args.candidate || !args.sourceConfig) {
    console.log(
      'Usage: node scripts/exhibit-ingest/verify-source-live.mjs --baseline path --candidate path --source-config path [--fixture-source-config path] [--verified-at iso] [--apply] [--refresh-baseline-staging] [--json]'
    );
    return;
  }

  const [baselineReport, candidateReport, sourceConfig] = await Promise.all([
    readJson(args.baseline),
    readJson(args.candidate),
    readJson(args.sourceConfig)
  ]);

  await Promise.all([
    validateStagingReport(baselineReport),
    validateStagingReport(candidateReport),
    validateSourceConfig(sourceConfig)
  ]);

  const assessment = assessLiveVerification({
    baselineReport,
    candidateReport,
    sourceConfig,
    baselinePath: args.baseline,
    candidatePath: args.candidate,
    verifiedAt: args.verifiedAt
  });

  const updatedConfigs = [];
  const updatedStagingReports = [];

  if (args.apply && assessment.eligible) {
    updatedConfigs.push(
      await applyVerificationToSourceConfig({
        sourceConfigPath: args.sourceConfig,
        verification: assessment.proposedVerification
      })
    );

    for (const fixtureSourceConfigPath of args.fixtureSourceConfigs) {
      updatedConfigs.push(
        await applyVerificationToSourceConfig({
          sourceConfigPath: fixtureSourceConfigPath,
          verification: assessment.proposedVerification
        })
      );
    }

    if (args.refreshBaselineStaging) {
      updatedStagingReports.push(
        await applyVerificationToStagingReport({
          stagingPath: args.baseline,
          report: baselineReport,
          verification: assessment.proposedVerification
        })
      );
    }
  }

  const output = {
    ...assessment,
    sourceConfigPath: relativePath(args.sourceConfig),
    fixtureSourceConfigPaths: args.fixtureSourceConfigs.map(relativePath),
    refreshBaselineStaging: args.refreshBaselineStaging,
    applied: args.apply && assessment.eligible,
    updatedConfigs,
    updatedStagingReports
  };

  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  process.stdout.write(buildVerificationSummary(output));

  if (output.applied) {
    process.stdout.write(`Updated source configs:\n${output.updatedConfigs.map((value) => `- ${value}`).join('\n')}\n`);
    if (output.updatedStagingReports.length) {
      process.stdout.write(
        `Updated staging reports:\n${output.updatedStagingReports.map((value) => `- ${value}`).join('\n')}\n`
      );
    }
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
