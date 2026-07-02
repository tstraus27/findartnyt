const VENUE = 'Museum of the City of New York';
const VENUE_ADDRESS = '1220 5th Avenue, New York, NY 10029';
const NEIGHBORHOOD = 'East Harlem';
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

  if (/^ongoing$/i.test(normalized)) {
    return {
      startDate: null,
      endDate: null,
      dateText: normalized
    };
  }

  const throughDate = normalized.match(/^Through\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (throughDate) {
    return {
      startDate: null,
      endDate: toIsoDate(throughDate[1], throughDate[2], throughDate[3]),
      dateText: normalized
    };
  }

  const opensDate = normalized.match(/^Opens\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (opensDate) {
    return {
      startDate: toIsoDate(opensDate[1], opensDate[2], opensDate[3]),
      endDate: null,
      dateText: normalized
    };
  }

  const explicitRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s*[–—-]\s*([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
  );
  if (explicitRange) {
    return {
      startDate: toIsoDate(explicitRange[1], explicitRange[2], explicitRange[3]),
      endDate: toIsoDate(explicitRange[4], explicitRange[5], explicitRange[6]),
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

const articlePattern = /<article class="card[\s\S]*?<\/article>/gi;

const buildRecord = ({ title, exhibitionUrl, imageUrl, dateText, description, tag }) => {
  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);

  return {
    id: `exhibition:mcny:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'mcny',
    title,
    venue: VENUE,
    startDate: parsedDates.startDate,
    endDate: parsedDates.endDate,
    dateText: parsedDates.dateText,
    description: description || null,
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
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Museum of the City of New York official exhibitions page using the visible Exhibitions On View and Upcoming Exhibitions card sections only. Online exhibitions, traveling exhibitions, past exhibitions, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

const parseArticle = ({ articleHtml, baseUrl, tag }) => {
  const exhibitionUrl = absoluteUrl(articleHtml.match(/<h2>\s*<a href="([^"]+)"/i)?.[1], baseUrl);
  const imageUrl = absoluteUrl(articleHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);
  const title = text(articleHtml.match(/<h2>\s*<a [^>]+>([\s\S]*?)<\/a>\s*<\/h2>/i)?.[1]);
  const dateText = text(articleHtml.match(/<span class="date">\s*([\s\S]*?)\s*<\/span>/i)?.[1]);
  const description = text(articleHtml.match(/<span class="hidden-sm-down">\s*([\s\S]*?)\s*<\/span>/i)?.[1]);

  return buildRecord({
    title,
    exhibitionUrl,
    imageUrl,
    dateText,
    description,
    tag
  });
};

export const parseMcnyExhibitionsPage = ({ html, url }) => {
  const currentSection = extractBetween(
    html,
    '<a name="exhibitions-on-view"></a>',
    '<a name="exhibitions-upcoming"></a>'
  );
  const upcomingSection = extractBetween(
    html,
    '<a name="exhibitions-upcoming"></a>',
    '<a name="exhibitions-online"></a>'
  );

  const records = new Map();
  const sections = [
    { html: currentSection, tag: 'current' },
    { html: upcomingSection, tag: 'upcoming' }
  ];

  for (const section of sections) {
    for (const match of section.html.matchAll(articlePattern)) {
      const record = parseArticle({
        articleHtml: match[0],
        baseUrl: url,
        tag: section.tag
      });

      if (record && !records.has(record.exhibitionUrl)) {
        records.set(record.exhibitionUrl, record);
      }
    }
  }

  return [...records.values()];
};
