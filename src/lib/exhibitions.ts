import launchReadiness from '../../data/public-launch-readiness.json';
import canonicalRecords from '../../data/exhibit-records.json';

type CanonicalRecord = {
  id?: string | null;
  title?: string | null;
  venue?: string | null;
  source?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dateText?: string | null;
  description?: string | null;
  venueAddress?: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  exhibitionUrl?: string | null;
  sourceUrl?: string | null;
  reviewStatus?: string | null;
};

type LaunchReadyRecord = {
  id?: string | null;
  title?: string | null;
  venue?: string | null;
  source?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dateText?: string | null;
  sourceUrl?: string | null;
};

export type DateStatus = 'now' | 'closingSoon' | 'upcoming' | 'currentFuture';
export type SortMode = 'closingSoon' | 'venue' | 'title' | 'startDate' | 'distance';

export type Exhibition = {
  id: string;
  title: string;
  venue: string;
  source: string;
  startDate: string | null;
  endDate: string | null;
  dateText: string;
  listDateText: string;
  description: string | null;
  venueAddress: string | null;
  neighborhood: string | null;
  borough: string | null;
  city: string | null;
  area: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  searchText: string;
};

export type ExhibitionFilters = {
  query: string;
  venues: string[];
  area: string;
  status: DateStatus;
  sort: SortMode;
};

const launchRecords = (launchReadiness as { launchReadyRecords?: LaunchReadyRecord[] }).launchReadyRecords ?? [];
const canonicalById = new Map(
  ((canonicalRecords as { records?: CanonicalRecord[] }).records ?? []).map((record) => [record.id, record])
);

const today = () => new Date().toISOString().slice(0, 10);
const tbdPublicListingDays = 120;
const openEndedPublicListingDays = 365;

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const clean = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const shortMonths = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

const dateParts = (value: string | null) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: match[1], month: Number(match[2]), day: Number(match[3]) };
};

const shortDate = (parts: NonNullable<ReturnType<typeof dateParts>>, includeYear = true) =>
  `${shortMonths[parts.month - 1]} ${parts.day}${includeYear ? `, ${parts.year}` : ''}`;

export const formatListDateRange = (record: {
  startDate: string | null;
  endDate: string | null;
  dateText?: string | null;
}) => {
  const start = dateParts(record.startDate);
  const end = dateParts(record.endDate);

  if (start && end) {
    const sameYear = start.year === end.year;
    return `${shortDate(start, !sameYear)} — ${shortDate(end)}`;
  }
  if (end) return `Through ${shortDate(end)}`;
  if (start) {
    if (/\bTBD\b/i.test(record.dateText || '')) return `${shortDate(start)} — TBD`;
    if (/\bongoing\b/i.test(record.dateText || '')) return `${shortDate(start)} — Ongoing`;
    return `Opens ${shortDate(start)}`;
  }
  return clean(record.dateText) || 'Dates listed at source';
};

export const formatDateRange = (record: { startDate: string | null; endDate: string | null; dateText?: string | null }) => {
  if (record.startDate && record.endDate) return `${record.startDate} - ${record.endDate}`;
  const explicit = clean(record.dateText);
  if (explicit) return explicit;
  if (record.startDate) return `${record.startDate} - Ongoing`;
  if (record.endDate) return `Through ${record.endDate}`;
  return 'Dates listed at source';
};

export const normalizeExhibitionRecords = (records: CanonicalRecord[]): Exhibition[] =>
  records
    .map((record) => {
      const id = clean(record.id);
      const title = clean(record.title);
      const venue = clean(record.venue);
      const sourceUrl = clean(record.sourceUrl) ?? clean(record.exhibitionUrl);

      if (!id || !title || !venue || !sourceUrl) return null;

      const startDate = clean(record.startDate);
      const endDate = clean(record.endDate);
      const dateText = formatDateRange({
        startDate,
        endDate,
        dateText: clean(record.dateText)
      });
      const listDateText = formatListDateRange({ startDate, endDate, dateText });
      const neighborhood = clean(record.neighborhood);
      const borough = clean(record.borough);
      const city = clean(record.city);
      const area = neighborhood ?? borough;
      const source = clean(record.source) ?? venue;
      const description = clean(record.description);
      const venueAddress = clean(record.venueAddress);
      const imageUrl = clean(record.imageUrl);

      const searchText = [title, venue, source, neighborhood, borough, city, description, venueAddress, dateText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        id,
        title,
        venue,
        source,
        startDate,
        endDate,
        dateText,
        listDateText,
        description,
        venueAddress,
        neighborhood,
        borough,
        city,
        area,
        imageUrl,
        sourceUrl,
        searchText
      };
    })
    .filter((record): record is Exhibition => Boolean(record));

