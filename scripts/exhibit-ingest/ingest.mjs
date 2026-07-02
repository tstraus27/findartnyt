import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBronxMuseumExhibitionsPage } from './parsers/bronx-museum-exhibitions.mjs';
import { parseCooperHewittExhibitionsPage } from './parsers/cooper-hewitt-exhibitions.mjs';
import { parseDavidZwirnerArtistPage } from './parsers/david-zwirner-artist.mjs';
import { parseDavidZwirnerExhibitionsPage } from './parsers/david-zwirner-exhibitions.mjs';
import { parseDrawingCenterExhibitionsPage } from './parsers/drawing-center-exhibitions.mjs';
import { parseFitExhibitionsPage } from './parsers/fit-exhibitions.mjs';
import { parseFrickExhibitionsPage } from './parsers/frick-exhibitions.mjs';
import { parseGuggenheimExhibitionsPage } from './parsers/guggenheim-exhibitions.mjs';
import { parseIcpExhibitionsPage } from './parsers/icp-exhibitions.mjs';
import { parseJewishMuseumExhibitionsPage } from './parsers/jewish-museum-exhibitions.mjs';
import { parseMadExhibitionsPage } from './parsers/mad-exhibitions.mjs';
import { parseMcnyExhibitionsPage } from './parsers/mcny-exhibitions.mjs';
import { parseMetExhibitionsPage } from './parsers/met-exhibitions.mjs';
import { parseMorganExhibitionsPage } from './parsers/morgan-exhibitions.mjs';
import { parseMomaExhibitionsPage } from './parsers/moma-exhibitions.mjs';
import { parseNewMuseumExhibitionsPage } from './parsers/new-museum-exhibitions.mjs';
import { parseNoguchiExhibitionsPage } from './parsers/noguchi-exhibitions.mjs';
import { parsePosterHouseExhibitionsPage } from './parsers/poster-house-exhibitions.mjs';
import { parseWhitneyExhibitionsPage } from './parsers/whitney-exhibitions.mjs';
import { validateSourceConfig, validateStagingReport } from './schema-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const defaultSource = path.join(__dirname, 'sources/david-zwirner-artists.json');
const defaultRecords = path.join(projectRoot, 'data/exhibit-records.json');
const defaultStagingDir = path.join(projectRoot, 'data/staging');

const parsers = {
  'bronx-museum-exhibitions': parseBronxMuseumExhibitionsPage,
  'cooper-hewitt-exhibitions': parseCooperHewittExhibitionsPage,
  'david-zwirner-artist': parseDavidZwirnerArtistPage,
  'david-zwirner-exhibitions': parseDavidZwirnerExhibitionsPage,
  'drawing-center-exhibitions': parseDrawingCenterExhibitionsPage,
  'fit-exhibitions': parseFitExhibitionsPage,
  'frick-exhibitions': parseFrickExhibitionsPage,
  'guggenheim-exhibitions': parseGuggenheimExhibitionsPage,
  'icp-exhibitions': parseIcpExhibitionsPage,
  'jewish-museum-exhibitions': parseJewishMuseumExhibitionsPage,
  'mad-exhibitions': parseMadExhibitionsPage,
  'mcny-exhibitions': parseMcnyExhibitionsPage,
  'met-exhibitions': parseMetExhibitionsPage,
  'moma-exhibitions': parseMomaExhibitionsPage,
  'morgan-exhibitions': parseMorganExhibitionsPage,
  'new-museum-exhibitions': parseNewMuseumExhibitionsPage,
  'noguchi-exhibitions': parseNoguchiExhibitionsPage,
  'poster-house-exhibitions': parsePosterHouseExhibitionsPage,
  'whitney-exhibitions': parseWhitneyExhibitionsPage
};

export const parseArgs = (argv) => {
  const args = {
    source: defaultSource,
    records: defaultRecords,
    stage: false,
    output: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') args.source = path.resolve(argv[++i]);
    else if (arg === '--records') args.records = path.resolve(argv[++i]);
    else if (arg === '--output') args.output = path.resolve(argv[++i]);
    else if (arg === '--stage') args.stage = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const fetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 exhibit-ingest/0.1'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

export const readSourcePage = async (page, baseDir = projectRoot) => {
  if (page.file) {
    const filePath = path.resolve(baseDir, page.file);
    return {
      html: await fs.readFile(filePath, 'utf8'),
      url: page.url
    };
  }

  return {
    html: await fetchPage(page.url),
    url: page.url
  };
};

const sortRecord = (record) =>
  Object.keys(record)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = record[key];
      return sorted;
    }, {});

export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const slugFromUrl = (value) => {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).at(-1) || 'unknown';
  } catch {
    return 'unknown';
  }
};

