const VENUE = 'The Drawing Center';
const VENUE_ADDRESS = '35 Wooster Street, New York, NY 10013';
const NEIGHBORHOOD = 'SoHo';
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

const isoDateOnly = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
};

const monthFromName = (value) =>
  monthNumbers.get(String(value || '').toLowerCase().replace(/\.$/, '')) || null;

const parseDateText = (dateText, datetimeValue) => {
  const normalized = text(dateText).replace(/\s*[–—]\s*/g, '–').trim();
  const datetimeDate = isoDateOnly(datetimeValue);

  if (!normalized) {
    return {
      startDate: null,
      endDate: null,
      dateText: null
    };
  }

  if (/^Through\s+/i.test(normalized)) {
    return {
      startDate: null,
      endDate: datetimeDate,
      dateText: normalized
    };
  }

  const sharedYearRange = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})–([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (sharedYearRange) {
    const endMonth = monthFromName(sharedYearRange[3]);

    return {
      startDate: datetimeDate,
      endDate:
        endMonth ? `${sharedYearRange[5]}-${endMonth}-${sharedYearRange[4].padStart(2, '0')}` : null,
      dateText: normalized
    };
  }

  const explicitYearRange = normalized.match(
    /^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})–([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/
  );
  if (explicitYearRange) {
    const endMonth = monthFromName(explicitYearRange[4]);

    return {
      startDate: datetimeDate,
      endDate:
        endMonth ? `${explicitYearRange[6]}-${endMonth}-${explicitYearRange[5].padStart(2, '0')}` : null,
      dateText: normalized
    };
  }

  return {
    startDate: datetimeDate,
    endDate: null,
    dateText: normalized
  };
};

const parseJsLiteral = (value) => {
  if (!value) return null;

  try {
    return Function(`"use strict"; return (${value});`)();
  } catch {
    return null;
  }
};

const extractNuxtAliasMap = (html) => {
  const match = html.match(/window\.__NUXT__=\(function\(([^)]*)\)\{return[\s\S]*?\}\(([\s\S]*?)\)\);\s*<\/script>/i);
  if (!match) return new Map();

  const params = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const args = parseJsLiteral(`[${match[2]}]`);
  const aliasMap = new Map();

  if (!Array.isArray(args)) {
    return aliasMap;
  }

  params.forEach((param, index) => {
    aliasMap.set(param, args[index]);
  });

  return aliasMap;
};

const resolveNuxtToken = (token, aliasMap) => {
  if (!token) return null;

  const trimmed = token.trim();
  if (!trimmed) return null;

  if (trimmed in Object.create(null)) {
    return null;
  }

  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    return parseJsLiteral(trimmed);
  }

  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  if (aliasMap.has(trimmed)) {
    return aliasMap.get(trimmed);
  }

  return parseJsLiteral(trimmed);
};

const extractNuxtRecordFallbacks = (html) => {
  const aliasMap = extractNuxtAliasMap(html);
  const fallbacks = new Map();
  const pattern = /slug:"([^"]+)"([\s\S]{0,1600}?)thumbnail:\[\{([\s\S]{0,800}?)\}\]/g;

  for (const match of html.matchAll(pattern)) {
    const slug = match[1];
    const body = match[2];
    const thumbnailBody = match[3];
    const startToken = body.match(/startDate:([^,}]+)/)?.[1] || null;
    const endToken = body.match(/endDate:([^,}]+)/)?.[1] || null;
    const imageToken =
      thumbnailBody.match(/smallpreview:([^,}]+)/)?.[1] ||
      thumbnailBody.match(/medium:([^,}]+)/)?.[1] ||
      thumbnailBody.match(/large:([^,}]+)/)?.[1] ||
      null;

    fallbacks.set(slug, {
      startDate: isoDateOnly(resolveNuxtToken(startToken, aliasMap)),
      endDate: isoDateOnly(resolveNuxtToken(endToken, aliasMap)),
      imageUrl: resolveNuxtToken(imageToken, aliasMap)
    });
  }

  return fallbacks;
};

const extractBetween = (html, startMarker, endMarker) => {
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) return '';

  const endIndex = html.indexOf(endMarker, startIndex);
  return endIndex === -1 ? html.slice(startIndex) : html.slice(startIndex, endIndex);
};

const extractCards = (sectionHtml) => sectionHtml.match(/<section role="listitem"[\s\S]*?(?=<section role="listitem"|$)/g) || [];

const recordFromCard = ({ cardHtml, baseUrl, tag, nuxtFallbacks }) => {
  const exhibitionUrl = absoluteUrl(
    cardHtml.match(/<h2 class="(?:half_page_title|page_title)">\s*<a href="([^"]+)"/i)?.[1],
    baseUrl
  );
  const title = text(
    cardHtml.match(/<h2 class="(?:half_page_title|page_title)">\s*<a [^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i)?.[1]
  );
  const datetimeValue = cardHtml.match(/<time[^>]+datetime="([^"]+)"/i)?.[1] || null;
  const dateText = text(cardHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/i)?.[1]);
  const imageUrl = absoluteUrl(cardHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);

  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText, datetimeValue);
  const fallback = nuxtFallbacks.get(slugFromUrl(exhibitionUrl)) || {};

  return {
    id: `exhibition:drawing-center:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'drawing-center',
    title,
    venue: VENUE,
    startDate: parsedDates.startDate || fallback.startDate || null,
    endDate: parsedDates.endDate || fallback.endDate || null,
    dateText: parsedDates.dateText,
    description: null,
    artists: [],
    curators: [],
    venueAddress: VENUE_ADDRESS,
    neighborhood: NEIGHBORHOOD,
    borough: BOROUGH,
    city: CITY,
    imageUrl: imageUrl || absoluteUrl(fallback.imageUrl, baseUrl),
    exhibitionUrl,
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from The Drawing Center official exhibitions page server-rendered on-view and upcoming listing modules only. Past exhibitions and any detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

export const parseDrawingCenterExhibitionsPage = ({ html, url }) => {
  const nuxtFallbacks = extractNuxtRecordFallbacks(html);
  const onViewHtml = extractBetween(
    html,
    '<section role="list" id="onview" class="general_module">',
    '<section role="list" id="upcoming" class="general_module">'
  );
  const upcomingHtml = extractBetween(
    html,
    '<section role="list" id="upcoming" class="general_module">',
    '<section id="past" class="general_module show_images">'
  );

  const records = new Map();

  for (const [tag, sectionHtml] of [
    ['current', onViewHtml],
    ['upcoming', upcomingHtml]
  ]) {
    for (const cardHtml of extractCards(sectionHtml)) {
      const record = recordFromCard({ cardHtml, baseUrl: url, tag, nuxtFallbacks });
      if (record && !records.has(record.id)) {
        records.set(record.id, record);
      }
    }
  }

  return [...records.values()];
};