export const normalizeLaunchRecords = (): Exhibition[] => {
  return launchRecords
    .map((launchRecord) => {
      const canonical = canonicalById.get(launchRecord.id) ?? {};
      const id = clean(launchRecord.id) ?? clean(canonical.id);
      const title = clean(launchRecord.title) ?? clean(canonical.title);
      const venue = clean(launchRecord.venue) ?? clean(canonical.venue);
      const sourceUrl = clean(launchRecord.sourceUrl) ?? clean(canonical.sourceUrl) ?? clean(canonical.exhibitionUrl);

      if (!id || !title || !venue || !sourceUrl) return null;

      const startDate = clean(launchRecord.startDate) ?? clean(canonical.startDate);
      const endDate = clean(launchRecord.endDate) ?? clean(canonical.endDate);
      const dateText = formatDateRange({
        startDate,
        endDate,
        dateText: clean(launchRecord.dateText) ?? clean(canonical.dateText)
      });
      const listDateText = formatListDateRange({ startDate, endDate, dateText });
      const neighborhood = clean(canonical.neighborhood);
      const borough = clean(canonical.borough);
      const city = clean(canonical.city);
      const area = neighborhood ?? borough;
      const source = clean(launchRecord.source) ?? clean(canonical.source) ?? venue;
      const description = clean(canonical.description);
      const venueAddress = clean(canonical.venueAddress);
      const imageUrl = clean(canonical.imageUrl);

      const searchText = [
        title,
        venue,
        source,
        neighborhood,
        borough,
        city,
        description,
        venueAddress,
        dateText
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        id,
        title,
        venue,
        source,
        startDate,
        endDate,
        dateText,
        listDateText,
        description,
        venueAddress,
        neighborhood,
        borough,
        city,
        area,
        imageUrl,
        sourceUrl,
        searchText
      };
    })
    .filter((record): record is Exhibition => Boolean(record));
};

export const exhibitions = normalizeLaunchRecords();

export const getVenueOptions = (records: Exhibition[] = exhibitions) =>
  Array.from(new Set(records.map((record) => record.venue))).sort((a, b) => a.localeCompare(b));

export const getAreaOptions = (records: Exhibition[] = exhibitions) =>
  Array.from(new Set(records.map((record) => record.area).filter((area): area is string => Boolean(area)))).sort((a, b) =>
    a.localeCompare(b)
  );

export const publicListingCutoff = (record: Pick<Exhibition, 'startDate' | 'endDate' | 'dateText'>) => {
  if (record.endDate) return record.endDate;
  if (!record.startDate) return null;
  return addDays(record.startDate, /\bTBD\b/i.test(record.dateText) ? tbdPublicListingDays : openEndedPublicListingDays);
};

export const isOnViewNow = (record: Exhibition, asOf = today()) => {
  const startsBeforeOrToday = !record.startDate || record.startDate <= asOf;
  const listingCutoff = publicListingCutoff(record);
  return startsBeforeOrToday && Boolean(listingCutoff && listingCutoff >= asOf);
};

export const isUpcoming = (record: Exhibition, asOf = today()) => Boolean(record.startDate && record.startDate > asOf);

export const isCurrentOrFuture = (record: Exhibition, asOf = today()) => {
  const listingCutoff = publicListingCutoff(record);
  return Boolean(listingCutoff && listingCutoff >= asOf);
};

export const isClosingSoon = (record: Exhibition, asOf = today()) => {
  if (!isOnViewNow(record, asOf) || !record.endDate) return false;
  const now = new Date(`${asOf}T00:00:00Z`).getTime();
  const end = new Date(`${record.endDate}T00:00:00Z`).getTime();
  const days = (end - now) / 86_400_000;
  return days >= 0 && days <= 45;
};

const statusMatches = (record: Exhibition, status: DateStatus, asOf = today()) => {
  if (status === 'now') return isOnViewNow(record, asOf);
  if (status === 'closingSoon') return isClosingSoon(record, asOf);
  if (status === 'upcoming') return isUpcoming(record, asOf);
  return isCurrentOrFuture(record, asOf);
};

const sortDate = (value: string | null, fallback: string) => value ?? fallback;

export const filterAndSortExhibitions = (
  records: Exhibition[],
  filters: ExhibitionFilters,
  asOf = today()
) => {
  const queryTerms = filters.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const selectedVenues = new Set(filters.venues);

  const filtered = records.filter((record) => {
    if (!statusMatches(record, filters.status, asOf)) return false;
    if (selectedVenues.size > 0 && !selectedVenues.has(record.venue)) return false;
    if (filters.area && record.area !== filters.area) return false;
    return queryTerms.every((term) => record.searchText.includes(term));
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === 'venue') {
      return left.venue.localeCompare(right.venue) || left.title.localeCompare(right.title);
    }
    if (filters.sort === 'title') return left.title.localeCompare(right.title);
    if (filters.sort === 'startDate') {
      return sortDate(left.startDate, '9999-99-99').localeCompare(sortDate(right.startDate, '9999-99-99'));
    }
    return (
      sortDate(left.endDate, '9999-99-99').localeCompare(sortDate(right.endDate, '9999-99-99')) ||
      left.venue.localeCompare(right.venue) ||
      left.title.localeCompare(right.title)
    );
  });
};

export const toEventJsonLd = (records: Exhibition[]) =>
  records.map((record) => ({
    '@context': 'https://schema.org',
    '@type': 'ExhibitionEvent',
    name: record.title,
    url: record.sourceUrl,
    startDate: record.startDate ?? undefined,
    endDate: record.endDate ?? undefined,
    image: record.imageUrl ?? undefined,
    description: record.description ?? undefined,
    location: {
      '@type': 'Place',
      name: record.venue,
      address: [record.venueAddress, record.neighborhood, record.borough, record.city].filter(Boolean).join(', ') || undefined
    }
  }));
