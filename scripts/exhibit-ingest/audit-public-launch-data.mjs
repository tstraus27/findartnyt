import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableJson } from './ingest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const defaultRecords = path.join(projectRoot, 'data/exhibit-records.json');
const defaultStagingDir = path.join(projectRoot, 'data/staging');
const defaultOutput = path.join(projectRoot, 'data/public-launch-readiness.json');

const criticalFields = ['title', 'venue', 'sourceUrl', 'exhibitionUrl'];
const dateFields = ['startDate', 'endDate', 'dateText'];
const locationFields = ['city', 'borough', 'neighborhood'];
const recommendedFields = ['description', 'imageUrl', 'venueAddress', ...locationFields];

const parseArgs = (argv) => {
  const args = {
    records: defaultRecords,
    stagingDir: defaultStagingDir,
    output: defaultOutput,
    asOf: new Date().toISOString().slice(0, 10),
    write: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--records') args.records = path.resolve(argv[++i]);
    else if (arg === '--staging-dir') args.stagingDir = path.resolve(argv[++i]);
    else if (arg === '--output') args.output = path.resolve(argv[++i]);
    else if (arg === '--as-of') args.asOf = argv[++i];
    else if (arg === '--no-write') args.write = false;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const usableUrl = (record) => record.sourceUrl || record.exhibitionUrl || null;
const hasAnyDate = (record) => dateFields.some((field) => hasValue(record[field]));

const missingCriticalFields = (record) => {
  const missing = criticalFields.filter((field) => !hasValue(record[field]));
  if (!hasAnyDate(record)) missing.push('startDate|endDate|dateText');
  return missing;
};

const isPastOnly = (record, asOf) => {
  if (!record.endDate) return false;
  return record.endDate < asOf;
};

const sourceKey = (record) => record.source || record.venue || 'unknown';

const increment = (counts, key) => {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
};

const sortedCounts = (counts) =>
  Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.name.localeCompare(right.name);
    });

const summarizeFieldCoverage = (records, fields) =>
  fields.map((field) => ({
    field,
    populated: records.filter((record) => hasValue(record[field])).length,
    total: records.length
  }));

