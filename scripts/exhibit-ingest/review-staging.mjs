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
    if (arg === '--staging') args.staging = path.resolve(argv[++i]);
    else if (arg === '--json') args.format = 'json';
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const formatDateRange = (startDate, endDate) => {
  if (startDate && endDate) return `${startDate} -> ${endDate}`;
  if (startDate) return startDate;
  if (endDate) return `until ${endDate}`;
  return 'unknown dates';
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return 'n/a';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '[]';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const minimumReviewFields = ['title', 'venue', 'startDate', 'sourceUrl'];

const reviewCoverageFields = [
  'description',
  'imageUrl',
  'venueAddress',
  'neighborhood',
  'borough',
  'city',
  'exhibitionUrl',
  'sourceUrl'
];

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const missingCoverageFields = (proposed = {}) =>
  reviewCoverageFields.filter((field) => !hasValue(proposed[field]));

const missingRequiredFields = (proposed = {}) =>
  minimumReviewFields.filter((field) => !hasValue(proposed[field]));

const summarizeItem = (item) => {
  const proposed = item.proposed || {};
  const dedupe =
    item.dedupe?.status && item.dedupe.status !== 'no_match' && item.dedupe.status !== 'not_checked'
      ? `${item.dedupe.status} (${item.dedupe.confidence}) vs ${item.dedupe.matchedRecordIds.join(', ')}`
      : null;
  const fields = item.changedFields?.length ? item.changedFields.join(', ') : 'none';

  const lines = [
    `- ${proposed.title || item.id}`,
    `  proposal=${item.proposalType} review=${item.reviewStatus} canonical=${item.canonicalId || 'new'}`,
    `  venue=${proposed.venue || 'n/a'} dates=${formatDateRange(proposed.startDate, proposed.endDate)}`,
    `  url=${proposed.exhibitionUrl || proposed.sourceUrl || item.source?.url || 'n/a'}`,
    `  changedFields=${fields}`
  ];

  if (dedupe) {
    lines.push(`  dedupe=${dedupe}`);
  }

  if (item.conflict) {
    lines.push(`  conflict=${displayValue(item.conflict)}`);
  }

  const minimumMissingFields = missingRequiredFields(proposed);
  if (minimumMissingFields.length) {
    lines.push(`  minimumMissing=${minimumMissingFields.join(', ')}`);
  }

  const missingFields = missingCoverageFields(proposed);
  if (missingFields.length) {
    lines.push(`  missing=${missingFields.join(', ')}`);
  }

  return lines.join('\n');
};

const groupItemsByProposalType = (items = []) => {
  const groups = {
    create: [],
    update: [],
    possibleDuplicate: [],
    conflict: []
  };

  for (const item of items) {
    if (!groups[item.proposalType]) groups[item.proposalType] = [];
    groups[item.proposalType].push(item);
  }

  return groups;
};

const incrementCount = (counts, key) => {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
};

const sortedCounts = (counts) =>
  Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });

const buildRecordInsights = (items = []) => {
  const venueCounts = {};
  const statusTagCounts = {};
  const requiredFieldCounts = Object.fromEntries(minimumReviewFields.map((field) => [field, 0]));
  const fieldCoverageCounts = Object.fromEntries(reviewCoverageFields.map((field) => [field, 0]));
  const minimumFailures = [];

  for (const item of items) {
    const proposed = item.proposed || {};
    incrementCount(venueCounts, proposed.venue);

    const tags = Array.isArray(proposed.tags) ? proposed.tags : [];
    for (const tag of tags) {
      if (tag === 'current' || tag === 'upcoming') {
        incrementCount(statusTagCounts, tag);
      }
    }

    const missingMinimumFields = missingRequiredFields(proposed);
    if (missingMinimumFields.length) {
      minimumFailures.push({
        id: item.id,
        title: proposed.title || null,
        proposalType: item.proposalType,
        missingFields: missingMinimumFields
      });
    }

    for (const field of minimumReviewFields) {
      if (hasValue(proposed[field])) {
        requiredFieldCounts[field] += 1;
      }
    }

    for (const field of reviewCoverageFields) {
      if (hasValue(proposed[field])) {
        fieldCoverageCounts[field] += 1;
      }
    }
  }

  return {
    venues: sortedCounts(venueCounts).map(([venue, count]) => ({ venue, count })),
    statusTags: sortedCounts(statusTagCounts).map(([tag, count]) => ({ tag, count })),
    minimumFieldCoverage: minimumReviewFields.map((field) => ({
      field,
      populated: requiredFieldCounts[field],
      total: items.length
    })),
    minimumReady: minimumFailures.length === 0,
    minimumFailures,
    fieldCoverage: reviewCoverageFields.map((field) => ({
      field,
      populated: fieldCoverageCounts[field],
      total: items.length
    }))
  };
};

