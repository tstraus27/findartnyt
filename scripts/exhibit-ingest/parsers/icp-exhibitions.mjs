const VENUE = 'International Center of Photography';
const VENUE_ADDRESS = '84 Ludlow Street, New York, NY 10002';
const NEIGHBORHOOD = 'Lower East Side';
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

const namedEntities = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['aacute', 'á'],
  ['eacute', 'é'],
  ['iacute', 'í'],
  ['oacute', 'ó'],
  ['uacute', 'ú'],
  ['auml', 'ä'],
  ['euml', 'ë'],
  ['iuml', 'ï'],
  ['ouml', 'ö'],
  ['uuml', 'ü'],
  ['ntilde', 'ñ'],
  ['ccedil', 'ç'],
  ['rsquo', '’'],
  ['lsquo', '‘'],
  ['ldquo', '“'],
  ['rdquo', '”'],
  ['ndash', '–'],
  ['mdash', '—']
]);

const decodeHtmlEntities = (value) =>
  String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
    const code = rawCode.toLowerCase();

    if (namedEntities.has(code)) {
      return namedEntities.get(code);
    }

    if (code === '#39') return "'";

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
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

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
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || 'unknown');
  } catch {
    return 'unknown';
  }
};

const monthFromName = (value) => monthNumbers.get(String(value || '').toLowerCase().replace(/\.$/, '')) || null;

const parseSingleDate = (value) => {
  const match = text(value).match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return null;

  const month = monthFromName(match[1]);
  if (!month) return null;

  return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
};

const parseDateRange = (value) => {
  const normalized = text(value).replace(/\s*[–—]\s*/g, ' - ');
  const parts = normalized.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length !== 2) {
    return {
      startDate: parseSingleDate(normalized),
      endDate: null
    };
  }

  return {
    startDate: parseSingleDate(parts[0]),
    endDate: parseSingleDate(parts[1])
  };
};

const parseCompactDateRange = (value) => {
  const normalized = text(value).replace(/\s*[–—]\s*/g, ' - ');
  const match = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+-\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) {
    return parseDateRange(normalized);
  }

  const startMonth = monthFromName(match[1]);
  const endMonth = monthFromName(match[4]);

  return {
    startDate: startMonth ? `${match[3]}-${startMonth}-${match[2].padStart(2, '0')}` : null,
    endDate: endMonth ? `${match[6]}-${endMonth}-${match[5].padStart(2, '0')}` : null
  };
};

const currentHeadingIndex = (html) => html.indexOf('Current Exhibitions');
const upcomingHeadingIndex = (html) => html.indexOf('Upcoming Exhibitions');
const pastHeadingIndex = (html) => html.indexOf('Past Exhibitions');

const cardPattern =
  /<div class="field__item cards__item">[\s\S]*?<div class="cards__image">[\s\S]*?<a href="([^"]+)" class="cards__anchor"><\/a>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<div class="cards__info[^"]*">[\s\S]*?<H1 class="cards__title">\s*([\s\S]*?)\s*<\/H1>[\s\S]*?<div class="field__item">([\s\S]*?)<\/div>[\s\S]*?<a href="([^"]+)" class="btn-primary"/gi;

const statusTagForIndex = (matchIndex, html) => {
  const upcomingIndex = upcomingHeadingIndex(html);
  const pastIndex = pastHeadingIndex(html);

  if (upcomingIndex !== -1 && matchIndex > upcomingIndex && (pastIndex === -1 || matchIndex < pastIndex)) {
    return 'upcoming';
  }

  return 'current';
};

