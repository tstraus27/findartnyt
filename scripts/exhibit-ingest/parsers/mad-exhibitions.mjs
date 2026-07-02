const VENUE = 'Museum of Arts and Design';
const VENUE_ADDRESS = '2 Columbus Circle, New York, NY 10019';
const NEIGHBORHOOD = 'Columbus Circle';
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

const htmlAttribute = (value) => decodeHtmlEntities(String(value || '').replace(/\s+/g, ' ').trim());

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

  const throughMatch = normalized.match(/^Through\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (throughMatch) {
    return {
      startDate: null,
      endDate: toIsoDate(throughMatch[1], throughMatch[2], throughMatch[3]),
      dateText: normalized
    };
  }

  const opensMatch = normalized.match(/^Opens\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (opensMatch) {
    return {
      startDate: toIsoDate(opensMatch[1], opensMatch[2], opensMatch[3]),
      endDate: null,
      dateText: normalized
    };
  }

  if (/^Ongoing$/i.test(normalized)) {
    return {
      startDate: null,
      endDate: null,
      dateText: normalized
    };
  }

  const rangeMatch = normalized
    .replace(/\s*[–—]\s*/g, ' - ')
    .match(/^([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})\s+-\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (rangeMatch) {
    return {
      startDate: toIsoDate(rangeMatch[1], rangeMatch[2], rangeMatch[3]),
      endDate: toIsoDate(rangeMatch[4], rangeMatch[5], rangeMatch[6]),
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

const extractRows = (sectionHtml) => [...sectionHtml.matchAll(/<div class="views-row[\s\S]*?<\/div>\s*<\/div>/g)].map((match) => match[0]);

const extractMetaContent = (html, property) =>
  htmlAttribute(
    html.match(new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`, 'i'))?.[1] || ''
  );

const parseRow = ({ rowHtml, baseUrl, tag }) => {
  const titleMatch = rowHtml.match(/<div class="(?:list-title|grid-title)">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>/i);
  if (!titleMatch) return null;

  const exhibitionUrl = absoluteUrl(titleMatch[1], baseUrl);
  if (!exhibitionUrl) return null;

  const imageMatch = rowHtml.match(/<img[^>]+src="([^"]+)"/i);
  const imageUrl = absoluteUrl(imageMatch?.[1] || null, baseUrl);
  const dateMatch = rowHtml.match(/<div class="(?:list-dates|grid-dates)">[\s\S]*?<h4>([\s\S]*?)<\/h4>/i);
  const dateInfo = parseDateText(dateMatch?.[1] || null);

  return {
    id: `exhibition:mad:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'mad',
    title: text(titleMatch[2]),
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
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Museum of Arts and Design official exhibitions page current and upcoming listing grids only. Installations and past exhibitions remain out of scope; linked official detail pages may later enrich dates and reviewer-facing metadata without promoting anything to canonical.'
  };
};

const cleanDescriptionParagraph = (value) => {
  const cleaned = text(value)
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

  return cleaned || null;
};

const isBoilerplateParagraph = (value) => /^about the artist$/i.test(String(value || '').trim());

const isPressQuoteParagraph = (value) => /^["“]/.test(String(value || '').trim());

const extractDetailDescription = (html) => {
  const sectionHtml = html.match(/<div class="page-section">([\s\S]*?)<\/div>\s*(?:<div class="page-section">|<div class="mobile-none spacer-24-bottom">)/i)?.[1];
  if (!sectionHtml) {
    return null;
  }

  const paragraphs = [...sectionHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanDescriptionParagraph(match[1]))
    .filter(Boolean);

  if (!paragraphs.length) {
    return null;
  }

  const descriptionParagraphs = [];

  for (const paragraph of paragraphs) {
    if (isBoilerplateParagraph(paragraph)) {
      break;
    }

    if (isPressQuoteParagraph(paragraph)) {
      continue;
    }

    descriptionParagraphs.push(paragraph);
  }

  const selectedParagraphs = descriptionParagraphs.length ? descriptionParagraphs : [paragraphs[0]];
  return selectedParagraphs.join('\n\n');
};

const parseMadDetailPage = ({ html, url }) => {
  const exhibitionUrl = absoluteUrl(extractMetaContent(html, 'og:url') || url, url);
  const title = extractMetaContent(html, 'og:title') || text(html.match(/<div class="page-title-alt">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)?.[1] || '');

  if (!title || !exhibitionUrl) {
    return [];
  }

  const dateInfo = parseDateText(html.match(/<h4 class="spacer-48-bottom">([\s\S]*?)<\/h4>/i)?.[1] || null);
  const imageUrl = absoluteUrl(extractMetaContent(html, 'og:image') || null, url);
  const description = extractDetailDescription(html);

  return [
    {
      id: `exhibition:mad:${slugFromUrl(exhibitionUrl)}`,
      type: 'exhibition',
      source: 'mad',
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
      tags: [],
      sourceConfidence: 'high',
      reviewStatus: 'needs_review',
      lastCheckedAt: null,
      sourceNotes:
        'Enriched from the official Museum of Arts and Design exhibition detail page for visible date text plus optional description/image metadata while keeping the source staging-only.'
    }
  ];
};

export const parseMadExhibitionsPage = ({ html, url }) => {
  try {
    if (new URL(url).pathname !== '/exhibitions') {
      return parseMadDetailPage({ html, url });
    }
  } catch {
    return [];
  }

  const currentSection = extractBetween(
    html,
    'view-display-id-new_current_exhibitions',
    '<div class="exhibition-head spacer-60-top" id="upcoming"><h1>Upcoming</h1></div>'
  );
  const upcomingSection = extractBetween(
    html,
    'view-display-id-new_future_exhibitions',
    '<div class="exhibition-head spacer-120-top" id="installations"><h1>Installations</h1></div>'
  );

  const records = [
    ...extractRows(currentSection).map((rowHtml) => parseRow({ rowHtml, baseUrl: url, tag: 'current' })),
    ...extractRows(upcomingSection).map((rowHtml) => parseRow({ rowHtml, baseUrl: url, tag: 'upcoming' }))
  ].filter(Boolean);

  const deduped = new Map();
  for (const record of records) {
    if (!deduped.has(record.exhibitionUrl)) {
      deduped.set(record.exhibitionUrl, record);
    }
  }

  return [...deduped.values()];
};