const duplicateGroups = (records) => {
  const groups = new Map();

  for (const record of records) {
    const url = usableUrl(record);
    const key = url
      ? `url:${String(url).toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '')}`
      : `titleVenue:${String(record.title || '').toLowerCase()}|${String(record.venue || '').toLowerCase()}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      key: usableUrl(group[0]) || `${group[0].title || 'unknown'} @ ${group[0].venue || 'unknown'}`,
      recordIds: group.map((record) => record.id || null).filter(Boolean),
      titles: [...new Set(group.map((record) => record.title || null).filter(Boolean))]
    }));
};

const classifyRecords = ({ records, asOf }) => {
  const ready = [];
  const excluded = [];

  for (const record of records) {
    const reasons = [];
    const missing = missingCriticalFields(record);
    if (record.type && record.type !== 'exhibition') reasons.push(`not an exhibition record (${record.type})`);
    if (record.reviewStatus !== 'approved') reasons.push(`review status is ${record.reviewStatus || 'missing'}, not approved`);
    if (missing.length) reasons.push(`missing critical fields: ${missing.join(', ')}`);
    if (isPastOnly(record, asOf)) reasons.push(`past-only exhibition ended before ${asOf}`);

    if (reasons.length) {
      excluded.push({
        id: record.id || null,
        title: record.title || null,
        venue: record.venue || null,
        source: sourceKey(record),
        sourceUrl: usableUrl(record),
        reasons
      });
    } else {
      ready.push(record);
    }
  }

  return { ready, excluded };
};

const summarizeCanonicalStatuses = (records) => {
  const counts = records.reduce((summary, record) => {
    const status = record.reviewStatus || 'missing';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});

  return sortedCounts(counts).map(({ name, count }) => ({ status: name, count }));
};

const summarizeLaunchVenues = (records, asOf) => {
  const venues = new Map();

  for (const record of records) {
    const venue = record.venue || 'unknown';
    if (!venues.has(venue)) {
      venues.set(venue, {
        venue,
        source: sourceKey(record),
        records: 0,
        currentOrUpcoming: 0,
        withSourceUrl: 0,
        withDates: 0
      });
    }

    const summary = venues.get(venue);
    summary.records += 1;
    if (!isPastOnly(record, asOf)) summary.currentOrUpcoming += 1;
    if (usableUrl(record)) summary.withSourceUrl += 1;
    if (hasAnyDate(record)) summary.withDates += 1;
  }

  return [...venues.values()].sort((left, right) => {
    if (right.records !== left.records) return right.records - left.records;
    return left.venue.localeCompare(right.venue);
  });
};

const summarizeLaunchRecords = (records) =>
  records
    .map((record) => ({
      id: record.id || null,
      title: record.title || null,
      venue: record.venue || null,
      source: sourceKey(record),
      startDate: record.startDate || null,
      endDate: record.endDate || null,
      dateText: record.dateText || null,
      sourceUrl: usableUrl(record)
    }))
    .sort((left, right) => {
      const venue = String(left.venue || '').localeCompare(String(right.venue || ''));
      if (venue !== 0) return venue;
      const leftDate = left.startDate || left.endDate || left.dateText || '';
      const rightDate = right.startDate || right.endDate || right.dateText || '';
      const date = String(leftDate).localeCompare(String(rightDate));
      if (date !== 0) return date;
      return String(left.title || '').localeCompare(String(right.title || ''));
    });

const readStagingReports = async (stagingDir) => {
  let entries = [];
  try {
    entries = await fs.readdir(stagingDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const reports = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = path.join(stagingDir, entry.name);
    try {
      const report = await readJson(file);
      if (!report?.summary || !Array.isArray(report.items)) continue;
      reports.push({
        file: path.relative(projectRoot, file),
        sourceId: report.summary.sourceId || null,
        parser: report.summary.parser || null,
        generatedAt: report.summary.generatedAt || null,
        verificationStatus: report.summary.verification?.status || 'unknown',
        creates: report.summary.creates || 0,
        updates: report.summary.updates || 0,
        possibleDuplicates: report.summary.possibleDuplicates || 0,
        conflicts: report.summary.conflicts || 0,
        pendingItems: report.items.filter((item) => item.reviewStatus === 'pending').length,
        approvedItems: report.items.filter((item) => item.reviewStatus === 'approved').length,
        venues: sortedCounts(
          report.items.reduce((counts, item) => {
            increment(counts, item.proposed?.venue);
            return counts;
          }, {})
        )
      });
    } catch {
      reports.push({
        file: path.relative(projectRoot, file),
        error: 'Could not parse staging report as JSON.'
      });
    }
  }

  return reports.sort((left, right) => left.file.localeCompare(right.file));
};

export const buildPublicLaunchReadiness = async ({ recordsDb, stagingReports, asOf, generatedAt }) => {
  const records = Array.isArray(recordsDb.records) ? recordsDb.records : [];
  const exhibitions = records.filter((record) => !record.type || record.type === 'exhibition');
  const approvedExhibitions = exhibitions.filter((record) => record.reviewStatus === 'approved');
  const { ready, excluded } = classifyRecords({ records: exhibitions, asOf });
  const duplicates = duplicateGroups(ready);
  const readyWithoutDuplicates = duplicates.length
    ? ready.filter((record) => !duplicates.some((group) => group.recordIds.includes(record.id)))
    : ready;
  const venueCounts = sortedCounts(
    readyWithoutDuplicates.reduce((counts, record) => {
      increment(counts, record.venue || 'unknown');
      return counts;
    }, {})
  );
  const sourceCounts = sortedCounts(
    readyWithoutDuplicates.reduce((counts, record) => {
      increment(counts, sourceKey(record));
      return counts;
    }, {})
  );
  const recommendedFirstPublicVenueSet = venueCounts
    .filter((entry) => entry.count >= 3)
    .map((entry) => entry.name);
  const warnings = [];
  const risks = [];

  if (records.length === 0) {
    warnings.push('Canonical backend database has zero records. Nothing should go public from staging until records are approved.');
  }

  if (readyWithoutDuplicates.length === 0) {
    risks.push('No canonical exhibition records are launch-ready.');
  }

  if (excluded.length) {
    warnings.push(`${excluded.length} canonical exhibition record(s) are excluded from launch readiness.`);
  }

  if (duplicates.length) {
    risks.push(`${duplicates.length} duplicate group(s) need cleanup before those records should launch.`);
  }

  const stagedPending = stagingReports.reduce((total, report) => total + (report.pendingItems || 0), 0);
  const stagedApproved = stagingReports.reduce((total, report) => total + (report.approvedItems || 0), 0);
  if (stagedPending > 0) {
    warnings.push(`${stagedPending} staged item(s) exist but are not public until reviewed and promoted.`);
  }
  if (stagedApproved > 0) {
    warnings.push(`${stagedApproved} staged item(s) are marked approved in staging; run the approval flow before public launch if they should be canonical.`);
  }

  return {
    generatedAt,
    asOf,
    canonicalSource: 'data/exhibit-records.json',
    publicRule: 'Public launch data must come from approved canonical records only; staging proposals are not public data.',
    totals: {
      canonicalRecords: records.length,
      canonicalExhibitionRecords: exhibitions.length,
      approvedCanonicalExhibitionRecords: approvedExhibitions.length,
      launchReadyRecords: readyWithoutDuplicates.length,
      excludedRecords: excluded.length,
      duplicateGroups: duplicates.length,
      stagingReports: stagingReports.length,
      stagedPendingItems: stagedPending,
      stagedApprovedItems: stagedApproved
    },
    canonicalStatusCoverage: summarizeCanonicalStatuses(exhibitions),
    launchReadyRecords: summarizeLaunchRecords(readyWithoutDuplicates),
    launchRecommendation: {
      readyForPublicV1: readyWithoutDuplicates.length > 0 && duplicates.length === 0,
      recommendedFirstPublicVenueSet,
      summary:
        readyWithoutDuplicates.length > 0
          ? `${readyWithoutDuplicates.length} canonical exhibition record(s) can go public.`
          : 'Do not launch exhibition listings from canonical data yet; approve/promote reviewed staging records first.'
    },
    venueCoverage: summarizeLaunchVenues(readyWithoutDuplicates, asOf),
    sourceCoverage: sourceCounts,
    fieldCoverage: {
      critical: summarizeFieldCoverage(readyWithoutDuplicates, [...criticalFields, ...dateFields]),
      recommended: summarizeFieldCoverage(readyWithoutDuplicates, recommendedFields)
    },
    excludedRecords: excluded,
    duplicateGroups: duplicates,
    stagingInventoryNotPublic: stagingReports,
    warnings,
    risks,
    nextActions:
      readyWithoutDuplicates.length === 0
        ? [
            'Review staged source reports and approve an initial set of records.',
            'Run approve-staging with --apply only after human review.',
            'Re-run npm run audit:public-launch after canonical records exist.'
          ]
        : [
            'Build the public site against canonical records only.',
            'Keep staging files out of the public listing until approval.',
            'Re-run npm run audit:public-launch before each launch/deploy.'
          ]
  };
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      'Usage: node scripts/exhibit-ingest/audit-public-launch-data.mjs [--records path] [--staging-dir path] [--output path] [--as-of YYYY-MM-DD] [--no-write]'
    );
    return;
  }

  const recordsDb = await readJson(args.records);
  const stagingReports = await readStagingReports(args.stagingDir);
  const report = await buildPublicLaunchReadiness({
    recordsDb,
    stagingReports,
    asOf: args.asOf,
    generatedAt: new Date().toISOString()
  });

  if (args.write) {
    await fs.writeFile(args.output, stableJson(report));
    console.log(`Public launch readiness written to ${path.relative(projectRoot, args.output)}`);
  }

  console.log(
    stableJson({
      canonicalRecords: report.totals.canonicalRecords,
      launchReadyRecords: report.totals.launchReadyRecords,
      readyForPublicV1: report.launchRecommendation.readyForPublicV1,
      stagedPendingItems: report.totals.stagedPendingItems,
      warnings: report.warnings,
      risks: report.risks
    })
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
