const VENUE = 'Solomon R. Guggenheim Museum';
const VENUE_ADDRESS = '1071 5th Avenue, New York, NY 10128';
const NEIGHBORHOOD = 'Upper East Side';
const BOROUGH = 'Manhattan';
const CITY = 'New York';

const text = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

const absoluteUrl = (value, baseUrl) => {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
};

const extractBootstrap = (html) => {
  const match = html.match(/const bootstrap = ([\s\S]*?); const footerNav = /);

  if (!match) {
    throw new Error('No Guggenheim bootstrap payload found');
  }

  return JSON.parse(match[1]);
};

const isoDateFromParts = (value) => {
  const year = text(value?.year);
  const monthName = text(value?.month);
  const day = text(value?.day);

  if (!year || !monthName || !day) {
    return null;
  }

  const parsed = new Date(`${monthName} ${day}, ${year} UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

const recordFromItem = ({ item, sectionKey, pageUrl }) => {
  const slug = text(item?.slug);
  const title = text(item?.title);
  const exhibitionUrl = slug ? absoluteUrl(`/exhibition/${slug}`, pageUrl) : null;

  if (!slug || !title || !exhibitionUrl) {
    return null;
  }

  return {
    id: `exhibition:guggenheim:${slug}`,
    type: 'exhibition',
    source: 'guggenheim',
    title,
    venue: VENUE,
    startDate: isoDateFromParts(item?.dates?.start),
    endDate: isoDateFromParts(item?.dates?.end),
    dateText: text(item?.dates?.label) || null,
    description: text(item?.excerpt) || null,
    artists: [],
    curators: [],
    venueAddress: VENUE_ADDRESS,
    neighborhood: NEIGHBORHOOD,
    borough: BOROUGH,
    city: CITY,
    imageUrl: absoluteUrl(item?.featuredImage?.sourceUrl, pageUrl),
    exhibitionUrl,
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: [sectionKey === 'on_view' ? 'current' : 'upcoming'],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from the Guggenheim official exhibitions page bootstrap payload. Stages only the embedded on_view and upcoming exhibition items from the index page; past items and any detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

export const parseGuggenheimExhibitionsPage = ({ html, url }) => {
  const bootstrap = extractBootstrap(html);
  const featuredExhibitions = bootstrap?.initial?.main?.posts?.featuredExhibitions || {};
  const unique = new Map();

  for (const sectionKey of ['on_view', 'upcoming']) {
    const items = Array.isArray(featuredExhibitions?.[sectionKey]?.items)
      ? featuredExhibitions[sectionKey].items
      : [];

    for (const item of items) {
      const record = recordFromItem({ item, sectionKey, pageUrl: url });
      if (record && !unique.has(record.id)) {
        unique.set(record.id, record);
      }
    }
  }

  return [...unique.values()];
};
