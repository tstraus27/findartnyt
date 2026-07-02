const entityMap = {
  '&amp;': '&',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>'
};

const decodeHtml = (value = '') =>
  value.replace(/&(amp|quot|lt|gt);|&#x27;|&#39;/g, (match) => entityMap[match] || match);

const text = (value) => {
  if (typeof value !== 'string') return '';
  return decodeHtml(value).replace(/\s+/g, ' ').trim();
};

const slugFromUrl = (url) => {
  const parsed = new URL(url);
  return parsed.pathname.split('/').filter(Boolean).at(-1);
};

const normalizeImageUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  const decoded = decodeHtml(value);
  try {
    const parsed = new URL(decoded);
    const nested = parsed.searchParams.get('url');
    return nested ? decodeURIComponent(nested) : decoded;
  } catch {
    return decoded;
  }
};

const extractJsonLd = (html) => {
  const scripts = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      scripts.push(JSON.parse(decodeHtml(raw)));
    } catch (error) {
      throw new Error(`Unable to parse David Zwirner JSON-LD: ${error.message}`);
    }
  }

  return scripts;
};

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const findArtistSchema = (schemas) =>
  schemas.find((schema) => schema?.['@type'] === 'Person' && schema?.additionalType === 'Artist');

const artworkRecord = ({ artwork, artistName, pageUrl, sourceEmail }) => {
  const url = artwork.url ? decodeHtml(artwork.url) : null;
  const slug = url ? slugFromUrl(url) : `${slugFromUrl(pageUrl)}-${text(artwork.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return {
    id: `artwork:david-zwirner:${slug}`,
    type: 'artwork',
    source: 'david-zwirner',
    sourceUrl: url,
    parentArtistUrl: pageUrl,
    artistName,
    title: text(artwork.name),
    dateCreated: text(artwork.dateCreated) || null,
    medium: text(artwork.additionalType) || null,
    availability: text(artwork.offers?.availability || artwork.availability) || null,
    imageUrl: normalizeImageUrl(artwork.image?.url || artwork.image),
    sourceEmail
  };
};

export const parseDavidZwirnerArtistPage = ({ html, url, sourceEmail = null }) => {
  const schemas = extractJsonLd(html);
  const artist = findArtistSchema(schemas);

  if (!artist) {
    throw new Error(`No David Zwirner artist schema found at ${url}`);
  }

  const artistName = text(artist.name);
  const artistSlug = slugFromUrl(url);
  const offers = asArray(artist.makesOffer);

  const artistRecord = {
    id: `artist:david-zwirner:${artistSlug}`,
    type: 'artist',
    source: 'david-zwirner',
    sourceUrl: decodeHtml(artist.mainEntityOfPage || url),
    artistName,
    birthDate: text(artist.birthDate) || null,
    birthPlace: text(artist.birthPlace) || null,
    gender: text(artist.gender) || null,
    gallery: text(artist.affiliation) || 'David Zwirner',
    description: text(artist.description),
    imageUrl: normalizeImageUrl(artist.image),
    sourceEmail
  };

  const artworkRecords = offers
    .map((offer) => offer?.itemOffered)
    .filter(Boolean)
    .map((artwork) => artworkRecord({ artwork, artistName, pageUrl: url, sourceEmail }));

  return [artistRecord, ...artworkRecords];
};
