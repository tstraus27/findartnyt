const VENUE = 'The Museum at FIT';
const VENUE_ADDRESS = '227 West 27th Street, New York, NY 10001-5992';
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
  decodeHtmlEntities(String(value || ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

const cleanDescription = (value) => {
  const normalized = text(value);
  return normalized.replace(/\s+Image:\s+[\s\S]*$/i, '').trim() || null;
};

const absoluteUrl = (value, baseUrl) => {
  if (!value) return null;

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString();
  } catch {
    return null;
  }
};

const monthFromName = (value) =>
  monthNumbers.get(String(value || '').toLowerCase().replace(/\.$/, '')) || null;

const toIsoDate = (monthName, day, year) => {
  const month = monthFromName(monthName);
  if (!month || !day || !year) return null;
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
};

const slugFromUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hash) return decodeURIComponent(parsedUrl.hash.slice(1));

    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    const rawSlug = segments.at(-1) === 'index.php' ? segments.at(-2) : segments.at(-1);
    return decodeURIComponent(rawSlug || 'unknown');
  } catch {
    return 'unknown';
  }
};

const slugFromTitle = (value) =>
  text(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

const listingUrlFor = (baseUrl, title) => {
  const listingUrl = new URL(baseUrl);
  listingUrl.hash = slugFromTitle(title);
  return listingUrl.toString();
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

  const openEndedRange = normalized.match(/^([A-Za-z.]+)\s+(\d{1,2})\s*[–—-]\s*TBD,\s*(\d{4})$/i);
  if (openEndedRange) {
    return {
      startDate: toIsoDate(openEndedRange[1], openEndedRange[2], openEndedRange[3]),
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

const sectionPattern = /<section class="section excard-long (current|upcoming)">[\s\S]*?<\/section>/gi;

const buildRecord = ({ title, sourceUrl, exhibitionUrl, imageUrl, dateText, description, tag }) => {
  if (!title || !sourceUrl || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);
  const slug = slugFromUrl(exhibitionUrl);

  return {
    id: `exhibition:fit:${slug}`,
    type: 'exhibition',
    source: 'fit',
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
    sourceUrl,
    openingReceptionDate: null,
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Museum at FIT official current and upcoming long-card sections. Listing-only exhibitions use a stable anchor on the official exhibitions page. Closure notices, translated duplicates, past exhibitions, MFIT on the Road, and any detail-page enrichment remain out of scope.'
  };
};

const parseSection = ({ sectionHtml, baseUrl, tag }) => {
  const title = text(sectionHtml.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1]);
  const detailUrl = absoluteUrl(
    sectionHtml.match(/<a href="([^"]+)" class="cta cta--button cta--museum">/i)?.[1],
    baseUrl
  );
  const description = cleanDescription(
    sectionHtml.match(/<div class="excard-long__description">\s*([\s\S]*?)\s*<\/div>/i)?.[1]
  );

  if (!title || /^galleries?\s+closed$/i.test(title)) {
    return null;
  }

  const exhibitionUrl = detailUrl || listingUrlFor(baseUrl, title);
  const sourceUrl = detailUrl || baseUrl;
  const imageUrl = absoluteUrl(sectionHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);
  const dateText = text(sectionHtml.match(/<span class="date">\s*([\s\S]*?)\s*<\/span>/i)?.[1]);

  return buildRecord({
    title,
    sourceUrl,
    exhibitionUrl,
    imageUrl,
    dateText,
    description,
    tag
  });
};

export const parseFitExhibitionsPage = ({ html, url }) => {
  const records = new Map();

  for (const match of html.matchAll(sectionPattern)) {
    const sectionHtml = match[0];
    const tag = match[1]?.toLowerCase();
    const record = parseSection({
      sectionHtml,
      baseUrl: url,
      tag
    });

    if (!record) continue;

    const dedupeKey = record.imageUrl ? `${tag}:${record.imageUrl}` : record.exhibitionUrl || record.id;
    if (!records.has(dedupeKey)) {
      records.set(dedupeKey, record);
    }
  }

  return [...records.values()];
};
