const VENUE = 'The Museum of Modern Art';
const VENUE_ADDRESS = '11 W 53rd St, New York, NY 10019';
const NEIGHBORHOOD = 'Midtown';
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

const decodeHtmlEntities = (value) =>
  String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
    const code = rawCode.toLowerCase();

    if (code === 'amp') return '&';
    if (code === 'lt') return '<';
    if (code === 'gt') return '>';
    if (code === 'quot') return '"';
    if (code === 'apos' || code === '#39') return "'";
    if (code === 'nbsp') return ' ';
    if (code === 'ndash') return '-';
    if (code === 'mdash') return '-';

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
  decodeHtmlEntities(String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const absoluteUrl = (value, baseUrl) => {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
};

const exhibitionIdFromUrl = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).at(-1) || 'unknown';
  } catch {
    return 'unknown';
  }
};

const extractAnchorBlocks = (html) => {
  const blocks = [];
  const pattern = /<a\b[^>]*href=["']([^"']*\/calendar\/exhibitions\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    blocks.push({
      href: match[1],
      html: match[2]
    });
  }

  return blocks;
};

const paragraphTexts = (html) =>
  [...String(html || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => text(match[1]))
    .filter(Boolean);

const looksLikeDateText = (value) => {
  const lowered = String(value || '').toLowerCase();
  if (/^(through|opens|opening|until|ends|closing)\b/.test(lowered)) return true;
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/.test(lowered)) return true;
  if (/\b(spring|summer|fall|winter)\s+\d{4}\b/.test(lowered)) return true;
  return false;
};

const titleFromParagraphs = (paragraphs) => {
  const candidates = paragraphs.filter((value) => !looksLikeDateText(value) && !/^(last chance|member previews?|member last look)$/i.test(value));
  if (!candidates.length) return null;

  return candidates.reduce((longest, candidate) => (candidate.length > longest.length ? candidate : longest), candidates[0]);
};

const dateTextFromParagraphs = (paragraphs) => {
  for (const value of [...paragraphs].reverse()) {
    if (looksLikeDateText(value)) return value;
  }

  return null;
};

const monthFromName = (value) => monthNumbers.get(String(value || '').toLowerCase().slice(0, 4).replace(/\.$/, '')) || null;

const parseMonthDayYear = (monthName, day, year) => {
  const month = monthFromName(monthName);
  if (!month) return null;

  return `${year}-${month}-${String(day).padStart(2, '0')}`;
};

const parseDateRange = (dateText) => {
  if (!dateText) return { startDate: null, endDate: null };

  const normalized = dateText.replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, ' ').trim();

  const through = normalized.match(/^Through ([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?$/i);
  if (through) {
    const endYear = through[3] || '2026';
    return {
      startDate: null,
      endDate: parseMonthDayYear(through[1], through[2], endYear)
    };
  }

  const fullRange = normalized.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})-([A-Za-z]+) (\d{1,2}), (\d{4})$/i);
  if (fullRange) {
    return {
      startDate: parseMonthDayYear(fullRange[1], fullRange[2], fullRange[3]),
      endDate: parseMonthDayYear(fullRange[4], fullRange[5], fullRange[6])
    };
  }

  const sameYearRange = normalized.match(/^([A-Za-z]+) (\d{1,2})-([A-Za-z]+) (\d{1,2}), (\d{4})$/i);
  if (sameYearRange) {
    return {
      startDate: parseMonthDayYear(sameYearRange[1], sameYearRange[2], sameYearRange[5]),
      endDate: parseMonthDayYear(sameYearRange[3], sameYearRange[4], sameYearRange[5])
    };
  }

  const opensMonthYear = normalized.match(/^Opens ([A-Za-z]+) (\d{4})$/i);
  if (opensMonthYear) {
    const month = monthFromName(opensMonthYear[1]);
    return {
      startDate: month ? `${opensMonthYear[2]}-${month}` : opensMonthYear[2],
      endDate: null
    };
  }

  return { startDate: null, endDate: null };
};

const imageFromAnchor = (html, pageUrl) => {
  const match = String(html || '').match(/<(?:source|img)\b[^>]*(?:srcset|src)=["']([^"']+)["']/i);
  if (!match) return null;

  const firstCandidate = match[1].split(',')[0]?.trim().split(/\s+/)[0];
  return absoluteUrl(firstCandidate, pageUrl);
};

export const parseMomaExhibitionsPage = ({ html, url }) => {
  const unique = new Map();

  for (const block of extractAnchorBlocks(html)) {
    const exhibitionUrl = absoluteUrl(block.href, url);
    if (!exhibitionUrl || unique.has(exhibitionUrl)) continue;

    const paragraphs = paragraphTexts(block.html);
    const title = titleFromParagraphs(paragraphs);
    if (!title) continue;

    const dateText = dateTextFromParagraphs(paragraphs);
    const { startDate, endDate } = parseDateRange(dateText);

    unique.set(exhibitionUrl, {
      id: `exhibition:moma:${exhibitionIdFromUrl(exhibitionUrl)}`,
      type: 'exhibition',
      source: 'moma',
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
      imageUrl: imageFromAnchor(block.html, url),
      exhibitionUrl,
      sourceUrl: exhibitionUrl,
      openingReceptionDate: null,
      tags: ['browser-assisted-snapshot'],
      sourceConfidence: 'medium',
      reviewStatus: 'needs_review',
      lastCheckedAt: null,
      sourceNotes:
        'Parsed from a browser-assisted snapshot of MoMA current/upcoming exhibitions because direct backend fetch returns Cloudflare 403. Date text is preserved from the listing page; reviewer should confirm against the live official page before promotion.'
    });
  }

  return [...unique.values()];
};