const isBlankValue = (value) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const mergeArrayValues = (left, right) => {
  const merged = [];

  for (const value of [...(left || []), ...(right || [])]) {
    if (!merged.some((existing) => stableJson(existing) === stableJson(value))) {
      merged.push(value);
    }
  }

  return merged;
};

const mergeScalarValues = (left, right, key) => {
  if (isBlankValue(left)) return right;
  if (isBlankValue(right)) return left;
  if (stableJson(left) === stableJson(right)) return left;

  if (key === 'sourceNotes') {
    return [left, right]
      .map((value) => String(value).trim())
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(' ');
  }

  if (key === 'description') {
    return String(right).length > String(left).length ? right : left;
  }

  if (key === 'startDate' || key === 'endDate' || key === 'openingReceptionDate') {
    return String(right).length > String(left).length ? right : left;
  }

  return left;
};

const mergeRecordPair = (left, right) => {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  const merged = {};

  for (const key of keys) {
    const leftValue = left?.[key];
    const rightValue = right?.[key];

    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      merged[key] = mergeArrayValues(leftValue, rightValue);
      continue;
    }

    merged[key] = mergeScalarValues(leftValue, rightValue, key);
  }

  return merged;
};

export const mergeIncomingRecords = (records) => {
  const merged = new Map();

  for (const record of records) {
    if (!record?.id) continue;

    const existing = merged.get(record.id);
    merged.set(record.id, existing ? mergeRecordPair(existing, record) : record);
  }

  return [...merged.values()];
};

const sourcePagesSummary = (sourceConfig, sourcePath) =>
  (sourceConfig.pages || []).map((page) => ({
    url: page.url,
    pageRole: 'configured',
    fetchMode: page.file ? 'fixture' : 'live',
    fixtureFile: page.file ? path.relative(projectRoot, path.resolve(path.dirname(sourcePath), page.file)) : null
  }));

const summarizeFetchedPage = (page, sourcePath = defaultSource, pageRole = 'configured') => ({
  url: page.url,
  pageRole,
  fetchMode: page.file ? 'fixture' : 'live',
  fixtureFile: page.file ? path.relative(projectRoot, path.resolve(path.dirname(sourcePath), page.file)) : null
});

const followPageForRecord = (page, record) => {
  if (!page?.followRecordUrls || !record?.sourceUrl) {
    return null;
  }

  const followedPage = {
    url: record.sourceUrl
  };

  if (page.file && page.followRecordUrlFixtureDirectory) {
    followedPage.file = path.join(page.followRecordUrlFixtureDirectory, `${slugFromUrl(record.sourceUrl)}.html`);
  }

  return followedPage;
};

const sourceVerificationSummary = (sourceConfig) => ({
  status: sourceConfig.verification?.status || 'unknown',
  verifiedAt: sourceConfig.verification?.verifiedAt || null,
  notes: sourceConfig.verification?.notes || null
});

export const diffRecords = (existingRecords, incomingRecords) => {
  const existingById = new Map(existingRecords.map((record) => [record.id, record]));
  const creates = [];
  const updates = [];
  const unchanged = [];

  for (const incoming of incomingRecords) {
    const existing = existingById.get(incoming.id);
    if (!existing) {
      creates.push(incoming);
      continue;
    }

    if (stableJson(sortRecord(existing)) === stableJson(sortRecord(incoming))) {
      unchanged.push(incoming);
    } else {
      updates.push({ before: existing, after: incoming });
    }
  }

  return { creates, updates, unchanged };
};

export const summarizeByType = (records) =>
  records.reduce((summary, record) => {
    summary[record.type] = (summary[record.type] || 0) + 1;
    return summary;
  }, {});

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().toLowerCase();
  } catch {
    return value.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
};

const yearMonth = (value) => (typeof value === 'string' ? value.slice(0, 7) : '');

