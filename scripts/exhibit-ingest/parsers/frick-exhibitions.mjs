const VENUE = 'The Frick Collection';
const VENUE_ADDRESS = '1 East 70th Street, New York, NY 10021';
const NEIGHBORHOOD = 'Upper East Side';
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
      .replace(/\s+([,.;:!?])/g, '$1')
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

  const sameYearRange = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})\s+to\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (sameYearRange) {
    return {
      startDate: toIsoDate(sameYearRange[1], sameYearRange[2], sameYearRange[5]),
      endDate: toIsoDate(sameYearRange[3], sameYearRange[4], sameYearRange[5]),
      dateText: normalized
    };
  }

  const explicitYearRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s+to\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
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

const extractCards = (sectionHtml) =>
  sectionHtml.match(/<div class="paragraph paragraph--type--card[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];

const parseCard = ({ cardHtml, baseUrl, tag }) => {
  const imageUrl = absoluteUrl(cardHtml.match(/<img[\s\S]*?src="([^"]+)"/i)?.[1], baseUrl);
  const bodyHtml = cardHtml.match(/<div class="paragraph-card__body-text">([\s\S]*?)<\/div>/i)?.[1] || '';
  const primaryParagraph = bodyHtml.match(/<p>([\s\S]*?)<\/p>/i)?.[1] || '';
  const bodyParagraphs = [...bodyHtml.matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
  const linkHref = bodyHtml.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Read More/i)?.[1] || null;
  const exhibitionUrl = absoluteUrl(linkHref, baseUrl);

  if (!exhibitionUrl) return null;

  const titleHtml = primaryParagraph.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] || primaryParagraph;
  const title = text(titleHtml);
  const dateHtml = primaryParagraph.match(/<\/(?:em|strong)>\s*<br>\s*([\s\S]*)$/i)?.[1] || '';
  const dateInfo = parseDateText(dateHtml);
  const description = text(bodyParagraphs[1] || null) || null;

  if (!title) return null;

  return {
    id: `exhibition:frick:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'frick',
    title,
    venue: VENUE,
    startDate: dateInfo.startDate,
    endDate: dateInfo.endDate,
    dateText: dateInfo.dateText,
    description,
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
      'Parsed from The Frick Collection official exhibitions page current and upcoming card blocks only. Past exhibitions, virtual exhibitions, and any detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

export const parseFrickExhibitionsPage = ({ html, url }) => {
  const currentSection = extractBetween(
    html,
    '<div id="current">Current</div>',
    '<div id="upcoming">Upcoming</div>'
  );
  const upcomingSection = extractBetween(
    html,
    '<div id="upcoming">Upcoming</div>',
    '<p>Past | Featured'
  );

  const records = [
    ...extractCards(currentSection).map((cardHtml) => parseCard({ cardHtml, baseUrl: url, tag: 'current' })),
    ...extractCards(upcomingSection).map((cardHtml) => parseCard({ cardHtml, baseUrl: url, tag: 'upcoming' }))
  ].filter(Boolean);

  const deduped = new Map();
  for (const record of records) {
    if (!deduped.has(record.exhibitionUrl)) {
      deduped.set(record.exhibitionUrl, record);
    }
  }

  return [...deduped.values()];
};
