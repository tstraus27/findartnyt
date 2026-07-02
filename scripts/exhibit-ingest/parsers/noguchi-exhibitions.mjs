const VENUE = 'The Noguchi Museum';
const VENUE_ADDRESS = '9-01 33rd Road, Long Island City, NY 11106';
const NEIGHBORHOOD = 'Long Island City';
const BOROUGH = 'Queens';
const CITY = 'New York';

const monthNumbers = new Map([
  ['jan', '01'],
  ['january', '01'],
  ['feb', '02'],
  ['february', '02'],
  ['mar', '03'],
  ['march', '03'],
  ['apr', '04'],
  ['april', '04'],
  ['may', '05'],
  ['jun', '06'],
  ['june', '06'],
  ['jul', '07'],
  ['july', '07'],
  ['aug', '08'],
  ['august', '08'],
  ['sep', '09'],
  ['sept', '09'],
  ['september', '09'],
  ['oct', '10'],
  ['october', '10'],
  ['nov', '11'],
  ['november', '11'],
  ['dec', '12'],
  ['december', '12']
]);

const decodeHtmlEntities = (value) =>
  String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
    const code = rawCode.toLowerCase();

    if (code === 'amp') return '&';
    if (code === 'lt') return '<';
    if (code === 'gt') return '>';
    if (code === 'quot') return '"';
    if (code === 'apos' || code === '#39') return "'";
    if (code === 'nbsp') return ' ';
    if (code === 'rsquo') return '’';
    if (code === 'lsquo') return '‘';
    if (code === 'ldquo') return '“';
    if (code === 'rdquo') return '”';
    if (code === 'ndash') return '–';
    if (code === 'mdash') return '—';

    if (code.startsWith('#x')) {
      const parsed = Number.parseInt(code.slice(2), 16);
      return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed);
    }

    if (code.startsWith('#')) {
      const parsed = Number.parseInt(code.slice(1), 10);
      return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed);
    }

    return entity;
  });

const text = (value) =>
  decodeHtmlEntities(
    String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

const absoluteUrl = (value, baseUrl) => {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
};

const slugFromUrl = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) || 'unknown');
  } catch {
    return 'unknown';
  }
};

const monthFromName = (value) =>
  monthNumbers.get(String(value || '').toLowerCase().replace(/\.$/, '')) || null;

const toIsoDate = (monthName, day, year) => {
  const month = monthFromName(monthName);
  if (!month || !day || !year) return null;
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
};

const parseDateText = (value) => {
  const normalized = text(value).replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return {
      startDate: null,
      endDate: null,
      dateText: null
    };
  }

  const sameYearRange = normalized.match(
    /^From\s+([A-Za-z.]+)\s+(\d{1,2})\s+to\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
  );
  if (sameYearRange) {
    return {
      startDate: toIsoDate(sameYearRange[1], sameYearRange[2], sameYearRange[5]),
      endDate: toIsoDate(sameYearRange[3], sameYearRange[4], sameYearRange[5]),
      dateText: normalized
    };
  }

  const explicitYearRange = normalized.match(
    /^From\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s+to\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
  );
  if (explicitYearRange) {
    return {
      startDate: toIsoDate(explicitYearRange[1], explicitYearRange[2], explicitYearRange[3]),
      endDate: toIsoDate(explicitYearRange[4], explicitYearRange[5], explicitYearRange[6]),
      dateText: normalized
    };
  }

  return {
    startDate: null,
    endDate: null,
    dateText: normalized
  };
};

const firstSrcsetUrl = (value, baseUrl) => {
  const firstCandidate = String(value || '')
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .find(Boolean);

  return absoluteUrl(firstCandidate, baseUrl);
};

const inferTags = ({ startDate, referenceDate = new Date().toISOString().slice(0, 10) }) => {
  if (startDate && startDate > referenceDate) {
    return ['upcoming'];
  }

  return ['current'];
};

const buildRecord = ({ title, exhibitionUrl, imageUrl, dateText }) => {
  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);

  return {
    id: `exhibition:noguchi:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'noguchi',
    title,
    venue: VENUE,
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    dateText: parsedDates.dateText,
    description: null,
    artists: [],
    curators: [],
    venueAddress: VENUE_ADDRESS,
    neighborhood: NEIGHBORHOOD,
    borough: BOROUGH,
    city: CITY,
    imageUrl,
    exhibitionUrl,
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: inferTags(parsedDates),
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Noguchi Museum official Current & Upcoming exhibitions page listing cards before the first explicit offsite entry. Desktop/mobile duplicates are deduped by exhibition URL, and offsite listings plus any detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

const extractScopeHtml = (html) => {
  const gridStart = html.indexOf('<div class="grid-exhibitions">');
  if (gridStart === -1) return '';

  const afterGrid = html.slice(gridStart);
  const firstOffsiteIndex = afterGrid.search(/<div class="eyebrow">\s*offsite:/i);
  return firstOffsiteIndex === -1 ? afterGrid : afterGrid.slice(0, firstOffsiteIndex);
};

const itemPattern = /<div class="item[\s\S]*?(?=<div class="item|$)/gi;

const parseItem = (itemHtml, baseUrl) => {
  const exhibitionUrl = absoluteUrl(itemHtml.match(/<div class="block-quarter headline title"><a href="([^"]+)"/i)?.[1], baseUrl);
  const title = text(itemHtml.match(/<div class="block-quarter headline title"><a [^>]+>([\s\S]*?)<\/a>/i)?.[1]);
  const dateText = text(itemHtml.match(/<div class="subheadline text-gray date"><a [^>]+>([\s\S]*?)<\/a>/i)?.[1]);
  const imageUrl = firstSrcsetUrl(itemHtml.match(/<img[^>]+data-srcset="([^"]+)"/i)?.[1], baseUrl);

  return buildRecord({
    title,
    exhibitionUrl,
    imageUrl,
    dateText
  });
};

export const parseNoguchiExhibitionsPage = ({ html, url }) => {
  const scopeHtml = extractScopeHtml(html);
  const records = new Map();

  for (const match of scopeHtml.matchAll(itemPattern)) {
    const record = parseItem(match[0], url);

    if (record && !records.has(record.exhibitionUrl)) {
      records.set(record.exhibitionUrl, record);
    }
  }

  return [...records.values()];
};