const repairSentenceSpacing = (value) =>
  String(value || '')
    .replace(/([a-z0-9,;:'"”’)\]])([A-ZÀ-ÖØ-Þ])/g, '$1 $2')
    .replace(/([.?!])([A-ZÀ-ÖØ-Þ])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

const trimHeaderImageCaption = (value) => String(value || '').replace(/\s*Header image:\s*[\s\S]*$/i, '').trim();

const cleanDescription = (value) => {
  const cleaned = repairSentenceSpacing(trimHeaderImageCaption(text(value)));
  return cleaned || null;
};

const splitParagraphs = (value) =>
  String(value || '')
    .split(/<\/p>/i)
    .map((paragraph) => cleanDescription(paragraph))
    .filter(Boolean);

const isSupplementaryDescriptionParagraph = (value) =>
  /^(about\b|featured photobooks\b|header image:|to see more from\b)/i.test(String(value || '').trim());

const splitParagraphIntoSentences = (value) =>
  String(value || '')
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const trimDescriptionParagraphAtSupplementaryCue = (value) => {
  const sentences = splitParagraphIntoSentences(value);
  const kept = [];

  for (const sentence of sentences) {
    if (isSupplementaryDescriptionParagraph(sentence)) {
      break;
    }

    kept.push(sentence);
  }

  return kept.join(' ').trim();
};

const isIrrelevantDescriptionCandidate = (value) =>
  /this website stores cookies|visit the icp press room|hubspot embed code|please enter your email if you would like to receive a regular newsletter/i.test(
    String(value || '').toLowerCase()
  );

const extractDetailDescription = (html) => {
  const detailHtml = html;
  const exhibitionTextMatches = [
    ...detailHtml.matchAll(
      /<div class="field field--name-field-exhibition-text field--exhibition-text-node">[\s\S]*?<div class="field__item">([\s\S]*?)<\/div>\s*<\/div>/gi
    )
  ];
  const matches =
    exhibitionTextMatches.length > 0
      ? exhibitionTextMatches
      : [
          ...detailHtml.matchAll(
            /<div class="field field--name-body field--body-block-content">[\s\S]*?<div class="field__item">([\s\S]*?)<\/div>\s*<\/div>/gi
          )
        ];

  const descriptions = matches
    .map((match) => {
      const paragraphs = splitParagraphs(match[1] || '');
      if (!paragraphs.length) {
        return null;
      }

      const descriptionParagraphs = [];

      for (const paragraph of paragraphs) {
        const trimmedParagraph = trimDescriptionParagraphAtSupplementaryCue(paragraph);

        if (isSupplementaryDescriptionParagraph(paragraph) || !trimmedParagraph) {
          break;
        }

        descriptionParagraphs.push(trimmedParagraph);
      }

      return {
        description: descriptionParagraphs.length ? descriptionParagraphs.join('\n\n') : paragraphs[0],
        paragraphCount: descriptionParagraphs.length || paragraphs.length
      };
    })
    .filter(Boolean)
    .filter((candidate) => !isIrrelevantDescriptionCandidate(candidate.description))
    .sort((left, right) => {
      if (right.paragraphCount !== left.paragraphCount) {
        return right.paragraphCount - left.paragraphCount;
      }

      return right.description.length - left.description.length;
    });

  return descriptions[0]?.description || null;
};

const extractDetailDateRange = (html) => {
  const dateText = text(html.match(/<div class="exibition__date[^"]*">\s*([\s\S]*?)\s*<\/div>/i)?.[1] || '');
  return {
    dateText: dateText || null,
    ...parseCompactDateRange(dateText)
  };
};

const parseIcpExhibitionDetailPage = ({ html, url }) => {
  const exhibitionUrl = absoluteUrl(
    html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] || url,
    url
  );
  const title = text(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] || '');
  const description =
    extractDetailDescription(html) ||
    cleanDescription(html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] || '') ||
    null;
  const imageUrl = absoluteUrl(html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || '', url);
  const { startDate, endDate, dateText } = extractDetailDateRange(html);

  if (!title || !exhibitionUrl) {
    return [];
  }

  return [
    {
      id: `exhibition:icp:${slugFromUrl(exhibitionUrl)}`,
      type: 'exhibition',
      source: 'icp',
      title,
      venue: VENUE,
      startDate,
      endDate,
      dateText,
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
        'Enriched from the official ICP exhibition detail page metadata and sidebar date block for optional description/image fields and exact review-facing date text.'
    }
  ];
};

export const parseIcpExhibitionsPage = ({ html, url }) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname !== '/exhibitions') {
      return parseIcpExhibitionDetailPage({ html, url });
    }
  } catch {
    return [];
  }

  const startIndex = currentHeadingIndex(html);
  if (startIndex === -1) {
    throw new Error('No ICP current exhibitions heading found');
  }

  const records = [];
  const pastIndex = pastHeadingIndex(html);

  for (const match of html.matchAll(cardPattern)) {
    if (pastIndex !== -1 && match.index > pastIndex) {
      continue;
    }

    const exhibitionUrl = absoluteUrl(match[1], url);
    const imageUrl = absoluteUrl(match[2], url);
    const title = text(match[3]);
    const dateText = text(match[4]) || null;
    const readMoreUrl = absoluteUrl(match[5], url);

    if (!title || !exhibitionUrl || !dateText || exhibitionUrl !== readMoreUrl) {
      continue;
    }

    const { startDate, endDate } = parseDateRange(dateText);
    if (!startDate) {
      continue;
    }

    records.push({
      id: `exhibition:icp:${slugFromUrl(exhibitionUrl)}`,
      type: 'exhibition',
      source: 'icp',
      title,
      venue: VENUE,
      startDate,
      endDate,
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
      tags: [statusTagForIndex(match.index, html)],
      sourceConfidence: 'high',
      reviewStatus: 'needs_review',
      lastCheckedAt: null,
      sourceNotes:
        'Parsed from the official ICP exhibitions index page current and upcoming card sections. Past exhibitions and the separate future-exhibitions landing page remain out of scope for this first staging-only slice.'
    });
  }

  return records;
};
