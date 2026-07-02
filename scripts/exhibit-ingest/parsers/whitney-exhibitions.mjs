const VENUE = 'Whitney Museum of American Art';
const VENUE_ADDRESS = '99 Gansevoort Street, New York, NY 10014';
const NEIGHBORHOOD = 'Meatpacking District';
const BOROUGH = 'Manhattan';
const CITY = 'New York';

const monthNumbers = new Map([
  ['jan', '01'],
  ['feb', '02'],
  ['mar', '03'],
  ['apr', '04'],
  ['may', '05'],
  ['jun', '06'],
  ['jul', '07'],
  ['aug', '08'],
  ['sep', '09'],
  ['sept', '09'],
  ['oct', '10'],
  ['nov', '11'],
  ['dec', '12']
]);

const text = (value) => {
  if (typeof value !== 'string') return '';

  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
    .replace(/\s+/g, ' ')
    .trim();
};

const decodeHtmlEntities = (value) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
    const code = rawCode.toLowerCase();

    if (code === 'amp') return '&';
    if (code === 'lt') return '<';
    if (code === 'gt') return '>';
    if (code === 'quot') return '"';
    if (code === 'apos' || code === '#39') return "'";
    if (code === 'nbsp') return ' ';

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

const extractSection = (html, sectionId) => {
  const pattern = new RegExp(`<section id="${sectionId}">([\\s\\S]*?)<\\/section>`, 'i');
  return html.match(pattern)?.[1] || '';
};

const extractCards = (sectionHtml) => {
  const cards = [];
  const pattern = /<li class="list-item exhibition-list-item">([\s\S]*?)<\/li>/gi;

  for (const match of sectionHtml.matchAll(pattern)) {
    cards.push(match[1]);
  }

  return cards;
};

const matchGroup = (pattern, html) => html.match(pattern)?.[1] || '';

const monthFromName = (value) => monthNumbers.get(value.toLowerCase().slice(0, 4).replace(/\.$/, '')) || null;

const parseStartDate = (dateText) => {
  if (!dateText) return null;

  const opensYear = dateText.match(/^Opens\s+(\d{4})$/i);
  if (opensYear) {
    return opensYear[1];
  }

  const opensMonthYear = dateText.match(/^Opens\s+([A-Za-z]+)\s+(\d{4})$/i);
  if (opensMonthYear) {
    const month = monthFromName(opensMonthYear[1]);
    return month ? `${opensMonthYear[2]}-${month}` : opensMonthYear[2];
  }

  const opensFullDate = dateText.match(/^Opens\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (opensFullDate) {
    const month = monthFromName(opensFullDate[1]);
    const day = opensFullDate[2].padStart(2, '0');
    return month ? `${opensFullDate[3]}-${month}-${day}` : opensFullDate[3];
  }

  return null;
};

const isoDateOnly = (value) => {
  if (typeof value !== 'string') return null;

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const extractJsonLdObjects = (html) => {
  const objects = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        objects.push(...parsed);
      } else {
        objects.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return objects;
};

const recordFromCard = ({ cardHtml, sectionId, pageUrl }) => {
  const exhibitionUrl = absoluteUrl(matchGroup(/<a href="([^"]+)"/i, cardHtml), pageUrl);
  const title = text(matchGroup(/<h3 class="list-item__title[^"]*">([\s\S]*?)<\/h3>/i, cardHtml));
  const dateText = text(matchGroup(/<p class="list-item__subtitle[^"]*">([\s\S]*?)<\/p>/i, cardHtml)) || null;
  const imageUrl = absoluteUrl(matchGroup(/<img[^>]+src="([^"]+)"/i, cardHtml), pageUrl);

  if (!title || !exhibitionUrl) {
    return null;
  }

  return {
    id: `exhibition:whitney:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'whitney',
    title,
    venue: VENUE,
    startDate: parseStartDate(dateText),
    endDate: null,
    dateText,
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
    tags: [sectionId],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Whitney exhibitions index page current/upcoming sections only. Date text is preserved exactly as shown on the list page for reviewer context, even when linked official detail pages later provide exact dates and richer metadata.'
  };
};

const parseWhitneyDetailPage = ({ html, url }) => {
  const jsonLd = extractJsonLdObjects(html).find((entry) => entry?.['@type'] === 'ExhibitionEvent');
  const exhibitionUrl = absoluteUrl(jsonLd?.['@id'] || url, url);
  const title = text(jsonLd?.name || matchGroup(/<meta property="og:title" content="([^"]*)"/i, html));
  const description = htmlAttribute(
    jsonLd?.description || matchGroup(/<meta(?:\s+name="description"|\s+property="og:description")\s+content="([^"]*)"/i, html)
  );
  const imageUrl = absoluteUrl(
    jsonLd?.image || matchGroup(/<meta property="og:image" content="([^"]*)"/i, html),
    url
  );

  if (!title || !exhibitionUrl) {
    return [];
  }

  return [
    {
      id: `exhibition:whitney:${slugFromUrl(exhibitionUrl)}`,
      type: 'exhibition',
      source: 'whitney',
      title,
      venue: VENUE,
      startDate: isoDateOnly(jsonLd?.startDate),
      endDate: isoDateOnly(jsonLd?.endDate),
      dateText: null,
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
      tags: [],
      sourceConfidence: 'high',
      reviewStatus: 'needs_review',
      lastCheckedAt: null,
      sourceNotes:
        'Enriched from the official Whitney exhibition detail page JSON-LD and metadata for exact dates and optional description/image fields.'
    }
  ];
};

export const parseWhitneyExhibitionsPage = ({ html, url }) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname !== '/exhibitions') {
      return parseWhitneyDetailPage({ html, url });
    }
  } catch {
    return [];
  }

  const unique = new Map();

  for (const sectionId of ['current', 'upcoming']) {
    const sectionHtml = extractSection(html, sectionId);
    for (const cardHtml of extractCards(sectionHtml)) {
      const record = recordFromCard({ cardHtml, sectionId, pageUrl: url });
      if (record && !unique.has(record.id)) {
        unique.set(record.id, record);
      }
    }
  }

  return [...unique.values()];
};
