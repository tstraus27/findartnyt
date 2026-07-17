import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApprovalPlan } from './approve-staging.mjs';
import { audit as auditMet } from './audit-met.mjs';
import { stableJson } from './ingest.mjs';
import { pruneClosedStagingDirectory, pruneClosedStagingFile, todayLocalDate } from './prune-closed-staging.mjs';
import { validateStagingReport } from './schema-validation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const stagingDir = path.join(projectRoot, 'data/staging');
const defaultStaging = path.join(projectRoot, 'data/staging/poster-house-exhibitions.json');
const defaultRecords = path.join(projectRoot, 'data/exhibit-records.json');
const defaultMetSource = path.join(__dirname, 'sources/met-exhibitions.fixture.json');
const defaultMetRegistry = path.join(__dirname, 'sources/met-required-exhibitions.json');
const reviewStatuses = new Set(['pending', 'approved', 'rejected', 'needs_revision']);
const defaultPromotionAudits = {
  'met-exhibitions': async ({ stagingFile }) =>
    auditMet({
      stagingPath: stagingFile,
      sourcePath: defaultMetSource,
      registryPath: defaultMetRegistry
    })
};

const parseArgs = (argv) => {
  const args = {
    host: '127.0.0.1',
    port: 8765,
    staging: defaultStaging,
    records: defaultRecords
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--staging') args.staging = path.resolve(argv[++i]);
    else if (arg === '--records') args.records = path.resolve(argv[++i]);
    else if (arg === '--host') args.host = argv[++i];
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const stagingSlug = (stagingFile) => path.basename(stagingFile, '.json');

const sourceHref = ({ source, index = 0, message = '' }) => {
  const params = new URLSearchParams({ source, index: String(index) });
  if (message) params.set('message', message);
  return `/?${params.toString()}`;
};

const writeStagingReport = async (file, report) => {
  await validateStagingReport(report);
  await fs.writeFile(file, stableJson(report));
};

const loadReport = async (stagingFile) => {
  const report = await readJson(stagingFile);
  await validateStagingReport(report);
  return report;
};

const pruneClosedForReview = async (stagingFile) => {
  const result = await pruneClosedStagingFile({ stagingFile });
  return result.removedItems.length;
};

export const listStagingReports = async ({ selectedFile = defaultStaging } = {}) => {
  const entries = await fs.readdir(stagingDir, { withFileTypes: true });
  const summaries = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.live.json')) continue;

    const file = path.join(stagingDir, entry.name);
    let report;
    try {
      report = await loadReport(file);
    } catch {
      continue;
    }
    if (!isExhibitionReviewReport(report)) continue;
    const items = report.items || [];
    const counts = statusCounts(items);
    const source = stagingSlug(file);
    summaries.push({
      source,
      file,
      label: report.summary?.source || report.summary?.sourceId || source,
      pending: (counts.pending || 0) + (counts.needs_revision || 0),
      approved: counts.approved || 0,
      rejected: counts.rejected || 0,
      total: items.length,
      selected: path.resolve(file) === path.resolve(selectedFile),
      legacy: items.some((item) => item.proposed?.type && item.proposed.type !== 'exhibition')
    });
  }

  return summaries.sort((left, right) => {
    if (right.pending !== left.pending) return right.pending - left.pending;
    return left.label.localeCompare(right.label);
  });
};

const resolveStagingFile = async (source, fallbackFile = defaultStaging) => {
  if (!source) return fallbackFile;
  const candidate = path.resolve(stagingDir, `${source}.json`);
  const relative = path.relative(stagingDir, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Invalid source: ${source}`);
  await fs.access(candidate);
  return candidate;
};

const pendingQueue = (report) =>
  (report.items || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.reviewStatus === 'pending' || item.reviewStatus === 'needs_revision');

const clampIndex = (index, length) => {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
};

const parseIndex = (url) => {
  const raw = url.searchParams.get('index') || '0';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const escapeAttr = escapeHtml;

const formatDateRange = (startDate, endDate, dateText) => {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `Starts ${startDate}`;
  if (endDate) return `Ends ${endDate}`;
  return dateText || 'No exact dates';
};

const itemUrl = (item) => item.proposed?.sourceUrl || item.proposed?.exhibitionUrl || item.source?.url || '';

const statusCounts = (items = []) =>
  items.reduce((counts, item) => {
    counts[item.reviewStatus] = (counts[item.reviewStatus] || 0) + 1;
    return counts;
  }, {});

const isExhibitionReviewReport = (report) =>
  (report.items || []).some((item) => item.proposed?.type === 'exhibition') ||
  Boolean(report.summary?.incomingByType?.exhibition);

export const previewFallbackReason = ({ status = 200, html = '' } = {}) => {
  const normalized = String(html || '').toLowerCase();
  const verificationSignals = [
    'failed to verify your browser',
    'browser verification',
    'vercel security checkpoint',
    'security checkpoint',
    'code 99'
  ];

  if (verificationSignals.some((signal) => normalized.includes(signal))) {
    return 'The embedded preview fetched a browser verification page instead of the exhibition page.';
  }

  if ([401, 403, 429].includes(status) && normalized.includes('verify')) {
    return 'The embedded preview was blocked by browser verification.';
  }

  return null;
};

const renderPreviewFallback = (url, reason = '') => {
  if (!url) return '<div class="empty-preview">No source URL available for this item.</div>';

  return `
    <div class="preview-fallback">
      <h2>Source preview unavailable</h2>
      <p>${escapeHtml(reason || 'This source cannot be embedded in the review pane.')}</p>
      <p>Use the official page in your browser to review the record.</p>
      <a class="preview-fallback-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Open official source</a>
    </div>
  `;
};

const renderSourcePreview = (url) => {
  if (!url) return renderPreviewFallback('');

  const previewSrc = `/preview?url=${encodeURIComponent(url)}`;
  return `<iframe class="site-frame" src="${escapeAttr(previewSrc)}" title="Source website preview"></iframe>`;
};

export const applyReviewStatus = async ({ stagingFile, itemId, status }) => {
  if (!reviewStatuses.has(status)) throw new Error(`Unsupported review status: ${status}`);
  const report = await loadReport(stagingFile);
  const item = (report.items || []).find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Could not find staged item: ${itemId}`);

  item.reviewStatus = status;
  if (item.proposed?.reviewStatus) {
    item.proposed.reviewStatus = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'needs_review';
  }

  await writeStagingReport(stagingFile, report);
  return report;
};

const sourceAuditKey = (report) => report.summary?.sourceId || report.summary?.source || null;

const assertPromotionAllowed = async ({ stagingFile, report, sourceAudits = defaultPromotionAudits }) => {
  const auditKey = sourceAuditKey(report);
  const audit = auditKey ? sourceAudits[auditKey] : null;
  if (!audit) return;

  const result = await audit({ stagingFile, report });
  if (result.ok) return;

  const details = [...(result.problems || []), ...(result.warnings || [])].filter(Boolean).join(' ');
  throw new Error(
    `${result.label || auditKey} approval blocked: source audit failed. Refresh fixture and rerun audit before approving.${
      details ? ` ${details}` : ''
    }`
  );
};

export const applyReviewDecision = async ({
  stagingFile,
  recordsFile = defaultRecords,
  itemId,
  status,
  sourceAudits = defaultPromotionAudits
}) => {
  if (status !== 'approved') {
    const report = await applyReviewStatus({ stagingFile, itemId, status });
    return {
      report,
      promotion: {
        attempted: false,
        approvedCreates: 0,
        promoted: 0,
        skipped: 0,
        skippedDetails: []
      }
    };
  }

  const initialReport = await loadReport(stagingFile);
  if (status === 'approved') {
    await assertPromotionAllowed({ stagingFile, report: initialReport, sourceAudits });
  }

  const recordsDb = await readJson(recordsFile);
  const clickedItem = (initialReport.items || []).find((item) => item.id === itemId);
  if (!clickedItem) throw new Error(`Could not find staged item: ${itemId}`);
  const clickedItemReport = {
    ...initialReport,
    items: [
      {
        ...clickedItem,
        reviewStatus: 'approved',
        proposed: clickedItem.proposed
          ? {
              ...clickedItem.proposed,
              reviewStatus: 'approved'
            }
          : clickedItem.proposed
      }
    ]
  };
  const plan = await buildApprovalPlan({ stagingReport: clickedItemReport, recordsDb });

  if (!plan.promoted.length && plan.skipped.length) {
    const report = await applyReviewStatus({ stagingFile, itemId, status: 'needs_revision' });
    return {
      report,
      promotion: {
        attempted: true,
        approvedCreates: plan.approvedCreates,
        promoted: 0,
        skipped: plan.skipped.length,
        skippedDetails: plan.skipped
      }
    };
  }

  const report = await applyReviewStatus({ stagingFile, itemId, status });
  await fs.writeFile(recordsFile, stableJson({ records: plan.records }));

  return {
    report,
    promotion: {
      attempted: true,
      approvedCreates: plan.approvedCreates,
      promoted: plan.promoted.length,
      skipped: plan.skipped.length,
      skippedDetails: plan.skipped
    }
  };
};

const renderSourceList = (sources) =>
  sources
    .map((source) => {
      const active = source.selected ? ' active' : '';
      const needs = source.pending > 0 ? ' needs-review' : ' reviewed';
      return `
        <a class="source-item${active}${needs}" href="${sourceHref({ source: source.source })}">
          <span class="source-title">${escapeHtml(source.label)}</span>
          <span class="source-counts">
            <strong>${source.pending}</strong> need review
            <span>${source.approved} approved</span>
            <span>${source.rejected} rejected</span>
          </span>
        </a>
      `;
    })
    .join('');

const renderQueueList = (queue, activeIndex, source) =>
  queue
    .map(({ item }, index) => {
      const proposed = item.proposed || {};
      const active = index === activeIndex ? ' active' : '';
      return `
        <a class="queue-item${active}" href="${sourceHref({ source, index })}">
          <span class="queue-title">${escapeHtml(proposed.title || item.id)}</span>
          <span class="queue-meta">${escapeHtml(proposed.venue || 'Unknown venue')}</span>
        </a>
      `;
    })
    .join('');

const renderFact = (label, value) => `
  <div class="fact">
    <dt>${escapeHtml(label)}</dt>
    <dd>${escapeHtml(value || 'n/a')}</dd>
  </div>
`;

const renderPage = ({ report, stagingFile, sources, index, message = '' }) => {
  const items = report.items || [];
  const queue = pendingQueue(report);
  const counts = statusCounts(items);
  const safeIndex = clampIndex(index, queue.length);
  const relativeStaging = path.relative(projectRoot, stagingFile);
  const source = stagingSlug(stagingFile);
  const sourceName = report.summary?.source || report.summary?.sourceId || path.basename(stagingFile, '.json');
  const messageHtml = message ? `<div class="message">${escapeHtml(message)}</div>` : '';
  const countsText = `Pending ${counts.pending || 0} / Approved ${counts.approved || 0} / Rejected ${counts.rejected || 0}`;

  if (!queue.length) {
    return layout(`
      <div class="app-shell empty-shell">
        <aside class="source-rail">
          ${railHeader()}
          <nav class="source-list">${renderSourceList(sources)}</nav>
        </aside>
        <main class="empty">
          ${messageHtml}
          <h1>Review queue is clear</h1>
          <p>No pending items remain in <code>${escapeHtml(relativeStaging)}</code>.</p>
          <p>${escapeHtml(countsText)}</p>
        </main>
      </div>
    `);
  }

  const { item } = queue[safeIndex];
  const proposed = item.proposed || {};
  const url = itemUrl(item);
  const prevHref = sourceHref({ source, index: Math.max(0, safeIndex - 1) });
  const nextHref = sourceHref({ source, index: Math.min(queue.length - 1, safeIndex + 1) });

  return layout(`
    <div class="app-shell">
      <aside class="source-rail">
        ${railHeader()}
        <nav class="source-list">${renderSourceList(sources)}</nav>
      </aside>

      <aside class="queue-rail">
        <div class="rail-header">
          <div>
            <div class="eyebrow">Selected Source</div>
            <h2>${escapeHtml(sourceName)}</h2>
          </div>
          <div class="rail-count">${queue.length} pending</div>
        </div>
        <div class="file-path">${escapeHtml(relativeStaging)}</div>
        <nav class="queue-list">${renderQueueList(queue, safeIndex, source)}</nav>
      </aside>

      <section class="proposal-pane">
        ${messageHtml}
        <div class="meta-row">
          <span>${escapeHtml(countsText)}</span>
          <span>Item ${safeIndex + 1} of ${queue.length}</span>
        </div>
        <h1>${escapeHtml(proposed.title || 'Untitled proposal')}</h1>
        <div class="nav-row">
          <a href="${prevHref}">Previous</a>
          <a href="${nextHref}">Next</a>
        </div>
        <dl class="facts">
          ${renderFact('Venue', proposed.venue)}
          ${renderFact('Dates', formatDateRange(proposed.startDate, proposed.endDate, proposed.dateText))}
          ${renderFact('Status Tags', Array.isArray(proposed.tags) ? proposed.tags.join(', ') : '')}
          ${renderFact('Address', proposed.venueAddress)}
          ${renderFact('Source', item.source?.sourceType || '')}
        </dl>
        ${proposed.imageUrl ? `<img class="preview-image" src="${escapeAttr(proposed.imageUrl)}" alt="">` : ''}
        ${proposed.description ? `<div class="description">${escapeHtml(proposed.description)}</div>` : ''}
        ${url ? `<a class="source-link" href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Open source in browser</a>` : ''}
        <div class="action-row">
          ${decisionForm(item.id, safeIndex, source, 'approved', 'Approve', 'btn-approve')}
          ${decisionForm(item.id, safeIndex, source, 'rejected', 'Reject', 'btn-reject')}
          ${decisionForm(item.id, safeIndex, source, 'needs_revision', 'Needs Revision', 'btn-secondary')}
        </div>
        <p class="safety-note">Approve writes eligible create proposals to the canonical public backend database. Reject and Needs Revision only update this staging file.</p>
      </section>

      <section class="site-pane">
        <div class="site-header">
          <strong>Source Website</strong>
          ${url ? `<span>${escapeHtml(url)}</span>` : '<span>No source URL</span>'}
        </div>
        ${renderSourcePreview(url)}
      </section>
    </div>
  `);
};

const railHeader = () => `
  <div class="rail-header source-rail-header">
    <div>
      <div class="eyebrow">Institutions</div>
      <h2>Review Dashboard</h2>
    </div>
  </div>
  <div class="file-path">Pick a dataset. Sources with a colored stripe still need review.</div>
`;

const decisionForm = (itemId, index, source, status, label, className) => `
  <form method="post" action="/decision">
    <input type="hidden" name="itemId" value="${escapeAttr(itemId)}">
    <input type="hidden" name="status" value="${escapeAttr(status)}">
    <input type="hidden" name="index" value="${index}">
    <input type="hidden" name="source" value="${escapeAttr(source)}">
    <button class="btn ${className}" type="submit">${escapeHtml(label)}</button>
  </form>
`;

const layout = (body) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Exhibition Review</title>
    <style>
      :root {
        --bg: #f6f7f8;
        --panel: #ffffff;
        --text: #1f2933;
        --muted: #64707d;
        --border: #d9dee5;
        --green: #217a4b;
        --green-strong: #17633b;
        --red: #b3261e;
        --red-strong: #8f1c17;
        --blue: #2457c5;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); }
      .app-shell { display: grid; grid-template-columns: 260px 260px minmax(360px, 460px) 1fr; min-height: 100vh; }
      .empty-shell { grid-template-columns: 300px 1fr; }
      .source-rail, .queue-rail, .proposal-pane, .site-pane { min-height: 100vh; }
      .source-rail { background: #f8fafb; border-right: 1px solid var(--border); padding: 16px; overflow: auto; }
      .queue-rail { background: #eef1f4; border-right: 1px solid var(--border); padding: 16px; overflow: auto; }
      .proposal-pane { background: var(--panel); border-right: 1px solid var(--border); padding: 22px; overflow: auto; }
      .site-pane { background: #fff; display: flex; flex-direction: column; min-width: 0; }
      .rail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .eyebrow { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: .04em; }
      h1 { font-size: 28px; line-height: 1.1; margin: 12px 0 12px; }
      h2 { font-size: 17px; margin: 3px 0 0; }
      .rail-count, .file-path, .meta-row, .safety-note, .site-header span { color: var(--muted); font-size: 12px; }
      .file-path { margin: 12px 0 16px; word-break: break-word; }
      .source-list, .queue-list { display: flex; flex-direction: column; gap: 8px; }
      .source-item { display: block; color: inherit; text-decoration: none; background: #fff; border: 1px solid var(--border); border-left: 5px solid #9aa4b2; border-radius: 8px; padding: 10px; }
      .source-item.needs-review { border-left-color: var(--red); }
      .source-item.reviewed { border-left-color: var(--green); }
      .source-item.active { border-color: var(--blue); border-left-color: var(--blue); box-shadow: 0 1px 6px rgba(20,30,40,.12); }
      .source-title { display: block; font-size: 13px; font-weight: 800; line-height: 1.25; text-transform: capitalize; }
      .source-counts { display: grid; gap: 3px; color: var(--muted); font-size: 12px; margin-top: 6px; }
      .source-counts strong { color: var(--text); }
      .queue-item { display: block; color: inherit; text-decoration: none; background: rgba(255,255,255,.62); border: 1px solid transparent; border-radius: 8px; padding: 10px; }
      .queue-item.active { background: #fff; border-color: var(--blue); box-shadow: 0 1px 4px rgba(20,30,40,.08); }
      .queue-title { display: block; font-size: 13px; font-weight: 700; line-height: 1.25; }
      .queue-meta { display: block; color: var(--muted); font-size: 12px; margin-top: 4px; }
      .meta-row, .nav-row, .action-row, .site-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .meta-row { justify-content: space-between; }
      .nav-row a, .source-link { color: var(--blue); font-size: 13px; font-weight: 700; text-decoration: none; }
      .facts { display: grid; gap: 10px; margin: 20px 0; }
      .fact { border-top: 1px solid var(--border); padding-top: 9px; }
      dt { color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      dd { margin: 3px 0 0; line-height: 1.35; }
      .preview-image { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 14px; }
      .description { white-space: pre-wrap; line-height: 1.45; font-size: 14px; color: #34404c; max-height: 260px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 14px; }
      .action-row { margin-top: 20px; }
      .btn { border: 0; border-radius: 8px; color: #fff; cursor: pointer; font-weight: 800; font-size: 14px; padding: 11px 16px; }
      .btn-approve { background: var(--green); }
      .btn-reject { background: var(--red); }
      .btn-secondary { background: #687384; }
      .message { border: 1px solid #b9d5ff; background: #eef5ff; color: #174ea6; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 13px; }
      .site-header { justify-content: space-between; min-height: 48px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: #f9fafb; }
      .site-header span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; }
      .site-frame { border: 0; width: 100%; flex: 1; background: #fff; }
      .empty, .empty-preview, .preview-fallback { padding: 40px; }
      .preview-fallback { max-width: 620px; }
      .preview-fallback h2 { font-size: 20px; margin: 0 0 10px; }
      .preview-fallback p { color: var(--muted); line-height: 1.45; margin: 0 0 10px; }
      .preview-fallback-link { display: inline-block; margin-top: 8px; color: var(--blue); font-weight: 800; text-decoration: none; }
      code { background: #eef1f4; padding: 2px 5px; border-radius: 5px; }
      @media (max-width: 1050px) {
        .app-shell { grid-template-columns: 220px 1fr; }
        .source-rail { grid-column: 1 / -1; min-height: auto; border-bottom: 1px solid var(--border); }
        .source-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
        .site-pane { grid-column: 1 / -1; min-height: 70vh; border-top: 1px solid var(--border); }
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;

const parseForm = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
};

const proxyPreview = async (response, rawUrl) => {
  if (!rawUrl) {
    sendHtml(response, '<p>No preview URL.</p>');
    return;
  }

  let target;
  try {
    target = new URL(rawUrl);
    if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only http and https URLs can be previewed.');
  } catch (error) {
    sendHtml(response, `<p>Invalid preview URL: ${escapeHtml(error.message)}</p>`);
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 ExhibitionReviewUI/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    const text = await upstream.text();
    const fallbackReason = previewFallbackReason({ status: upstream.status, html: text });
    if (fallbackReason) {
      sendHtml(response, layout(renderPreviewFallback(rawUrl, fallbackReason)));
      return;
    }

    const base = `<base href="${escapeAttr(upstream.url)}">`;
    const withBase = text.includes('<head') ? text.replace(/<head([^>]*)>/i, `<head$1>${base}`) : `${base}${text}`;
    sendHtml(response, withBase);
  } catch (error) {
    sendHtml(
      response,
      `<div style="font-family: sans-serif; padding: 24px;"><h1>Preview unavailable</h1><p>${escapeHtml(error.message)}</p><p><a href="${escapeAttr(rawUrl)}" target="_blank">Open source in browser</a></p></div>`
    );
  }
};

const sendHtml = (response, html, status = 200) => {
  const body = Buffer.from(html);
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length
  });
  response.end(body);
};

const redirect = (response, location) => {
  response.writeHead(303, { Location: location });
  response.end();
};

export const createReviewUiServer = ({ stagingFile, recordsFile = defaultRecords }) =>
  http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/') {
        const activeFile = await resolveStagingFile(url.searchParams.get('source'), stagingFile);
        await pruneClosedForReview(activeFile);
        const report = await loadReport(activeFile);
        const sources = await listStagingReports({ selectedFile: activeFile });
        sendHtml(
          response,
          renderPage({
            report,
            stagingFile: activeFile,
            sources,
            index: parseIndex(url),
            message: url.searchParams.get('message') || ''
          })
        );
        return;
      }

      if (request.method === 'GET' && url.pathname === '/preview') {
        await proxyPreview(response, url.searchParams.get('url') || '');
        return;
      }

      if (request.method === 'POST' && url.pathname === '/decision') {
        const form = await parseForm(request);
        const itemId = form.get('itemId') || '';
        const status = form.get('status') || '';
        const source = form.get('source') || '';
        const index = Number.parseInt(form.get('index') || '0', 10);
        const activeFile = await resolveStagingFile(source, stagingFile);
        const { report, promotion } = await applyReviewDecision({ stagingFile: activeFile, recordsFile, itemId, status });
        const nextIndex = clampIndex(index, pendingQueue(report).length);
        const label =
          status === 'approved'
            ? promotion.promoted > 0
              ? `Approved. Promoted ${promotion.promoted} record(s) to canonical data.`
              : `Needs revision. Could not promote: ${
                  promotion.skippedDetails[0]?.reason || 'record did not meet canonical requirements'
                }`
            : status === 'rejected'
              ? 'Rejected.'
              : 'Marked needs revision.';
        redirect(response, sourceHref({ source: stagingSlug(activeFile), index: nextIndex, message: label }));
        return;
      }

      sendHtml(response, '<h1>Not found</h1>', 404);
    } catch (error) {
      sendHtml(response, `<h1>Review UI error</h1><pre>${escapeHtml(error.stack || error.message)}</pre>`, 500);
    }
  });

export const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      'Usage: node scripts/exhibit-ingest/review-ui.mjs [--staging path] [--records path] [--host 127.0.0.1] [--port 8765]'
    );
    return;
  }

  const pruneResults = await pruneClosedStagingDirectory({ stagingDir, asOfDate: todayLocalDate() });
  const prunedCount = pruneResults.reduce((count, result) => count + result.removedItems.length, 0);
  await loadReport(args.staging);
  const server = createReviewUiServer({ stagingFile: args.staging, recordsFile: args.records });
  server.listen(args.port, args.host, () => {
    console.log(`Review UI running at http://${args.host}:${args.port}`);
    console.log(`Staging file: ${path.relative(projectRoot, args.staging)}`);
    console.log(`Canonical records file: ${path.relative(projectRoot, args.records)}`);
    console.log(`Closed staging items pruned on startup: ${prunedCount}`);
    console.log('Press Ctrl+C to stop.');
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
