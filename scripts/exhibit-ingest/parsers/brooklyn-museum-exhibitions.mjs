const VENUE = 'Brooklyn Museum';
const VENUE_ADDRESS = '200 Eastern Parkway, Brooklyn, NY 11238';
const NEIGHBORHOOD = 'Prospect Heights';
const BOROUGH = 'Brooklyn';
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
    if (code === 'ndash') return '–';
    if (code === 'mdash') return '—';
    if (code === 'iuml') return 'ï';

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

const monthFromName = (value) => monthNumbers.get(String(value || '').toLowerCase().replace(/\.$/, '')) || null;

const toIsoDate = (monthName, day, year) => {
  const month = monthFromName(monthName);
  if (!month || !day || !year) return null;
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
};

const parseDateText = (value) => {
  const normalized = text(value).replace(/\s*[-–—]\s*/g, '–').replace(/\s+/g, ' ').trim();

  if (!normalized) return { startDate: null, endDate: null, dateText: null };
  if (/^ongoing$/i.test(normalized)) return { startDate: null, endDate: null, dateText: normalized };

  const range = normalized.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})–([A-Za-z]+) (\d{1,2}), (\d{4})$/i);
  if (range) {
    return {
      startDate: toIsoDate(range[1], range[2], range[3]),
      endDate: toIsoDate(range[4], range[5], range[6]),
      dateText: normalized
    };
  }

  return { startDate: null, endDate: null, dateText: normalized };
};

const firstMatch = (html, pattern) => String(html || '').match(pattern)?.[1] || null;
const extractArticles = (html) => String(html || '').match(/<article\b[\s\S]*?<\/article>/gi) || [];

const parseArticle = ({ articleHtml, pageUrl }) => {
  const href = firstMatch(articleHtml, /<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  const exhibitionUrl = absoluteUrl(href, pageUrl);
  const title = text(firstMatch(articleHtml, /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i));
  const dateText = text(firstMatch(articleHtml, /<p\b[^>]*class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
  const imageUrl = absoluteUrl(firstMatch(articleHtml, /<img\b[^>]*src=["']([^"']+)["'][^>]*>/i), pageUrl);

  if (!title || !exhibitionUrl) return null;

  const dateInfo = parseDateText(dateText);

  return {
    id: `exhibition:brooklyn-museum:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'brooklyn-museum',
    title,
    venue: VENUE,
    startDate: dateInfo.startDate,
    endDate: dateInfo.endDate,
    dateText: dateInfo.dateText,
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
    tags: ['browser-assisted-snapshot', 'included-in-general-admission'],
    sourceConfidence: 'medium',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from a browser-assisted compact snapshot of the Brooklyn Museum official exhibitions page because direct backend fetch returns Vercel 429. Permanent collection galleries, museum spotlights, touring pages, and past exhibitions are out of scope for this first staging slice.'
  };
};

export const parseBrooklynMuseumExhibitionsPage = ({ html, url }) => {
  const records = new Map();

  for (const articleHtml of extractArticles(html)) {
    const record = parseArticle({ articleHtml, pageUrl: url });
    if (record && !records.has(record.exhibitionUrl)) {
      records.set(record.exhibitionUrl, record);
    }
  }

  return [...records.values()];
};
