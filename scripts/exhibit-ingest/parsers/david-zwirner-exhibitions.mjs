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
  'New York: 19th Street': {
    venueAddress: '519, 525 & 533 West 19th Street, New York, NY 10011',
    neighborhood: 'Chelsea',
    borough: 'Manhattan'
  },
  'New York: 20th Street': {
    venueAddress: '537 West 20th Street, New York, NY 10011',
    neighborhood: 'Chelsea',
    borough: 'Manhattan'
  },
  'New York: 69th Street': {
    venueAddress: '34 East 69th Street, New York, NY 10021',
    neighborhood: 'Upper East Side',
    borough: 'Manhattan'
  },
  'New York: Tribeca': {
    venueAddress: '52 Walker Street, New York, NY 10013',
    neighborhood: 'Tribeca',
    borough: 'Manhattan'
  }
};

const decodeHtml = (value = '') =>
  value.replace(/&(amp|quot|lt|gt);|&#x27;|&#39;/g, (match) => entityMap[match] || match);

const text = (value) => decodeHtml(String(value || '')).replace(/\s+/g, ' ').trim();

const normalizeText = (value) =>
  text(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

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
  const normalized = text(value).replace(/[–—]/g, '—');
  const openingDate = normalized.match(/^(?:Opening\s+)?(?<month>[A-Za-z]+)\s+(?<day>\d{1,2}),\s+(?<year>\d{4})$/i);

  if (openingDate?.groups) {
    const { month, day, year } = openingDate.groups;
    return {
      startDate: toIsoDate({ month, day, year }),
      endDate: null
    };
  }

  const crossMonth = normalized.match(
    /^(?<startMonth>[A-Za-z]+)\s+(?<startDay>\d{1,2})—(?<endMonth>[A-Za-z]+)\s+(?<endDay>\d{1,2}),\s+(?<year>\d{4})$/
  );

  if (crossMonth?.groups) {
    const { startMonth, startDay, endMonth, endDay, year } = crossMonth.groups;
    return {
      startDate: toIsoDate({ month: startMonth, day: startDay, year }),
      endDate: toIsoDate({ month: endMonth, day: endDay, year })
    };
  }

  const sameMonth = normalized.match(/^(?<month>[A-Za-z]+)\s+(?<startDay>\d{1,2})—(?<endDay>\d{1,2}),\s+(?<year>\d{4})$/);

  if (sameMonth?.groups) {
    const { month, startDay, endDay, year } = sameMonth.groups;
    return {
      startDate: toIsoDate({ month, day: startDay, year }),
      endDate: toIsoDate({ month, day: endDay, year })
    };
  }

  return {
    startDate: null,
    endDate: null
  };
};

const stripTags = (value) => value.replace(/<[^>]+>/g, ' ');

const anchorMatches = (html) =>
  [...html.matchAll(/<a\b[^>]*href=(["'])(?<href>[^"'#?]+)\1[^>]*>(?<body>[\s\S]*?)<\/a>/gi)];

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeJsonLdItems = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeJsonLdItems(item));
  }
  if (typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value['@graph'])) {
    return normalizeJsonLdItems(value['@graph']);
  }
  if (Array.isArray(value.itemListElement)) {
    return normalizeJsonLdItems(value.itemListElement);
  }
  if (value.item && typeof value.item === 'object') {
    return normalizeJsonLdItems(value.item);
  }
  return [value];
};

const absoluteUrl = (value, pageUrl) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
};

