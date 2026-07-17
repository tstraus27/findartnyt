import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMomaExhibitionsPage } from './parsers/moma-exhibitions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const defaultOutput = path.join(__dirname, 'fixtures/moma-exhibitions.browser-refresh.html');

const parseArgs = (argv) => {
  const args = {
    input: null,
    output: defaultOutput,
    minRecords: 25,
    overwrite: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = path.resolve(argv[++i]);
    else if (arg === '--output') args.output = path.resolve(argv[++i]);
    else if (arg === '--min-records') args.minRecords = Number.parseInt(argv[++i], 10);
    else if (arg === '--overwrite') args.overwrite = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeCard = (card) => ({
  url: String(card.url || card.href || card.exhibitionUrl || '').trim(),
  title: String(card.title || '').trim(),
  dateText: String(card.dateText || card.date || '').trim(),
  imageUrl: String(card.imageUrl || card.image || '').trim()
});

const buildFixture = ({ cards, capturedAt }) => {
  const articles = cards
    .map(normalizeCard)
    .filter((card) => card.url && card.title)
    .map(
      (card) => `      <a href="${escapeHtml(card.url)}">
        <h3>
          ${card.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" alt="">\n          ` : ''}<p>${escapeHtml(card.title)}</p>
          <p>${escapeHtml(card.dateText)}</p>
        </h3>
      </a>`
    )
    .join('\n');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>MoMA browser-assisted exhibition snapshot ${capturedAt.slice(0, 10)}</title>
  </head>
  <body>
    <main data-source="browser-assisted-moma-exhibitions" data-captured-at="${capturedAt}">
      <section>
        <h2>Current and upcoming exhibitions</h2>
${articles}
      </section>
    </main>
  </body>
</html>
`;
};

const readCards = async (inputPath) => {
  const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.cards)) return payload.cards;
  throw new Error('Input must be a JSON array of cards or an object with a cards array.');
};

const usage = () => {
  console.log(`Usage:
  node scripts/exhibit-ingest/refresh-moma-fixture.mjs --input /path/to/moma-cards.json --output scripts/exhibit-ingest/fixtures/moma-exhibitions.browser-YYYY-MM-DD.html

Input format:
  [
    {
      "url": "https://www.moma.org/calendar/exhibitions/5906",
      "title": "Architects of Liberation: Modernism in Western Africa",
      "dateText": "Jul 5, 2026-Jan 2, 2027",
      "imageUrl": "https://..."
    }
  ]

Workflow:
  1. Open https://www.moma.org/calendar/exhibitions in a normal browser session.
  2. Let the public page render naturally. Do not bypass checkpoints or rate limits.
  3. Copy only official exhibition card data into the JSON format above.
  4. Run this script to build a compact fixture.
  5. Point scripts/exhibit-ingest/sources/moma-exhibitions.fixture.json at the new fixture only after validation passes.
`);
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    usage();
    if (!args.help) process.exitCode = 1;
    return;
  }

  if (!args.overwrite) {
    try {
      await fs.access(args.output);
      throw new Error(`Refusing to overwrite existing fixture without --overwrite: ${path.relative(projectRoot, args.output)}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  const cards = await readCards(args.input);
  const fixture = buildFixture({ cards, capturedAt: new Date().toISOString() });
  const records = parseMomaExhibitionsPage({ html: fixture, url: 'https://www.moma.org/calendar/exhibitions' });

  if (records.length < args.minRecords) {
    throw new Error(`Refusing to write MoMA fixture with ${records.length} records; minimum is ${args.minRecords}.`);
  }

  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, fixture);
  console.log(`Wrote ${records.length} MoMA records to ${path.relative(projectRoot, args.output)}`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { buildFixture };
