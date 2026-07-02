const VENUE = 'The Morgan Library & Museum';
const VENUE_ADDRESS = '225 Madison Avenue, New York, NY 10016';
const BOROUGH = 'Manhattan';
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

  if (/^ongoing$/i.test(normalized)) {
    return {
      startDate: null,
      endDate: null,
      dateText: normalized
    };
  }

  const sameYearRange = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})\s+through\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (sameYearRange) {
    return {
      startDate: toIsoDate(sameYearRange[1], sameYearRange[2], sameYearRange[5]),
      endDate: toIsoDate(sameYearRange[3], sameYearRange[4], sameYearRange[5]),
      dateText: normalized
    };
  }

  const explicitYearRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s+through\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
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

  if (!endMarker) {
    return html.slice(startIndex);
  }

  const endIndex = html.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) return html.slice(startIndex);

  return html.slice(startIndex, endIndex);
};

const thumbnailPattern = /<div class="col col-xs-12 col-sm-6[\s\S]*?(?=<div class="col col-xs-12 col-sm-6|$)/gi;

const buildRecord = ({ title, exhibitionUrl, imageUrl, dateText, tag }) => {
  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);

  return {
    id: `exhibition:morgan:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'morgan',
    title,
    venue: VENUE,
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    dateText: parsedDates.dateText,
    description: null,
    artists: [],
    curators: [],
    venueAddress: VENUE_ADDRESS,
    neighborhood: null,
    borough: BOROUGH,
    city: CITY,
    imageUrl,
    exhibitionUrl,
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Morgan Library & Museum official current and upcoming exhibition listing grids only. The separate Collection Spotlight block on the current page, plus online, past, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

const parseThumbnail = ({ itemHtml, baseUrl, tag }) => {
  const exhibitionUrl = absoluteUrl(itemHtml.match(/<a href="([^"]+)" hreflang="en"><img/i)?.[1], baseUrl);
  const imageUrl = absoluteUrl(itemHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);
  const title = text(itemHtml.match(/<div class="views-field views-field-title"><strong class="field-content">([\s\S]*?)<\/strong><\/div>/i)?.[1]);
  const dateText = text(
    itemHtml.match(
      /<div class="views-field views-field-field-display-date"><(?:em|div) class="field-content">([\s\S]*?)<\/(?:em|div)><\/div>/i
    )?.[1]
  );

  return buildRecord({
    title,
    exhibitionUrl,
    imageUrl,
    dateText,
    tag
  });
};

const scopeForUrl = (url) => {
  const pathname = new URL(url).pathname;

  if (pathname.endsWith('/upcoming')) {
    return {
      tag: 'upcoming',
      startMarker: '<div id="views-bootstrap-exhibitions-page-2"  class="grid views-view-grid horizontal">',
      endMarker: null
    };
  }

  return {
    tag: 'current',
    startMarker: '<div id="views-bootstrap-exhibitions-page-1"  class="grid views-view-grid horizontal">',
    endMarker: '<div id="views-bootstrap-exhibitions-block-1"  class="grid views-view-grid horizontal">'
  };
};

export const parseMorganExhibitionsPage = ({ html, url }) => {
  const scope = scopeForUrl(url);
  const scopeHtml = extractBetween(html, scope.startMarker, scope.endMarker);
  const records = new Map();

  for (const match of scopeHtml.matchAll(thumbnailPattern)) {
    const record = parseThumbnail({
      itemHtml: match[0],
      baseUrl: url,
      tag: scope.tag
    });

    if (record && !records.has(record.exhibitionUrl)) {
      records.set(record.exhibitionUrl, record);
    }
  }

  return [...records.values()];
};
