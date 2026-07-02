const VENUE = 'Cooper Hewitt, Smithsonian Design Museum';
const VENUE_ADDRESS = '2 East 91st Street, New York, NY 10128';
const NEIGHBORHOOD = 'Carnegie Hill';
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
    if (code === '#8217') return '’';
    if (code === '#8220') return '“';
    if (code === '#8221') return '”';

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
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u202f/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()
  );

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

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

  const onViewThrough = normalized.match(/^on view through\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (onViewThrough) {
    return {
      startDate: null,
      endDate: toIsoDate(onViewThrough[1], onViewThrough[2], onViewThrough[3]),
      dateText: normalized
    };
  }

  const opens = normalized.match(/^opens\s+([A-Za-z.]+)\s+(\d{1,2}),\s*(\d{4})$/i);
  if (opens) {
    return {
      startDate: toIsoDate(opens[1], opens[2], opens[3]),
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

const currentBlockPattern = /<div class="col-sm-4 col-\d+">[\s\S]*?<\/h6>\s*<\/div>/gi;

const descriptionFromParagraphs = (html, limitMarkerPattern) => {
  const paragraphs = [];

  for (const match of html.matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
    const paragraphHtml = match[1];

    if (/<img\b/i.test(paragraphHtml)) {
      continue;
    }

    if (/<a [^>]*>\s*.*?Learn more about/i.test(paragraphHtml)) {
      break;
    }

    if (limitMarkerPattern && limitMarkerPattern.test(paragraphHtml)) {
      break;
    }

    const paragraphText = normalizeWhitespace(text(paragraphHtml));
    if (paragraphText) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs.join('\n\n') || null;
};

const splitHeading = (headingHtml) => {
  const lines = text(headingHtml)
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return {
    title: lines[0] || null,
    dateText: lines.slice(1).join(' ') || null
  };
};

const buildRecord = ({ title, exhibitionUrl, imageUrl, dateText, description, tag }) => {
  if (!title || !exhibitionUrl) {
    return null;
  }

  const parsedDates = parseDateText(dateText);

  return {
    id: `exhibition:cooper-hewitt:${slugFromUrl(exhibitionUrl)}`,
    type: 'exhibition',
    source: 'cooper-hewitt',
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
    sourceUrl: exhibitionUrl,
    openingReceptionDate: null,
    tags: [tag],
    sourceConfidence: 'high',
    reviewStatus: 'needs_review',
    lastCheckedAt: null,
    sourceNotes:
      'Parsed from Cooper Hewitt official current and upcoming exhibition pages using only the visible main exhibition blocks and Learn more links. Sponsor-logo sections, funding acknowledgements after the main exhibition copy, photo-credit blocks, previous/traveling/digital pages, and detail-page enrichment remain out of scope for this first staging-only slice.'
  };
};

const parseCurrentBlock = ({ blockHtml, baseUrl }) => {
  const heading = splitHeading(blockHtml.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1]);
  const exhibitionUrl = absoluteUrl(blockHtml.match(/<a href="([^"]+)"><strong>Learn more about/i)?.[1], baseUrl);
  const imageUrl = absoluteUrl(blockHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);
  const description = descriptionFromParagraphs(blockHtml);

  return buildRecord({
    title: heading.title,
    exhibitionUrl,
    imageUrl,
    dateText: heading.dateText,
    description,
    tag: 'current'
  });
};

const parseUpcomingBlock = ({ html, baseUrl }) => {
  const pageBody = html.match(/<div class="page-body row">([\s\S]*?)<div class="ewa-rteLine">/i)?.[1] || '';
  const heading = splitHeading(pageBody.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1]);
  const exhibitionUrl = absoluteUrl(pageBody.match(/<a href="([^"]+)">Learn more about/i)?.[1], baseUrl);
  const imageUrl =
    absoluteUrl(html.match(/<img[^>]+class="[^"]*\bwp-post-image\b[^"]*"[^>]+src="([^"]+)"/i)?.[1], baseUrl) ||
    absoluteUrl(html.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*\bwp-post-image\b[^"]*"/i)?.[1], baseUrl) ||
    absoluteUrl(pageBody.match(/<img[^>]+src="([^"]+)"/i)?.[1], baseUrl) ||
    absoluteUrl(html.match(/<div class="full-width-image-wrapper[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1], baseUrl);
  const description = descriptionFromParagraphs(pageBody, /received major support|additional generous support|our shared future/i);

  return buildRecord({
    title: heading.title,
    exhibitionUrl,
    imageUrl,
    dateText: heading.dateText,
    description,
    tag: 'upcoming'
  });
};

export const parseCooperHewittExhibitionsPage = ({ html, url }) => {
  const route = new URL(url).pathname;
  const records = new Map();

  if (route === '/exhibitions/') {
    for (const match of html.matchAll(currentBlockPattern)) {
      const record = parseCurrentBlock({
        blockHtml: match[0],
        baseUrl: url
      });

      if (!record) continue;
      records.set(record.exhibitionUrl, record);
    }
  } else if (route === '/exhibitions/upcoming/') {
    const record = parseUpcomingBlock({
      html,
      baseUrl: url
    });

    if (record) {
      records.set(record.exhibitionUrl, record);
    }
  }

  return [...records.values()];
};
