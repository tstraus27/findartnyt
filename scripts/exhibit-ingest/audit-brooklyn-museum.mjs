import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditBrowserFixtureSource, printAuditReport } from './audit-browser-fixture-source.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const parseArgs = (argv) => {
  const args = {
    staging: path.join(projectRoot, 'data/staging/brooklyn-museum-exhibitions.json'),
    source: path.join(__dirname, 'sources/brooklyn-museum-exhibitions.fixture.json'),
    registry: path.join(__dirname, 'sources/brooklyn-museum-required-exhibitions.json'),
    allowStale: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--staging') args.staging = path.resolve(argv[++i]);
    else if (arg === '--source') args.source = path.resolve(argv[++i]);
    else if (arg === '--registry') args.registry = path.resolve(argv[++i]);
    else if (arg === '--allow-stale') args.allowStale = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node scripts/exhibit-ingest/audit-brooklyn-museum.mjs [--staging path] [--source path] [--registry path] [--allow-stale]'
    );
    return;
  }

  const report = await auditBrowserFixtureSource({
    label: 'Brooklyn Museum',
    listingUrl: 'https://www.brooklynmuseum.org/exhibitions',
    stagingPath: args.staging,
    sourcePath: args.source,
    registryPath: args.registry,
    allowStale: args.allowStale
  });
  printAuditReport(report);
  if (!report.ok) process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