const imageUrlFromJsonLd = (image, pageUrl) => {
  if (!image) return null;
  if (typeof image === 'string') {
    return absoluteUrl(image, pageUrl);
  }
  if (Array.isArray(image)) {
    for (const entry of image) {
      const resolved = imageUrlFromJsonLd(entry, pageUrl);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof image === 'object') {
    return absoluteUrl(image.url || image.contentUrl || image['@id'], pageUrl);
  }
  return null;
};

const jsonLdMetadataByUrl = ({ html, pageUrl }) => {
  const metadata = new Map();
  const scriptMatches = [...html.matchAll(/<script\b[^>]*type=(["'])application\/ld\+json\1[^>]*>(?<body>[\s\S]*?)<\/script>/gi)];

  for (const match of scriptMatches) {
    const parsed = parseJson(text(match.groups?.body || ''));
    const items = normalizeJsonLdItems(parsed);

    for (const item of items) {
      const href = absoluteUrl(item.url || item['@id'], pageUrl);
      if (!href || !href.includes('/exhibitions/')) continue;

      const next = {
        description: text(item.description || ''),
        imageUrl: imageUrlFromJsonLd(item.image, pageUrl)
      };
      const current = metadata.get(href) || { description: null, imageUrl: null };

      metadata.set(href, {
        description: current.description || next.description || null,
        imageUrl: current.imageUrl || next.imageUrl || null
      });
    }
  }

  return metadata;
};

const titleFromMetadata = ({ fallbackTitle, metadata }) => {
  if (!metadata?.title) {
    return fallbackTitle;
  }

  if (!metadata.subtitle) {
    return metadata.title;
  }

  const combined = `${metadata.title} ${metadata.subtitle}`.trim();
  if (normalizeText(fallbackTitle) === normalizeText(combined)) {
    return fallbackTitle;
  }

  return `${metadata.title}: ${metadata.subtitle}`.trim();
};

const imageUrlFromMedia = (media, pageUrl) =>
  absoluteUrl(media?.image?.url || media?.image?.asset?.url || media?.url, pageUrl);

const nextDataMetadataByUrl = ({ html, pageUrl }) => {
  const metadata = new Map();
  const nextDataMatch = html.match(
    /<script\b[^>]*id=(["'])__NEXT_DATA__\1[^>]*type=(["'])application\/json\2[^>]*>(?<body>[\s\S]*?)<\/script>/i
  );
  const parsed = parseJson(nextDataMatch?.groups?.body || '');
  const pageData = parsed?.props?.pageProps?.data;
  const exhibitions = [...(pageData?.nowOpen || []), ...(pageData?.upcoming || [])];

  for (const item of exhibitions) {
    const href = absoluteUrl(item?.slug?.current, pageUrl);
    if (!href || !href.includes('/exhibitions/')) continue;

    const title = text(item.title || '');
    const subtitle = text(item.subtitle || '');
    const summary = text(item.summary || '');
    const imageUrl = imageUrlFromMedia(item.cardViewMedia, pageUrl) || imageUrlFromMedia(item.heroMedia, pageUrl);

    metadata.set(href, {
      title: title || null,
      subtitle: subtitle || null,
      description: summary || null,
      imageUrl: imageUrl || null
    });
  }

  return metadata;
};

const listingRecord = ({ href, label, pageUrl, listingMetadata }) => {
  if (!href.includes('/exhibitions/')) return null;
  if (!/^https?:\/\//i.test(href)) {
    href = new URL(href, pageUrl).toString();
  }

  const parsed = text(label).match(
    /^(?<title>.+?)\s+(?<location>New York:\s.+?)\s+(?:(?<status>Now Open|Coming Soon):\s+(?<dates>.+?)|(?<openingStatus>Opening)\s+(?<openingDate>[A-Za-z]+\s+\d{1,2},\s+\d{4}))\s+Learn More$/i
  );
  if (!parsed?.groups) return null;

  const { title, location, status, dates, openingStatus, openingDate } = parsed.groups;
  const dateText = dates || `${openingStatus} ${openingDate}`;
  const { startDate, endDate } = parseDateRange(dateText);
  if (!title || !startDate) return null;

  const slug = slugFromUrl(href);
  const locationInfo = locationMetadata[location] || { venueAddress: null, neighborhood: null, borough: 'Manhattan' };
  const statusTag = (status || openingStatus).toLowerCase() === 'now open' ? 'current' : 'upcoming';
  const optionalMetadata = listingMetadata.get(href) || {
    title: null,
    subtitle: null,
    description: null,
    imageUrl: null
  };

  return {
    id: `exhibition:david-zwirner:${slug}`,
    type: 'exhibition',
    source: 'david-zwirner',
    title: titleFromMetadata({ fallbackTitle: title, metadata: optionalMetadata }),
    venue: `David Zwirner, ${location}`,
    startDate,
    endDate,
    dateText,
    description: optionalMetadata.description,
    artists: [],
    curators: [],
    venueAddress: locationInfo.venueAddress,
    neighborhood: locationInfo.neighborhood,
    borough: locationInfo.borough,
    city: 'New York',
    imageUrl: optionalMetadata.imageUrl,
    exhibitionUrl: href,
    sourceUrl: href,
    openingReceptionDate: null,
    tags: ['gallery_exhibition', statusTag, location],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes: 'Parsed from the official David Zwirner exhibitions index page for NYC gallery listings.'
  };
};

export const parseDavidZwirnerExhibitionsPage = ({ html, url }) => {
  const unique = new Map();
  const jsonLdMetadata = jsonLdMetadataByUrl({ html, pageUrl: url });
  const nextDataMetadata = nextDataMetadataByUrl({ html, pageUrl: url });
  const listingMetadata = new Map();

  for (const [href, metadata] of nextDataMetadata) {
    listingMetadata.set(href, metadata);
  }

  for (const [href, metadata] of jsonLdMetadata) {
    const current = listingMetadata.get(href) || {};
    listingMetadata.set(href, {
      ...current,
      description: current.description || metadata.description || null,
      imageUrl: current.imageUrl || metadata.imageUrl || null
    });
  }

  for (const match of anchorMatches(html)) {
    const href = decodeHtml(match.groups?.href || '');
    const label = stripTags(match.groups?.body || '');
    const record = listingRecord({ href, label, pageUrl: url, listingMetadata });

    if (record && !unique.has(record.id)) {
      unique.set(record.id, record);
    }
  }

  return [...unique.values()];
};
