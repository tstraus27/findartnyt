const VENUE = 'The Jewish Museum';
const VENUE_ADDRESS = '1109 5th Avenue, New York, NY 10128';
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

const namedEntities = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['rsquo', '’'],
  ['lsquo', '‘'],
  ['ldquo', '“'],
  ['rdquo', '”'],
  ['ndash', '–'],
  ['mdash', '—']
]);

const decodeHtmlEntities = (value) =>
  String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
    const code = rawCode.toLowerCase();

    if (namedEntities.has(code)) {
      return namedEntities.get(code);
    }

    if (code === '#39') return "'";

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

const normalizedDateText = (value) =>
  text(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s*[–—]\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();

const parseMonthDayYear = (value) => {
  const match = normalizedDateText(value).match(/^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return null;

  const month = monthFromName(match[1]);
  if (!month) return null;

  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
};

const parseDateText = (value) => {
  const normalized = normalizedDateText(value);
  if (!normalized) {
    return {
      startDate: null,
      endDate: null,
      dateText: null
    };
  }

  if (/ongoing$/i.test(normalized)) {
    const match = normalized.match(/^([A-Za-z.]+\s+\d{1,2},\s+\d{4})\s+—\s+Ongoing$/i);
    return {
      startDate: match ? parseMonthDayYear(match[1]) : null,
      endDate: null,
      dateText: normalized
    };
  }

  const explicitRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s+—\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
  );
  if (explicitRange) {
    const startMonth = monthFromName(explicitRange[1]);
    const endMonth = monthFromName(explicitRange[4]);

    return {
      startDate: startMonth ? `${explicitRange[3]}-${startMonth}-${explicitRange[2].padStart(2, '0')}` : null,
      endDate: endMonth ? `${explicitRange[6]}-${endMonth}-${explicitRange[5].padStart(2, '0')}` : null,
      dateText: normalized
    };
  }

  const sharedYearRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2})\s+—\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i
  );
  if (sharedYearRange) {
    const startMonth = monthFromName(sharedYearRange[1]);
    const endMonth = monthFromName(sharedYearRange[3]);

    return {
      startDate: startMonth ? `${sharedYearRange[5]}-${startMonth}-${sharedYearRange[2].padStart(2, '0')}` : null,
      endDate: endMonth ? `${sharedYearRange[5]}-${endMonth}-${sharedYearRange[4].padStart(2, '0')}` : null,
      dateText: normalized
    };
  }

  return {
    startDate: null,
    endDate: null,
    dateText: normalized
  };
};

const cardBlockPattern =
  /<div class="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue focus-within:outline-dotted">[\s\S]*?<\/a>\s*<\/div>/gi;

const matchGroup = (value, pattern) => pattern.exec(value)?.[1] || null;

const extractCardFields = (cardHtml, baseUrl) => ({
  exhibitionUrl: absoluteUrl(matchGroup(cardHtml, /<a href="([^"]+)"/i), baseUrl),
  imageUrl: absoluteUrl(
    matchGroup(cardHtml, /<div class="relative">\s*<img[^>]+data-src="([^"]+)"/i),
    baseUrl
  ),
  category: text(matchGroup(cardHtml, /<div class="text-category[^"]*">([\s\S]*?)<\/div>/i)),
  title: text(matchGroup(cardHtml, /<p class="text-card-title[^"]*">([\s\S]*?)<\/p>/i)),
  dateText: text(
    matchGroup(cardHtml, /<div class="mt-2 flex items-center gap-2 text-card-datetime font-mono">\s*<span>([\s\S]*?)<\/span>/i)
  )
});

const buildRecord = ({ title, exhibitionUrl, category, dateText, imageUrl }) => {
  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);
  const normalizedCategory = normalizedDateText(category).toLowerCase();
  const tags = normalizedCategory === 'coming soon' ? ['upcoming'] : ['current'];

  return {
    id: `exhibition:jewish-museum:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'jewish-museum',
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
    tags,
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Jewish Museum official exhibitions page server-rendered cards that appear before the client-side schedule calendar. The React calendar and any later detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

export const parseJewishMuseumExhibitionsPage = ({ html, url }) => {
  const scheduleIndex = html.indexOf('<div id="schedule">');
  const calendarIndex = html.indexOf('<div id="react-exhibitions-calendar">');
  const cutoffIndex =
    scheduleIndex === -1
      ? calendarIndex
      : calendarIndex === -1
        ? scheduleIndex
        : Math.min(scheduleIndex, calendarIndex);
  const scopeHtml = cutoffIndex === -1 ? html : html.slice(0, cutoffIndex);
  const records = new Map();

  for (const match of scopeHtml.matchAll(cardBlockPattern)) {
    const { exhibitionUrl, imageUrl, category, title, dateText } = extractCardFields(match[0], url);
    const record = buildRecord({
      title,
      exhibitionUrl,
      category,
      dateText,
      imageUrl
    });

    if (record && !records.has(record.id)) {
      records.set(record.id, record);
    }
  }

  return [...records.values()];
};