const formatCounts = (entries, labelKey) =>
  entries.length ? entries.map((entry) => `${entry[labelKey]}=${entry.count}`).join(', ') : 'n/a';

const formatCoverage = (entries) =>
  entries.length ? entries.map((entry) => `${entry.field}=${entry.populated}/${entry.total}`).join(', ') : 'n/a';

const buildSourcePageInsights = (pages = []) => {
  const counts = {
    configured: 0,
    followed: 0,
    fixture: 0,
    live: 0
  };

  for (const page of pages) {
    if (page?.pageRole === 'followed') {
      counts.followed += 1;
    } else {
      counts.configured += 1;
    }

    if (page?.fetchMode === 'fixture') {
      counts.fixture += 1;
    } else if (page?.fetchMode === 'live') {
      counts.live += 1;
    }
  }

  return counts;
};

const formatMinimumFailures = (entries) =>
  entries.length
    ? entries
        .map((entry) => `${entry.title || entry.id} [${entry.proposalType}] missing=${entry.missingFields.join('|')}`)
        .join('; ')
    : 'none';

const countItemsMissingFields = (items, fields) => {
  const counts = Object.fromEntries(fields.map((field) => [field, 0]));

  for (const item of items) {
    const proposed = item.proposed || {};
    for (const field of fields) {
      if (!hasValue(proposed[field])) {
        counts[field] += 1;
      }
    }
  }

  return fields.map((field) => ({ field, missing: counts[field], total: items.length }));
};

const buildMissingFieldDetails = (items, fields) =>
  fields
    .map((field) => ({
      field,
      items: items
        .filter((item) => !hasValue(item.proposed?.[field]))
        .map((item) => ({
          id: item.id,
          title: item.proposed?.title || null,
          proposalType: item.proposalType,
          sourceUrl: item.proposed?.sourceUrl || item.proposed?.exhibitionUrl || item.source?.url || null
        }))
    }))
    .filter((entry) => entry.items.length > 0);

const buildReadiness = (report) => {
  const items = report.items || [];
  const verificationStatus = report.summary.verification?.status || 'unknown';
  const missingMinimum = countItemsMissingFields(items, minimumReviewFields);
  const missingCoverage = countItemsMissingFields(items, reviewCoverageFields);
  const recommendedGapDetails = buildMissingFieldDetails(items, reviewCoverageFields);
  const blockers = [];
  const warnings = [];
  const nextActions = [];

  if (verificationStatus !== 'verified_live') {
    blockers.push(
      `Source verification is ${verificationStatus}; run the live source staging flow and compare it against the fixture-backed artifact before treating this source as live-verified.`
    );
    nextActions.push('Run the live source staging command in a network-enabled environment.');
    nextActions.push('Compare the live staging artifact against the fixture-backed review artifact.');
  }

  const minimumFieldGaps = missingMinimum.filter((entry) => entry.missing > 0);
  if (minimumFieldGaps.length) {
    blockers.push(
      `Minimum review fields missing on staged items: ${minimumFieldGaps
        .map((entry) => `${entry.field}=${entry.missing}/${entry.total}`)
        .join(', ')}.`
    );
  }

  const coverageGaps = missingCoverage.filter((entry) => entry.missing > 0);
  for (const entry of coverageGaps) {
    warnings.push(`Recommended field coverage gap: ${entry.field} missing on ${entry.missing}/${entry.total} staged items.`);
  }

  if (report.summary.possibleDuplicates > 0) {
    warnings.push(
      `${report.summary.possibleDuplicates} staged item(s) are marked possible duplicates and must stay in review until a human confirms the match.`
    );
  }

  if (report.summary.conflicts > 0) {
    warnings.push(
      `${report.summary.conflicts} staged item(s) contain reviewer-sensitive conflicts against canonical data and require human judgment.`
    );
  }

  nextActions.push('Review pending staged items and keep them in staging until human approval.');

  return {
    status: blockers.length ? 'needs_attention' : 'ready_for_human_review',
    verificationStatus,
    blockers,
    warnings,
    nextActions,
    counts: {
      pendingItems: items.filter((item) => item.reviewStatus === 'pending').length,
      possibleDuplicates: report.summary.possibleDuplicates,
      conflicts: report.summary.conflicts
    },
    minimumFieldCoverage: missingMinimum.map((entry) => ({
      field: entry.field,
      populated: entry.total - entry.missing,
      total: entry.total
    })),
    recommendedFieldCoverage: missingCoverage.map((entry) => ({
      field: entry.field,
      populated: entry.total - entry.missing,
      total: entry.total
    })),
    recommendedGapDetails
  };
};

