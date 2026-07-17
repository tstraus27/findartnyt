import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const formatDateRange = (record) => {
  const explicit = clean(record.dateText);
  if (explicit) return explicit;
  if (record.startDate && record.endDate) return `${record.startDate} - ${record.endDate}`;
  if (record.startDate) return `${record.startDate} - Ongoing`;
  if (record.endDate) return `Through ${record.endDate}`;
  return 'Dates listed at source';
};

const normalizePublicRecords = ({ readiness, canonical }) => {
  const canonicalById = new Map((canonical.records || []).map((record) => [record.id, record]));

  return (readiness.launchReadyRecords || [])
    .map((launchRecord) => {
      const canonicalRecord = canonicalById.get(launchRecord.id) || {};
      const id = clean(launchRecord.id) || clean(canonicalRecord.id);
      const title = clean(launchRecord.title) || clean(canonicalRecord.title);
      const venue = clean(launchRecord.venue) || clean(canonicalRecord.venue);
      const sourceUrl = clean(launchRecord.sourceUrl) || clean(canonicalRecord.sourceUrl) || clean(canonicalRecord.exhibitionUrl);

      if (!id || !title || !venue || !sourceUrl) return null;

      const startDate = clean(launchRecord.startDate) || clean(canonicalRecord.startDate);
      const endDate = clean(launchRecord.endDate) || clean(canonicalRecord.endDate);

      return {
        id,
        title,
        venue,
        source: clean(launchRecord.source) || clean(canonicalRecord.source) || venue,
        startDate,
        endDate,
        dateText: formatDateRange({
          startDate,
          endDate,
          dateText: clean(launchRecord.dateText) || clean(canonicalRecord.dateText)
        }),
        description: clean(canonicalRecord.description),
        venueAddress: clean(canonicalRecord.venueAddress),
        neighborhood: clean(canonicalRecord.neighborhood),
        borough: clean(canonicalRecord.borough),
        city: clean(canonicalRecord.city),
        imageUrl: clean(canonicalRecord.imageUrl),
        sourceUrl
      };
    })
    .filter(Boolean);
};

const run = async () => {
  const readiness = await readJson(path.join(projectRoot, 'data/public-launch-readiness.json'));
  const canonical = await readJson(path.join(projectRoot, 'data/exhibit-records.json'));
  const publicRecords = normalizePublicRecords({ readiness, canonical });
  const output = {
    generatedAt: new Date().toISOString(),
    source: 'data/public-launch-readiness.json launchReadyRecords merged with data/exhibit-records.json by id',
    publicRule: readiness.publicRule,
    records: publicRecords
  };

  const publicDir = path.join(projectRoot, 'public');
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'data.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote public/data.json with ${publicRecords.length} public records.`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