export const dedupeScore = (incoming, existing) => {
  if (incoming?.type !== 'exhibition' || existing?.type !== 'exhibition') {
    return null;
  }

  const incomingUrl = normalizeUrl(incoming.sourceUrl || incoming.exhibitionUrl);
  const existingUrl = normalizeUrl(existing.sourceUrl || existing.exhibitionUrl);
  const incomingTitle = normalizeText(incoming.title);
  const existingTitle = normalizeText(existing.title);
  const incomingVenue = normalizeText(incoming.venue);
  const existingVenue = normalizeText(existing.venue);
  const incomingCity = normalizeText(incoming.city);
  const existingCity = normalizeText(existing.city);
  const sameUrl = Boolean(incomingUrl && existingUrl && incomingUrl === existingUrl);
  const sameTitle = Boolean(incomingTitle && incomingTitle === existingTitle);
  const sameVenue = Boolean(incomingVenue && incomingVenue === existingVenue);
  const sameStartDate = Boolean(incoming.startDate && existing.startDate && incoming.startDate === existing.startDate);
  const sameStartMonth = Boolean(yearMonth(incoming.startDate) && yearMonth(incoming.startDate) === yearMonth(existing.startDate));
  const sameCity = Boolean(incomingCity && existingCity && incomingCity === existingCity);

  if (sameUrl) {
    return {
      confidence: 0.98,
      reasons: ['same normalized source/exhibition URL']
    };
  }

  if (sameTitle && sameVenue && sameStartDate) {
    return {
      confidence: 0.95,
      reasons: ['same normalized title', 'same normalized venue', 'same start date']
    };
  }

  if (sameTitle && sameVenue && sameStartMonth) {
    return {
      confidence: 0.82,
      reasons: ['same normalized title', 'same normalized venue', 'same start month']
    };
  }

  if (sameTitle && sameVenue && sameCity) {
    return {
      confidence: 0.7,
      reasons: ['same normalized title', 'same normalized venue', 'same city']
    };
  }

  return {
    confidence: 0,
    reasons: []
  };
};

export const findDedupeCandidates = (incoming, existingRecords) =>
  existingRecords
    .map((existing) => ({
      record: existing,
      score: dedupeScore(incoming, existing)
    }))
    .filter((candidate) => candidate.score && candidate.score.confidence >= 0.7)
    .sort((a, b) => b.score.confidence - a.score.confidence);

const changedFields = (before, after) => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => stableJson(before?.[key]) !== stableJson(after?.[key])).sort();
};

const exhibitionConflictFields = [
  'title',
  'venue',
  'startDate',
  'endDate',
  'dateText',
  'exhibitionUrl',
  'sourceUrl',
  'city',
  'borough',
  'neighborhood',
  'venueAddress'
];

const pickFields = (record, fields) =>
  fields.reduce((selected, field) => {
    selected[field] = record?.[field] ?? null;
    return selected;
  }, {});

const conflictNotesForUpdate = (update) => {
  if (update?.after?.type !== 'exhibition' || update?.before?.type !== 'exhibition') {
    return null;
  }

  const changed = changedFields(update.before, update.after).filter((field) => exhibitionConflictFields.includes(field));
  if (!changed.length) {
    return null;
  }

  const field = changed.length === 1 ? changed[0] : 'multiple_fields';
  const label = changed.length === 1 ? changed[0] : changed.join(', ');

  return {
    field,
    canonicalValue: pickFields(update.before, changed),
    proposedValue: pickFields(update.after, changed),
    notes: `Official source changed reviewer-sensitive exhibition fields: ${label}. Human review required before canonical data changes.`
  };
};

const stagingSourceForRecord = ({ record, sourceConfig }) => ({
  url: record.sourceUrl || record.parentArtistUrl || sourceConfig.pages?.[0]?.url,
  sourceType: sourceConfig.sourceType || 'other',
  reliability: sourceConfig.reliability || 'unknown',
  parser: sourceConfig.parser,
  notes: sourceConfig.stagingNotes || null
});

const noMatchDedupe = {
  status: 'no_match',
  confidence: 0,
  matchedRecordIds: [],
  notes: 'Compared against existing canonical exhibition records; no likely match found.'
};

const notCheckedDedupe = {
  status: 'not_checked',
  confidence: 0,
  matchedRecordIds: [],
  notes: 'Dedupe is only applied to exhibition records.'
};

const dedupeNotesFor = (candidates) => {
  if (!candidates.length) return noMatchDedupe;

  const best = candidates[0];
  const matchedRecordIds = candidates.map((candidate) => candidate.record.id);
  return {
    status: best.score.confidence >= 0.9 ? 'likely_match' : 'possible_match',
    confidence: best.score.confidence,
    matchedRecordIds,
    notes: `Best match ${best.record.id}: ${best.score.reasons.join('; ')}. Human review required before merging.`
  };
};

const stagedCreate = ({ record, sourceConfig, generatedAt, existingRecords }) => {
  const dedupeCandidates = record.type === 'exhibition' ? findDedupeCandidates(record, existingRecords) : [];
  const dedupe = record.type === 'exhibition' ? dedupeNotesFor(dedupeCandidates) : notCheckedDedupe;
  const proposalType = dedupe.status === 'likely_match' || dedupe.status === 'possible_match' ? 'possibleDuplicate' : 'create';
  const bestMatch = dedupeCandidates[0]?.record || null;

  return {
    id: `stage:${sourceConfig.id}:${record.id}:${proposalType}`,
    proposalType,
    reviewStatus: 'pending',
    source: stagingSourceForRecord({ record, sourceConfig }),
    canonicalId: bestMatch?.id || null,
    before: bestMatch,
    proposed: record,
    changedFields: Object.keys(record).sort(),
    dedupe,
    conflict: null,
    extractedAt: generatedAt,
    reviewerNotes: null
  };
};