const formatGapDetails = (entries) =>
  entries
    .map(
      (entry) =>
        `${entry.field}: ${entry.items
          .map((item) => `${item.title || item.id} [${item.proposalType}]${item.sourceUrl ? ` <${item.sourceUrl}>` : ''}`)
          .join('; ')}`
    )
    .join(' | ');

export const buildReviewPayload = (report, stagingPath) => {
  const groups = groupItemsByProposalType(report.items);
  const insights = buildRecordInsights(report.items);
  const readiness = buildReadiness(report);
  const pageCoverage = buildSourcePageInsights(report.summary.sourcePages || []);

  return {
    stagingPath: path.relative(projectRoot, stagingPath),
    source: {
      sourceId: report.summary.sourceId,
      parser: report.summary.parser,
      generatedAt: report.summary.generatedAt,
      stagingNotes: report.summary.stagingNotes || null,
      verification: report.summary.verification || {
        status: 'unknown',
        verifiedAt: null,
        notes: null
      },
      pageCoverage,
      pages: report.summary.sourcePages || []
    },
    counts: {
      creates: report.summary.creates,
      updates: report.summary.updates,
      possibleDuplicates: report.summary.possibleDuplicates,
      conflicts: report.summary.conflicts,
      unchanged: report.summary.unchanged
    },
    readiness,
    insights,
    sections: groups
  };
};

export const buildReviewSummary = (report, stagingPath) => {
  const groups = groupItemsByProposalType(report.items);
  const insights = buildRecordInsights(report.items);
  const readiness = buildReadiness(report);
  const pageCoverage = buildSourcePageInsights(report.summary.sourcePages || []);
  const lines = [
    `Staging review: ${path.relative(projectRoot, stagingPath)}`,
    `Source: ${report.summary.sourceId} (${report.summary.parser})`,
    `Generated: ${report.summary.generatedAt}`,
    `Scope: ${report.summary.stagingNotes || 'n/a'}`,
    `Readiness: ${readiness.status}`,
    `Verification: ${(report.summary.verification?.status || 'unknown')}${
      report.summary.verification?.verifiedAt ? ` at ${report.summary.verification.verifiedAt}` : ''
    }${report.summary.verification?.notes ? ` - ${report.summary.verification.notes}` : ''}`,
    `Page coverage: configured=${pageCoverage.configured} followed=${pageCoverage.followed} fixture=${pageCoverage.fixture} live=${pageCoverage.live}`,
    `Pages: ${(report.summary.sourcePages || [])
      .map((page) => `${page.pageRole}/${page.fetchMode}:${page.url}${page.fixtureFile ? ` [${page.fixtureFile}]` : ''}`)
      .join(', ') || 'n/a'}`,
    `Counts: creates=${report.summary.creates} updates=${report.summary.updates} possibleDuplicates=${report.summary.possibleDuplicates} conflicts=${report.summary.conflicts} unchanged=${report.summary.unchanged}`,
    `Minimum ready: ${insights.minimumReady ? 'yes' : 'no'}`,
    `Minimum field coverage: ${formatCoverage(insights.minimumFieldCoverage)}`,
    `Minimum field failures: ${formatMinimumFailures(insights.minimumFailures)}`,
    `Venue counts: ${formatCounts(insights.venues, 'venue')}`,
    `Status tags: ${formatCounts(insights.statusTags, 'tag')}`,
    `Field coverage: ${formatCoverage(insights.fieldCoverage)}`
  ];

  if (readiness.blockers.length) {
    lines.push(`Blockers: ${readiness.blockers.join(' | ')}`);
  }

  if (readiness.warnings.length) {
    lines.push(`Warnings: ${readiness.warnings.join(' | ')}`);
  }

  if (readiness.recommendedGapDetails.length) {
    lines.push(`Recommended gap details: ${formatGapDetails(readiness.recommendedGapDetails)}`);
  }

  if (readiness.nextActions.length) {
    lines.push(`Next actions: ${readiness.nextActions.join(' | ')}`);
  }

  for (const section of ['create', 'update', 'possibleDuplicate', 'conflict']) {
    lines.push('');
    lines.push(`[${section}] ${groups[section].length}`);

    if (!groups[section].length) {
      lines.push('- none');
      continue;
    }

    for (const item of groups[section]) {
      lines.push(summarizeItem(item));
    }
  }

  return `${lines.join('\n')}\n`;
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.staging) {
    console.log('Usage: node scripts/exhibit-ingest/review-staging.mjs --staging path [--json]');
    return;
  }

  const report = await readJson(args.staging);
  await validateStagingReport(report);

  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(buildReviewPayload(report, args.staging), null, 2)}\n`);
    return;
  }

  process.stdout.write(buildReviewSummary(report, args.staging));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
