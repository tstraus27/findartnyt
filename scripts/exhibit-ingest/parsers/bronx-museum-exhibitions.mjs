const VENUE = 'The Bronx Museum';
const VENUE_ADDRESS = '1040 Grand Concourse, Bronx, NY 10456';
const NEIGHBORHOOD = 'Concourse';
const BOROUGH = 'Bronx';
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
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()
  );

const absoluteUrl = (value, baseUrl) => {
  if (!value) return null;

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString();
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

  const sameYearRange = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})\s*[–—-]\s*([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (sameYearRange) {
    return {
      startDate: toIsoDate(sameYearRange[1], sameYearRange[2], sameYearRange[5]),
      endDate: toIsoDate(sameYearRange[3], sameYearRange[4], sameYearRange[5]),
      dateText: normalized
    };
  }

  const explicitYearRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s*[–—-]\s*([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
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

const extractBetween = (html, startMarker, endMarker) => {
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) return '';

  const endIndex = html.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) return html.slice(startIndex);

  return html.slice(startIndex, endIndex);
};

const articlePattern = /<article class="exhibition-card">[\s\S]*?<\/article>/gi;

const buildRecord = ({ title, exhibitionUrl, imageUrl, dateText }) => {
  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);

  return {
    id: `exhibition:bronx-museum:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'bronx-museum',
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
    tags: ['current'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Bronx Museum official exhibitions archive using only the visible Current exhibition-card grid after the filter links. The featured-show hero is ignored to avoid duplicate staging, Upcoming and Archive filters remain out of scope, and youth-program cards are currently staged when they appear in the same official Current grid.'
  };
};

const parseArticle = ({ articleHtml, baseUrl }) => {
  const exhibitionUrl = absoluteUrl(articleHtml.match(/<a class="exhibition-link" href="([^"]+)"/i)?.[1], baseUrl);
  const imageUrl = absoluteUrl(articleHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);
  const title = text(articleHtml.match(/<h2 class="exhibition-title[\s\S]*?>([\s\S]*?)<\/h2>/i)?.[1]);
  const dateText = text(articleHtml.match(/<div class="exhibition-date">\s*([\s\S]*?)\s*<\/div>/i)?.[1]);

  return buildRecord({
    title,
    exhibitionUrl,
    imageUrl,
    dateText
  });
};

export const parseBronxMuseumExhibitionsPage = ({ html, url }) => {
  const currentSection = extractBetween(
    html,
    '<a href="https://bronxmuseum.org/exhibitions/" class="show-category active">',
    '<div class="pagination">'
  );

  const records = new Map();

  for (const match of currentSection.matchAll(articlePattern)) {
    const record = parseArticle({
      articleHtml: match[0],
      baseUrl: url
    });

    if (!record) continue;

    if (!records.has(record.exhibitionUrl)) {
      records.set(record.exhibitionUrl, record);
    }
  }

  return [...records.values()];
};
