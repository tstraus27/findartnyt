const VENUE = 'The Metropolitan Museum of Art';
const VENUE_ADDRESS = '1000 Fifth Avenue, New York, NY 10028';
const NEIGHBORHOOD = 'Upper East Side';
const BOROUGH = 'Manhattan';
const CITY = 'New York';
const DEFAULT_YEAR = '2026';

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
  ['december', '12'],
  ['spring', '03'],
  ['summer', '06'],
  ['fall', '09'],
  ['winter', '12']
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
    if (code === 'ndash') return '-';
    if (code === 'mdash') return '-';

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
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) || 'unknown';
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
  const normalized = text(value).replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, ' ').trim();

  if (!normalized || /^ongoing$/i.test(normalized)) {
    return {
      startDate: null,
      endDate: null,
      dateText: normalized || null
    };
  }

  const through = normalized.match(/^Through ([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?$/i);
  if (through) {
    return {
      startDate: null,
      endDate: toIsoDate(through[1], through[2], through[3] || DEFAULT_YEAR),
      dateText: normalized
    };
  }

  const openEnded = normalized.match(/^([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?-Ongoing$/i);
  if (openEnded) {
    return {
      startDate: toIsoDate(openEnded[1], openEnded[2], openEnded[3] || DEFAULT_YEAR),
      endDate: null,
      dateText: normalized
    };
  }

  const explicitRange = normalized.match(
    /^([A-Za-z]+) (\d{1,2}), (\d{4})-([A-Za-z]+) (\d{1,2}), (\d{4})$/i
  );
  if (explicitRange) {
    return {
      startDate: toIsoDate(explicitRange[1], explicitRange[2], explicitRange[3]),
      endDate: toIsoDate(explicitRange[4], explicitRange[5], explicitRange[6]),
      dateText: normalized
    };
  }

  const seasonReopen = normalized.match(/^Reopens-([A-Za-z]+) (\d{4})$/i);
  if (seasonReopen) {
    const month = monthFromName(seasonReopen[1]);
    return {
      startDate: month ? `${seasonReopen[2]}-${month}` : seasonReopen[2],
      endDate: null,
      dateText: normalized
    };
  }

  return {
    startDate: null,
    endDate: null,
    dateText: normalized
  };
};

const extractSections = (html) => {
  const sections = [];
  const pattern = /<section\b[^>]*data-met-section=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi;

  for (const match of html.matchAll(pattern)) {
    sections.push({
      label: text(match[1]),
      html: match[2]
    });
  }

  return sections;
};

const extractArticles = (html) => String(html || '').match(/<article\b[\s\S]*?<\/article>/gi) || [];

const firstMatch = (html, pattern) => String(html || '').match(pattern)?.[1] || null;

const imageFromArticle = (html, pageUrl) => {
  const src = firstMatch(html, /<(?:source|img)\b[^>]*(?:srcset|src)=["']([^"']+)["']/i);
  if (!src) return null;

  return absoluteUrl(src.split(',')[0]?.trim().split(/\s+/)[0], pageUrl);
};

const parseArticle = ({ articleHtml, sectionLabel, pageUrl }) => {
  const href = firstMatch(articleHtml, /<a\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  const exhibitionUrl = absoluteUrl(href, pageUrl);
  if (!exhibitionUrl) return null;

  const title = text(firstMatch(articleHtml, /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i));
  if (!title) return null;

  const dateText = text(
    firstMatch(articleHtml, /<p\b[^>]*class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
  );
  const dateInfo = parseDateText(dateText);
  const tag = sectionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return {
    id: `exhibition:met:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'met',
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
    imageUrl: imageFromArticle(articleHtml, pageUrl),
    exhibitionUrl,
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: ['browser-assisted-snapshot', tag],
    sourceConfidence: 'medium',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from a browser-assisted compact snapshot of The Met official exhibitions page because direct backend fetch returns Vercel 429. Date text is preserved from the listing page; reviewer should confirm against the live official page before promotion.'
  };
};

export const parseMetExhibitionsPage = ({ html, url }) => {
  const unique = new Map();

  for (const section of extractSections(html)) {
    for (const articleHtml of extractArticles(section.html)) {
      const record = parseArticle({ articleHtml, sectionLabel: section.label, pageUrl: url });
      if (record && !unique.has(record.exhibitionUrl)) {
        unique.set(record.exhibitionUrl, record);
      }
    }
  }

  return [...unique.values()];
};