const stagedUpdate = ({ update, sourceConfig, generatedAt }) => {
  const fields = changedFields(update.before, update.after);
  const conflict = conflictNotesForUpdate(update);

  return {
    id: `stage:${sourceConfig.id}:${update.after.id}:${conflict ? 'conflict' : 'update'}`,
    proposalType: conflict ? 'conflict' : 'update',
    reviewStatus: 'pending',
    source: stagingSourceForRecord({ record: update.after, sourceConfig }),
    canonicalId: update.before.id,
    before: update.before,
    proposed: update.after,
    changedFields: fields,
    dedupe: {
      status: 'likely_match',
      confidence: 1,
      matchedRecordIds: [update.before.id],
      notes: 'Matched by stable canonical id.'
    },
    conflict,
    extractedAt: generatedAt,
    reviewerNotes: null
  };
};

export const buildStagingReport = ({
  sourceConfig,
  incomingRecords,
  existingRecords,
  sourcePath = defaultSource,
  generatedAt = new Date().toISOString(),
  fetchedPages = null
}) => {
  const diff = diffRecords(existingRecords, incomingRecords);
  const items = [
    ...diff.creates.map((record) => stagedCreate({ record, sourceConfig, generatedAt, existingRecords })),
    ...diff.updates.map((update) => stagedUpdate({ update, sourceConfig, generatedAt }))
  ];
  const creates = items.filter((item) => item.proposalType === 'create').length;
  const updates = items.filter((item) => item.proposalType === 'update').length;
  const possibleDuplicates = items.filter((item) => item.proposalType === 'possibleDuplicate').length;
  const conflicts = items.filter((item) => item.proposalType === 'conflict').length;

  const summary = {
    sourceId: sourceConfig.id,
    source: sourceConfig.source,
    parser: sourceConfig.parser,
    generatedAt,
    stagingNotes: sourceConfig.stagingNotes || null,
    verification: sourceVerificationSummary(sourceConfig),
    pagesFetched: (fetchedPages || sourceConfig.pages || []).length,
    sourcePages: fetchedPages || sourcePagesSummary(sourceConfig, sourcePath),
    incomingRecords: incomingRecords.length,
    creates,
    updates,
    possibleDuplicates,
    conflicts,
    unchanged: diff.unchanged.length,
    incomingByType: summarizeByType(incomingRecords)
  };

  return {
    summary,
    items,
    creates: diff.creates,
    updates: diff.updates,
    unchangedIds: diff.unchanged.map((record) => record.id)
  };
};

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node scripts/exhibit-ingest/ingest.mjs [--source path] [--records path] [--stage] [--output path]');
    return;
  }

  const sourceConfig = await readJson(args.source);
  const recordsDb = await readJson(args.records);
  await validateSourceConfig(sourceConfig);

  const parser = parsers[sourceConfig.parser];

  if (!parser) {
    throw new Error(`No parser registered for ${sourceConfig.parser}`);
  }

  const incomingRecords = [];
  const fetchedPages = [];

  const sourceDir = path.dirname(args.source);

  for (const page of sourceConfig.pages) {
    const { html, url } = await readSourcePage(page, sourceDir);
    fetchedPages.push(summarizeFetchedPage(page, args.source, 'configured'));
    const parsedRecords = parser({
      html,
      url,
      sourceEmail: sourceConfig.sourceEmail
    });
    incomingRecords.push(...parsedRecords);

    if (page.followRecordUrls) {
      const followedPages = parsedRecords
        .map((record) => followPageForRecord(page, record))
        .filter(Boolean)
        .filter((followedPage, index, allPages) => allPages.findIndex((candidate) => candidate.url === followedPage.url) === index);

      for (const followedPage of followedPages) {
        const detailPage = await readSourcePage(followedPage, sourceDir);
          fetchedPages.push(summarizeFetchedPage(followedPage, args.source, 'followed'));
        const detailRecords = parser({
          html: detailPage.html,
          url: detailPage.url,
          sourceEmail: sourceConfig.sourceEmail
        });
        incomingRecords.push(...detailRecords);
      }
    }
  }

  const mergedIncomingRecords = mergeIncomingRecords(incomingRecords);

  const report = buildStagingReport({
    sourceConfig,
    incomingRecords: mergedIncomingRecords,
    existingRecords: recordsDb.records || [],
    sourcePath: args.source,
    fetchedPages
  });
  await validateStagingReport(report);

  if (args.stage) {
    const outputPath = args.output || path.join(defaultStagingDir, `${sourceConfig.id}.json`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, stableJson(report));
    console.log(`Staging report written to ${path.relative(projectRoot, outputPath)}`);
  }

  console.log(stableJson(report.summary));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
