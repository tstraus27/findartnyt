const VENUE = 'Poster House';
const VENUE_ADDRESS = '119 W. 23rd Street, New York, NY 10011';
const NEIGHBORHOOD = 'Chelsea';
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
    if (code === '#8211') return '–';
    if (code === '#8212') return '—';
    if (code === '#8216') return '‘';
    if (code === '#8217') return '’';
    if (code === '#8220') return '“';
    if (code === '#8221') return '”';
    if (code === '#038') return '&';

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

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const text = (value) =>
  decodeHtmlEntities(
    String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{2,}/g, '\n')
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
  const normalized = normalizeWhitespace(text(value));

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

const cleanDescriptionParagraph = (value) => normalizeWhitespace(text(value));

const isBioParagraph = (paragraphHtml, paragraphText) =>
  /<strong>/.test(paragraphHtml) &&
  /^[A-Z][\p{L}.'’ -]+ (is|was|has|served|serves|earned|worked|lived|contributed)\b/u.test(paragraphText);

const descriptionFromPostContent = (value) => {
  const paragraphs = [];

  for (const match of String(value || '').matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
    const paragraphHtml = match[1];
    const paragraphText = cleanDescriptionParagraph(paragraphHtml);

    if (!paragraphText) {
      continue;
    }

    if (isBioParagraph(paragraphHtml, paragraphText)) {
      break;
    }

    paragraphs.push(paragraphText);
  }

  return paragraphs.join('\n\n') || null;
};

const extractSections = (html) =>
  String(html || '')
    .split(/<div id="content-index-block_[^"]+"[^>]*>/i)
    .slice(1);

const parseDataQuery = (sectionHtml) => {
  const raw = sectionHtml.match(/data-query="([^"]+)"/i)?.[1];
  if (!raw) return null;

  try {
    return JSON.parse(decodeHtmlEntities(raw));
  } catch {
    return null;
  }
};

const itemChunksFromSection = (sectionHtml) =>
  String(sectionHtml || '')
    .split(/<div class="[^"]*\bitem-data\b[^"]*"[^>]*>/i)
    .slice(1);

const parseRenderedItem = ({ chunk, baseUrl, tag }) => {
  const title = text(chunk.match(/<a href="[^"]+" class="title[^"]*">([\s\S]*?)<span class="visually-hidden">/i)?.[1]);
  const exhibitionUrl = absoluteUrl(chunk.match(/<a href="([^"]+)"/i)?.[1], baseUrl);
  const imageUrl = absoluteUrl(
    chunk.match(/<img[^>]+(?:data-img-src|src)="([^"]+)"/i)?.[1],
    baseUrl
  );
  const dateText = text(chunk.match(/<div class="subtitle">([\s\S]*?)<span class="visually-hidden">/i)?.[1]);
  const parsedDates = parseDateText(dateText);

  if (!title || !exhibitionUrl) {
    return null;
  }

  return {
    id: `exhibition:poster-house:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'poster-house',
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
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the official Poster House exhibitions page using the visible On View and Upcoming Exhibitions cards for exact dates, URLs, and images, then enriched with the same page’s embedded exhibition payload for long-form descriptions. Past Exhibitions and detail-page fetches remain out of scope for this first staging-only slice.'
  };
};

const buildDescriptionMap = (query) => {
  const descriptions = new Map();
  const items = Array.isArray(query?.custom_contents) ? query.custom_contents : [];

  for (const item of items) {
    const slug = normalizeWhitespace(item?.post_name);
    const description = descriptionFromPostContent(item?.post_content);
    if (slug && description) {
      descriptions.set(slug, description);
    }
  }

  return descriptions;
};

export const parsePosterHouseExhibitionsPage = ({ html, url }) => {
  const records = new Map();

  for (const sectionHtml of extractSections(html)) {
    const sectionTitle = text(sectionHtml.match(/<h2 class="content-index-title[^"]*">([\s\S]*?)<\/h2>/i)?.[1]);
    const query = parseDataQuery(sectionHtml);
    const contentType = normalizeWhitespace(query?.content_type);
    const contentSource = normalizeWhitespace(query?.content_source);

    if (contentType !== 'exhibition') {
      continue;
    }

    if (!/^(On View|Upcoming Exhibitions|Past Exhibitions)$/i.test(sectionTitle)) {
      continue;
    }

    if (contentSource === 'past' || /past exhibitions/i.test(sectionTitle)) {
      continue;
    }

    const tag = /upcoming/i.test(sectionTitle) ? 'upcoming' : 'current';
    const descriptions = buildDescriptionMap(query);

    for (const chunk of itemChunksFromSection(sectionHtml)) {
      const record = parseRenderedItem({ chunk, baseUrl: url, tag });
      if (!record) continue;

      const description = descriptions.get(slugFromUrl(record.exhibitionUrl));
      if (description) {
        record.description = description;
      }

      if (!records.has(record.id)) {
        records.set(record.id, record);
      }
    }
  }

  return [...records.values()];
};
