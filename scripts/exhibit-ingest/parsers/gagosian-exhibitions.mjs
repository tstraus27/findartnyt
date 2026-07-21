const entityMap = {
  '&amp;': '&',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>'
};

const monthNumbers = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12'
};

const locationMetadata = {
  '980 Madison at 76th Street, New York': {
    venue: 'Gagosian, 980 Madison at 76th Street',
    venueAddress: '974 Madison Avenue, New York, NY 10075',
    neighborhood: 'Upper East Side',
    borough: 'Manhattan',
    locationPage: 'https://gagosian.com/locations/974-madison-avenue-new-york/'
  },
  'Park & 75, New York': {
    venue: 'Gagosian, Park & 75',
    venueAddress: '821 Park Avenue, New York, NY 10021',
    neighborhood: 'Upper East Side',
    borough: 'Manhattan',
    locationPage: 'https://gagosian.com/locations/park-and-75-new-york/'
  },
  '541 West 24th Street, New York': {
    venue: 'Gagosian, 541 West 24th Street',
    venueAddress: '541 West 24th Street, New York, NY 10011',
    neighborhood: 'Chelsea',
    borough: 'Manhattan',
    locationPage: 'https://gagosian.com/locations/541-west-24th-street-new-york/'
  },
  'West 21st Street, New York': {
    venue: 'Gagosian, 522 West 21st Street',
    venueAddress: '522 West 21st Street, New York, NY 10011',
    neighborhood: 'Chelsea',
    borough: 'Manhattan',
    locationPage: 'https://gagosian.com/locations/west-21st-street-new-york/'
  }
};

const decodeHtml = (value = '') => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/&(amp|quot|lt|gt);|&#x27;|&#39;/g, (match) => entityMap[match] || match);
};

const text = (value) => decodeHtml(value).replace(/\s+/g, ' ').trim();

const absoluteUrl = (value, pageUrl) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
};

const slugFromUrl = (url) => {
  const parsed = new URL(url);
  return parsed.pathname.split('/').filter(Boolean).at(-1);
};

const toIsoDate = ({ month, day, year }) => {
  const monthNumber = monthNumbers[month.toLowerCase()];
  if (!monthNumber) return null;
  return `${year}-${monthNumber}-${String(day).padStart(2, '0')}`;
};

const parseDateRange = (value) => {
  const normalized = text(value).replace(/[\u2013\u2014]/g, '-');
  const sameMonth = normalized.match(/^(?<month>[A-Za-z]+)\s+(?<startDay>\d{1,2})-(?<endDay>\d{1,2}),\s+(?<year>\d{4})$/);

  if (sameMonth?.groups) {
    const { month, startDay, endDay, year } = sameMonth.groups;
    return {
      startDate: toIsoDate({ month, day: startDay, year }),
      endDate: toIsoDate({ month, day: endDay, year })
    };
  }

  const crossMonth = normalized.match(
    /^(?<startMonth>[A-Za-z]+)\s+(?<startDay>\d{1,2})-(?<endMonth>[A-Za-z]+)\s+(?<endDay>\d{1,2}),\s+(?<year>\d{4})$/
  );

  if (crossMonth?.groups) {
    const { startMonth, startDay, endMonth, endDay, year } = crossMonth.groups;
    return {
      startDate: toIsoDate({ month: startMonth, day: startDay, year }),
      endDate: toIsoDate({ month: endMonth, day: endDay, year })
    };
  }

  const singleDate = normalized.match(/^(?:Opening\s+)?(?<month>[A-Za-z]+)\s+(?<day>\d{1,2}),\s+(?<year>\d{4})$/i);

  if (singleDate?.groups) {
    const { month, day, year } = singleDate.groups;
    return {
      startDate: toIsoDate({ month, day, year }),
      endDate: null
    };
  }

  return {
    startDate: null,
    endDate: null
  };
};

const extractNextData = (html) => {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('No Gagosian __NEXT_DATA__ payload found');
  }
  return JSON.parse(match[1]);
};

const titleFor = (exhibition) =>
  [text(exhibition.title), text(exhibition.subtitle)]
    .filter(Boolean)
    .join(': ');

const imageUrlFor = (exhibition, pageUrl) =>
  absoluteUrl(
    exhibition.thumbnail?.sizes?.md?.url ||
      exhibition.thumbnail?.sizes?.sm?.url ||
      exhibition.meta?.thumb?.url ||
      exhibition.thumbnail?.sizes?.xs?.url,
    pageUrl
  );

const tagsFor = (pageUrl) => {
  const tags = ['gallery'];
  if (pageUrl.includes('/upcoming')) tags.push('upcoming');
  else tags.push('current');
  return tags;
};

const recordFor = ({ exhibition, pageUrl }) => {
  const locationLabel = text(exhibition.location_str || exhibition.location?.title);
  const location = locationMetadata[locationLabel];
  if (!location) return null;

  const exhibitionUrl = absoluteUrl(exhibition.meta?.canonical_url || exhibition.absolute_url, pageUrl);
  if (!exhibitionUrl) return null;

  const title = titleFor(exhibition);
  const { startDate, endDate } = parseDateRange(exhibition.dates_display);
  if (!title || !startDate) return null;

  return {
    id: `exhibition:gagosian:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'gagosian',
    title,
    venue: location.venue,
    startDate,
    endDate,
    dateText: text(exhibition.dates_display) || null,
    description: text(exhibition.meta?.description) || null,
    artists: text(exhibition.title) ? [text(exhibition.title)] : [],
    curators: text(exhibition.subtitle_2).toLowerCase().startsWith('curated by')
      ? [text(exhibition.subtitle_2).replace(/^curated by\s+/i, '')]
      : [],
    venueAddress: location.venueAddress,
    neighborhood: location.neighborhood,
    borough: location.borough,
    city: 'New York',
    imageUrl: imageUrlFor(exhibition, pageUrl),
    exhibitionUrl,
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: tagsFor(pageUrl),
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes: `Parsed from Gagosian official exhibitions page. Location label "${locationLabel}" mapped to ${location.venueAddress} using ${location.locationPage}.`
  };
};

export const parseGagosianExhibitionsPage = ({ html, url }) => {
  const nextData = extractNextData(html);
  const exhibitions = nextData.props?.pageProps?.exhibitions || [];
  const unique = new Map();

  for (const exhibition of exhibitions) {
    const record = recordFor({ exhibition, pageUrl: url });
    if (record && !unique.has(record.id)) {
      unique.set(record.id, record);
    }
  }

  return [...unique.values()];
};
