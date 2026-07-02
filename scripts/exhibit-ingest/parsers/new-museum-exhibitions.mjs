const text = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

const slugFromUrl = (url) => {
  const parsed = new URL(url);
  return parsed.pathname.split('/').filter(Boolean).at(-1);
};

const dateOnly = (value) => {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const imageUrlFor = (exhibition) =>
  exhibition.featuredImage?.node?.sourceUrl ||
  exhibition.heroAsset?.desktop?.sourceUrl ||
  null;

const tagsFor = (exhibition) =>
  (exhibition.exhibitionType?.nodes || [])
    .map((node) => text(node.name))
    .filter(Boolean);

const extractNextData = (html) => {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('No New Museum __NEXT_DATA__ payload found');
  }
  return JSON.parse(match[1]);
};

const exhibitionBlocksFrom = (nextData) => {
  const blocks = nextData.props?.pageProps?.__TEMPLATE_QUERY_DATA__?.page?.blocks || [];
  return blocks.filter((block) => Array.isArray(block.exhibitions));
};

const exhibitionRecord = ({ exhibition, pageUrl }) => {
  const exhibitionUrl = text(exhibition.link);
  const slug = exhibitionUrl ? slugFromUrl(exhibitionUrl) : `new-museum-${exhibition.databaseId}`;
  const startDate = dateOnly(exhibition.startDate);

  if (!text(exhibition.title) || !startDate || !exhibitionUrl) {
    return null;
  }

  return {
    id: `exhibition:new-museum:${slug}`,
    type: 'exhibition',
    source: 'new-museum',
    title: text(exhibition.title),
    venue: 'New Museum',
    startDate,
    endDate: dateOnly(exhibition.endDate),
    dateText: text(exhibition.dateTextOverride) || null,
    description: null,
    artists: [],
    curators: [],
    venueAddress: '235 Bowery, New York, NY 10002',
    neighborhood: 'Lower East Side',
    borough: 'Manhattan',
    city: 'New York',
    imageUrl: imageUrlFor(exhibition),
    exhibitionUrl,
    sourceUrl: exhibitionUrl || pageUrl,
    openingReceptionDate: null,
    tags: tagsFor(exhibition),
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes: 'Parsed from New Museum official exhibitions page embedded Next/Apollo data.'
  };
};

export const parseNewMuseumExhibitionsPage = ({ html, url }) => {
  const nextData = extractNextData(html);
  const exhibitions = exhibitionBlocksFrom(nextData).flatMap((block) => block.exhibitions);
  const unique = new Map();

  for (const exhibition of exhibitions) {
    const record = exhibitionRecord({ exhibition, pageUrl: url });
    if (record && !unique.has(record.id)) {
      unique.set(record.id, record);
    }
  }

  return [...unique.values()];
};
