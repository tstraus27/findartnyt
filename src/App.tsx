import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AdminDashboard, AdminHistory, AdminLogin, AdminReview, FeaturedContentAdmin } from './components/AdminReview';
import { FeatureRichText } from './components/FeatureRichText';
import { VenueMap } from './components/VenueMap';
import { backend, type FeaturedContent } from './lib/backend/findArtBackend';
import {
  DateStatus,
  Exhibition,
  ExhibitionFilters,
  SortMode,
  exhibitions,
  filterAndSortExhibitions,
  getAreaOptions,
  getVenueOptions,
  toEventJsonLd
} from './lib/exhibitions';
import { distanceToVenue, getVenueMapEntries, type UserLocation } from './lib/venues';

const statusOptions: { value: DateStatus; label: string }[] = [
  { value: 'now', label: 'On view now' },
  { value: 'closingSoon', label: 'Closing soon' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'currentFuture', label: 'All current/future' }
];

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'closingSoon', label: 'Closing soon' },
  { value: 'distance', label: 'Closest to me' },
  { value: 'venue', label: 'Venue A-Z' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'startDate', label: 'Start date' }
];

const defaultFilters: ExhibitionFilters = {
  query: '',
  venues: [],
  area: '',
  status: 'now',
  sort: 'venue'
};

const validStatus = (value: string | null): DateStatus =>
  statusOptions.some((option) => option.value === value) ? (value as DateStatus) : defaultFilters.status;

const validSort = (value: string | null): SortMode =>
  sortOptions.some((option) => option.value === value) ? (value as SortMode) : defaultFilters.sort;

const parseFilters = (): ExhibitionFilters => {
  const params = new URLSearchParams(window.location.search);
  return {
    query: params.get('q') ?? '',
    venues: (params.get('venue') ?? '').split('|').filter(Boolean),
    area: params.get('area') ?? '',
    status: validStatus(params.get('status')),
    sort: validSort(params.get('sort'))
  };
};

const updateUrl = (filters: ExhibitionFilters, selectedId: string | null) => {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.venues.length) params.set('venue', filters.venues.join('|'));
  if (filters.area) params.set('area', filters.area);
  if (filters.status !== defaultFilters.status) params.set('status', filters.status);
  if (filters.sort !== defaultFilters.sort) params.set('sort', filters.sort);
  if (selectedId) params.set('selected', selectedId);

  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
  window.history.replaceState(null, '', next);
};

const getInitialSelectedId = () => new URLSearchParams(window.location.search).get('selected');

const toVenueSlug = (venue: string) =>
  venue
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const venuePath = (venue: string) => `/venue/${toVenueSlug(venue)}`;

const catalogRecordPath = (record: Exhibition, status: DateStatus) => {
  const params = new URLSearchParams({
    venue: record.venue,
    status,
    selected: record.id
  });
  return `/?${params.toString()}`;
};

const closesWithinDays = (record: Exhibition, days: number) => {
  if (!record.endDate) return false;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(`${record.endDate}T00:00:00Z`).getTime();
  const diffDays = (end - today) / 86_400_000;
  return diffDays >= 0 && diffDays <= days;
};

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="detail-row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

function ResultRow({
  record,
  selected,
  onSelect
}: {
  record: Exhibition;
  selected: boolean;
  onSelect: (record: Exhibition) => void;
}) {
  const closingSoon = closesWithinDays(record, 14);
  const [imageFailed, setImageFailed] = useState(false);
  const showThumbnail = Boolean(record.imageUrl && !imageFailed);

  return (
    <tr
      className={selected ? 'selected selectable-row' : 'selectable-row'}
      onClick={() => onSelect(record)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(record);
        }
      }}
      aria-selected={selected}
    >
      <td className="desktop-thumbnail-cell">
        {showThumbnail && (
          <img
            className="desktop-result-thumbnail"
            src={record.imageUrl ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
      </td>
      <td>
        <button
          type="button"
          className="row-select"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(record);
          }}
          aria-pressed={selected}
        >
          {record.title}
        </button>
      </td>
      <td>
        <a className="venue-link" href={venuePath(record.venue)} onClick={(event) => event.stopPropagation()}>
          {record.venue}
        </a>
      </td>
      <td className={closingSoon ? 'closing-soon-date' : undefined}>{record.listDateText}</td>
    </tr>
  );
}

function MobileResultRow({ record, onSelect }: { record: Exhibition; onSelect: (record: Exhibition) => void }) {
  const closingSoon = closesWithinDays(record, 14);
  const [imageFailed, setImageFailed] = useState(false);
  const showThumbnail = Boolean(record.imageUrl && !imageFailed);

  return (
    <li className="mobile-result-row">
      <div className={showThumbnail ? 'mobile-result-layout with-thumbnail' : 'mobile-result-layout'}>
        <div className="mobile-result-copy">
          <button type="button" className="mobile-result-select" onClick={() => onSelect(record)}>
            <span className="mobile-result-title">{record.title}</span>
          </button>
          <span className="mobile-result-venue-line">
            at <a className="venue-link" href={venuePath(record.venue)}>{record.venue}</a>
          </span>
          <span className={closingSoon ? 'mobile-result-date closing-soon-date' : 'mobile-result-date'}>
            {record.listDateText}
          </span>
        </div>
        {showThumbnail && (
          <img
            className="mobile-result-thumbnail"
            src={record.imageUrl ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
    </li>
  );
}

function DetailPane({ record }: { record: Exhibition | null }) {
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    setShowMore(false);
  }, [record?.id]);

  if (!record) {
    return (
      <section className="detail empty" aria-label="Selected exhibition">
        <p>Select an exhibition from the list.</p>
      </section>
    );
  }

  return (
    <section className="detail" aria-label="Selected exhibition">
      <h2>{record.title}</h2>
      <dl>
        <DetailRow label="Venue">
          <a className="venue-link" href={venuePath(record.venue)}>{record.venue}</a>
        </DetailRow>
        <DetailRow label="Dates">{record.dateText}</DetailRow>
        {(record.neighborhood || record.borough || record.city) && (
          <DetailRow label="Place">
            {[record.neighborhood, record.borough, record.city].filter(Boolean).join(', ')}
          </DetailRow>
        )}
        {record.venueAddress && <DetailRow label="Address">{record.venueAddress}</DetailRow>}
      </dl>

      {record.imageUrl && <img src={record.imageUrl} alt="" className="exhibition-image" loading="lazy" />}
      {record.description && <p className="description">{record.description}</p>}

      <div className="more-info">
        <button type="button" className="more-toggle" onClick={() => setShowMore((current) => !current)}>
          [{showMore ? 'less information' : 'more information'}]
        </button>
        {showMore && (
          <dl>
            <DetailRow label="Source">{record.source}</DetailRow>
            <DetailRow label="Record ID">{record.id}</DetailRow>
            {record.imageUrl && (
              <DetailRow label="Image">
                <a href={record.imageUrl} target="_blank" rel="noreferrer">
                  image source
                </a>
              </DetailRow>
            )}
          </dl>
        )}
      </div>

      <p className="official-link">
        <a href={record.sourceUrl} target="_blank" rel="noreferrer">
          Official source
        </a>
      </p>
    </section>
  );
}

function FeaturedCard({ content }: { content: FeaturedContent }) {
  return (
    <section className="featured-content" aria-label="Featured exhibition">
      <div>
        <p className="featured-label">Featured</p>
        <h2>{content.title}</h2>
        {content.dek && <p className="featured-dek">{content.dek}</p>}
        {content.bodyMarkdown && <FeatureRichText value={content.bodyMarkdown} />}
        {content.ctaUrl && (
          <a href={content.ctaUrl} target="_blank" rel="noreferrer">
            More information
          </a>
        )}
      </div>
      {content.imageUrl && <img src={content.imageUrl} alt="" loading="lazy" />}
    </section>
  );
}

function PublicHeader({ linkedTitle = false }: { linkedTitle?: boolean }) {
  return (
    <header className="site-header">
      <div>
        <h1>
          {linkedTitle ? <a className="site-title-link" href="/">FindArtNYC</a> : 'FindArtNYC'}
        </h1>
        <p>Public beta.</p>
      </div>
      <a className="admin-link" href="/admin/login">Admin sign-on</a>
    </header>
  );
}

function VenueExhibitionGroup({
  title,
  records,
  status,
  emptyText
}: {
  title: string;
  records: Exhibition[];
  status: DateStatus;
  emptyText: string;
}) {
  return (
    <section className="venue-exhibition-group">
      <div className="venue-group-heading">
        <h2>{title}</h2>
        <span>{records.length}</span>
      </div>
      {records.length > 0 ? (
        <ol>
          {records.map((record) => (
            <li key={record.id}>
              <a href={catalogRecordPath(record, status)}>{record.title}</a>
              <span>{record.listDateText}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function VenuePage({ venue, records, loading }: { venue: string | null; records: Exhibition[]; loading: boolean }) {
  if (!venue) {
    return (
      <main className="app venue-page">
        <PublicHeader linkedTitle />
        <a className="venue-back-link" href="/">&larr; All exhibitions</a>
        <h2>{loading ? 'Loading venue...' : 'Venue not found'}</h2>
      </main>
    );
  }

  const venueRecords = records.filter((record) => record.venue === venue);
  const currentRecords = filterAndSortExhibitions(venueRecords, {
    ...defaultFilters,
    venues: [venue],
    status: 'now'
  });
  const upcomingRecords = filterAndSortExhibitions(venueRecords, {
    ...defaultFilters,
    venues: [venue],
    status: 'upcoming',
    sort: 'startDate'
  });
  const address = venueRecords.find((record) => record.venueAddress)?.venueAddress;
  const placeRecord = venueRecords.find((record) => record.neighborhood || record.borough || record.city);
  const place = placeRecord
    ? [placeRecord.neighborhood, placeRecord.borough, placeRecord.city].filter(Boolean).join(', ')
    : null;

  return (
    <main className="app venue-page">
      <PublicHeader linkedTitle />
      <a className="venue-back-link" href="/">&larr; All exhibitions</a>
      <header className="venue-page-header">
        <p className="venue-page-label">Venue</p>
        <h2>{venue}</h2>
        {address && <p>{address}</p>}
        {place && <p>{place}</p>}
      </header>
      <div className="venue-page-groups">
        <VenueExhibitionGroup
          title="On view now"
          records={currentRecords}
          status="now"
          emptyText="No exhibitions currently on view."
        />
        <VenueExhibitionGroup
          title="Upcoming"
          records={upcomingRecords}
          status="upcoming"
          emptyText="No upcoming exhibitions."
        />
      </div>
      <footer className="mobile-footer">
        <a href="/admin/login">Admin</a>
      </footer>
    </main>
  );
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [filters, setFilters] = useState<ExhibitionFilters>(() => parseFilters());
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialSelectedId());
  const [showMap, setShowMap] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail' | 'map'>(() =>
    getInitialSelectedId() ? 'detail' : 'list'
  );
  const [mobileMenu, setMobileMenu] = useState<'venues' | 'filters' | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [catalogRecords, setCatalogRecords] = useState<Exhibition[]>(() => exhibitions);
  const [catalogReady, setCatalogReady] = useState(false);
  const [featuredContent, setFeaturedContent] = useState<FeaturedContent | null>(null);
  const [featuredHistory, setFeaturedHistory] = useState<FeaturedContent[]>([]);
  const mobileListScroll = useRef(0);
  const venueOptions = useMemo(() => getVenueOptions(catalogRecords), [catalogRecords]);
  const areaOptions = useMemo(() => getAreaOptions(catalogRecords), [catalogRecords]);
  const venueDirectory = useMemo(
    () =>
      venueOptions.map((venue) => ({
        venue,
        currentCount: filterAndSortExhibitions(catalogRecords, {
          ...defaultFilters,
          venues: [venue],
          status: 'now'
        }).length,
        upcomingCount: filterAndSortExhibitions(catalogRecords, {
          ...defaultFilters,
          venues: [venue],
          status: 'upcoming'
        }).length
      })),
    [catalogRecords, venueOptions]
  );
  const filteredRecords = useMemo(() => {
    const records = filterAndSortExhibitions(catalogRecords, filters);
    if (filters.sort !== 'distance' || !userLocation) return records;

    return [...records].sort((left, right) => {
      const distance =
        distanceToVenue(left.venue, userLocation) - distanceToVenue(right.venue, userLocation);
      return distance || left.venue.localeCompare(right.venue) || left.title.localeCompare(right.title);
    });
  }, [catalogRecords, filters, userLocation]);
  const mapRecords = useMemo(
    () => filterAndSortExhibitions(catalogRecords, { ...filters, venues: [] }),
    [catalogRecords, filters]
  );
  const venueMapEntries = useMemo(() => getVenueMapEntries(mapRecords), [mapRecords]);
  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedId) ??
    filteredRecords[0] ??
    catalogRecords.find((record) => record.id === selectedId) ??
    null;

  useEffect(() => {
    let active = true;
    Promise.all([backend.getPublicExhibitions(), backend.getPublishedFeaturedContent(), backend.getFeaturedContentHistory()])
      .then(([records, featured, history]) => {
        if (!active) return;
        setCatalogRecords(records);
        setFeaturedContent(featured);
        setFeaturedHistory(history.filter((entry) => entry.id !== featured?.id));
        setCatalogReady(true);
      })
      .catch((error) => {
        console.warn('Using local catalog fallback.', error);
        if (active) setCatalogReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (filteredRecords.length === 0) return;
    if (!selectedId || !filteredRecords.some((record) => record.id === selectedId)) {
      setSelectedId(filteredRecords[0].id);
    }
  }, [filteredRecords, selectedId]);

  useEffect(() => {
    if (path.startsWith('/admin') || path.startsWith('/venue/')) return;
    updateUrl(filters, selectedRecord?.id ?? null);
  }, [filters, path, selectedRecord?.id]);

  const updateFilters = (next: Partial<ExhibitionFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
  };

  const toggleVenue = (venue: string) => {
    setFilters((current) => {
      const venues = current.venues.includes(venue)
        ? current.venues.filter((item) => item !== venue)
        : [...current.venues, venue];
      return { ...current, venues };
    });
  };

  const selectVenue = (venue: string) => {
    window.location.assign(venuePath(venue));
  };

  const clearVenue = () => {
    setFilters((current) => ({ ...current, venues: [] }));
  };

  const selectMobileRecord = (record: Exhibition) => {
    mobileListScroll.current = window.scrollY;
    setSelectedId(record.id);
    setMobileView('detail');
    window.scrollTo({ top: 0 });
  };

  const returnToMobileList = () => {
    setMobileView('list');
    window.requestAnimationFrame(() => window.scrollTo({ top: mobileListScroll.current }));
  };

  const clearMobileFilters = () => {
    setFilters((current) => ({
      ...current,
      venues: [],
      area: '',
      status: defaultFilters.status,
      sort: defaultFilters.sort
    }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not available in this browser.');
      return;
    }

    setShowMap(true);
    setLocationStatus('Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(nextLocation);
        setFilters((current) => ({ ...current, sort: 'distance' }));
        setLocationStatus('Sorting by closest venue.');
      },
      () => {
        setLocationStatus('Could not use location.');
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 10_000
      }
    );
  };

  const venueSummary =
    filters.venues.length === 0
      ? 'Any venue'
      : filters.venues.length === 1
        ? filters.venues[0]
      : `${filters.venues.length} venues`;
  const mobileFilterCount =
    Number(Boolean(filters.area)) +
    Number(filters.status !== defaultFilters.status) +
    Number(filters.sort !== defaultFilters.sort);
  const venueRouteMatch = path.match(/^\/venue\/([^/]+)\/?$/);
  const routeVenue = venueRouteMatch
    ? venueOptions.find((venue) => toVenueSlug(venue) === venueRouteMatch[1]) ?? null
    : null;

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  if (path === '/admin/login') return <AdminLogin />;
  if (path === '/admin') return <AdminDashboard />;
  if (path.startsWith('/admin/review')) return <AdminReview />;
  if (path.startsWith('/admin/history')) return <AdminHistory />;
  if (path.startsWith('/admin/featured')) return <FeaturedContentAdmin />;
  if (venueRouteMatch) return <VenuePage venue={routeVenue} records={catalogRecords} loading={!catalogReady} />;

  return (
    <main className="app">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toEventJsonLd(catalogRecords)) }}
      />
      <PublicHeader />

      <form className="search-strip" onSubmit={(event) => event.preventDefault()} aria-label="Catalog search controls">
        <fieldset>
          <legend>Catalog search</legend>
          <div className="search-grid">
            <label className="search-main" htmlFor="search">
              <span>Text</span>
              <input
                id="search"
                type="search"
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                placeholder="title, venue, area, dates"
              />
            </label>

            <div className="venue-filter-control">
              <span>Venue</span>
              <details className="menu-filter">
                <summary>{venueSummary}</summary>
                <div className="menu-panel">
                  {venueOptions.map((venue) => (
                    <div key={venue} className="venue-filter-option">
                      <label className="checkline">
                        <input
                          type="checkbox"
                          checked={filters.venues.includes(venue)}
                          onChange={() => toggleVenue(venue)}
                        />
                        {venue}
                      </label>
                      <a href={venuePath(venue)}>view</a>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <label htmlFor="area">
              <span>Area</span>
              <select id="area" value={filters.area} onChange={(event) => updateFilters({ area: event.target.value })}>
                <option value="">Any area</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="status">
              <span>Status</span>
              <select
                id="status"
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value as DateStatus })}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkline disabled picks">
              <input type="checkbox" disabled />
              Toby&apos;s Picks (soon)
            </label>
          </div>
        </fieldset>
      </form>

      <section className="mobile-catalog" aria-label="Mobile exhibition catalog">
        {mobileView !== 'detail' && (
          <form className="mobile-search" onSubmit={(event) => event.preventDefault()} aria-label="Catalog search controls">
            <label className="visually-hidden" htmlFor="mobile-search-input">
              Search exhibitions
            </label>
            <input
              id="mobile-search-input"
              type="search"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Search exhibitions"
            />

            <div className="mobile-primary-menus">
              <button
                type="button"
                className={mobileMenu === 'venues' ? 'selected' : undefined}
                aria-expanded={mobileMenu === 'venues'}
                aria-controls="mobile-venue-browser"
                onClick={() => setMobileMenu((current) => current === 'venues' ? null : 'venues')}
              >
                Venues
              </button>
              <button
                type="button"
                className={mobileMenu === 'filters' ? 'selected' : undefined}
                aria-expanded={mobileMenu === 'filters'}
                aria-controls="mobile-filter-panel"
                onClick={() => setMobileMenu((current) => current === 'filters' ? null : 'filters')}
              >
                Filters{mobileFilterCount ? ` (${mobileFilterCount})` : ''}
              </button>
            </div>

            {mobileMenu === 'venues' && (
              <nav id="mobile-venue-browser" className="mobile-venue-browser" aria-label="Browse venues">
                {venueDirectory.map(({ venue, currentCount, upcomingCount }) => (
                  <a key={venue} href={venuePath(venue)}>
                    <strong>{venue}</strong>
                    <span>
                      {currentCount} on view{upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ''}
                    </span>
                  </a>
                ))}
              </nav>
            )}

            {mobileMenu === 'filters' && (
              <div id="mobile-filter-panel" className="mobile-filter-panel">
                  <label htmlFor="mobile-status">
                    <span>Status</span>
                    <select
                      id="mobile-status"
                      value={filters.status}
                      onChange={(event) => updateFilters({ status: event.target.value as DateStatus })}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label htmlFor="mobile-area">
                    <span>Area</span>
                    <select
                      id="mobile-area"
                      value={filters.area}
                      onChange={(event) => updateFilters({ area: event.target.value })}
                    >
                      <option value="">Any area</option>
                      {areaOptions.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label htmlFor="mobile-sort">
                    <span>Sort</span>
                    <select
                      id="mobile-sort"
                      value={filters.sort}
                      onChange={(event) => updateFilters({ sort: event.target.value as SortMode })}
                    >
                      {sortOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={option.value === 'distance' && !userLocation}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {mobileFilterCount > 0 && (
                    <button type="button" className="plain-button mobile-clear-filters" onClick={clearMobileFilters}>
                      Clear filters
                    </button>
                  )}
              </div>
            )}

          </form>
        )}

        {mobileView !== 'detail' && (
          <div className="mobile-results-heading">
            <div className="mobile-results-context">
              <strong>
                {mobileView === 'list'
                  ? `${filteredRecords.length} exhibition${filteredRecords.length === 1 ? '' : 's'}`
                  : 'Venue map'}
              </strong>
              <span>{statusOptions.find((option) => option.value === filters.status)?.label}</span>
            </div>
            <div className="mobile-view-switch" aria-label="Catalog view">
              <button
                type="button"
                className={mobileView === 'list' ? 'selected' : undefined}
                aria-pressed={mobileView === 'list'}
                onClick={() => setMobileView('list')}
              >
                List
              </button>
              <button
                type="button"
                className={mobileView === 'map' ? 'selected' : undefined}
                aria-pressed={mobileView === 'map'}
                onClick={() => setMobileView('map')}
              >
                Map
              </button>
            </div>
          </div>
        )}

        {mobileView === 'list' && (
          <div className="mobile-list-view">
            {filteredRecords.length > 0 ? (
              <ol className="mobile-results">
                {filteredRecords.map((record) => (
                  <MobileResultRow key={record.id} record={record} onSelect={selectMobileRecord} />
                ))}
              </ol>
            ) : (
              <p className="mobile-empty-results">No matching exhibitions.</p>
            )}

            {featuredContent && (
              <section className="mobile-featured" aria-label="Featured exhibitions">
                <FeaturedCard content={featuredContent} />
              </section>
            )}
          </div>
        )}

        {mobileView === 'detail' && (
          <section className="mobile-detail-view">
            <button type="button" className="mobile-back" onClick={returnToMobileList}>
              &larr; {filteredRecords.length} exhibition{filteredRecords.length === 1 ? '' : 's'}
            </button>
            <DetailPane record={selectedRecord} />
            <button type="button" className="plain-button mobile-detail-map" onClick={() => setMobileView('map')}>
              Show on map
            </button>
          </section>
        )}

        {mobileView === 'map' && (
          <section className="mobile-map-view" aria-label="Venue map and venue filter">
            <div className="mobile-map-heading mobile-map-actions-only">
              <button type="button" className="plain-button" onClick={useCurrentLocation}>
                Use my location
              </button>
            </div>
            <VenueMap
              entries={venueMapEntries}
              selectedVenue={filters.venues.length === 1 ? filters.venues[0] : null}
              userLocation={userLocation}
              onSelectVenue={(venue) => {
                selectVenue(venue);
                setMobileView('list');
              }}
              onClearVenue={clearVenue}
            />
            <p className="map-note">
              Select a venue pin to show its exhibitions in the list.
              {locationStatus && <span className="location-status"> {locationStatus}</span>}
            </p>
          </section>
        )}
      </section>

      <div className="catalog-desk">
        <section className="catalog-left" aria-label="Exhibition catalog results">
          <div className="results-head">
            <div>
              <p className="result-count">
                {filteredRecords.length} result{filteredRecords.length === 1 ? '' : 's'} from {catalogRecords.length} approved public records.
              </p>
              <h2>Exhibition results</h2>
            </div>
            <label htmlFor="sort">
              <span>Sort</span>
              <select
                id="sort"
                value={filters.sort}
                onChange={(event) => updateFilters({ sort: event.target.value as SortMode })}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={option.value === 'distance' && !userLocation}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="results-wrap">
            <table className="results">
              <caption>Exhibition results</caption>
              <thead>
                <tr>
                  <th scope="col" className="desktop-thumbnail-heading">
                    <span className="visually-hidden">Image</span>
                  </th>
                  <th scope="col">Exhibition</th>
                  <th scope="col">Venue</th>
                  <th scope="col">Dates</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <ResultRow
                    key={record.id}
                    record={record}
                    selected={record.id === selectedRecord?.id}
                    onSelect={(nextRecord) => setSelectedId(nextRecord.id)}
                  />
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={4}>No matching exhibitions.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="catalog-right" aria-label="Selected exhibition and map">
          <DetailPane record={selectedRecord} />

          <section className={showMap ? 'venue-map open' : 'venue-map'} aria-label="Venue map and venue filter">
            <div className="map-heading">
              {showMap && <h2>Venue map</h2>}
              <div className="map-actions">
                {showMap && filters.venues.length > 0 && (
                  <button type="button" className="plain-button" onClick={clearVenue}>
                    clear venue
                  </button>
                )}
                <button type="button" className="plain-button show-map-button" onClick={() => setShowMap((current) => !current)}>
                  {showMap ? 'hide map' : 'show map'}
                </button>
                {showMap && (
                  <button type="button" className="plain-button" onClick={useCurrentLocation}>
                    use my location
                  </button>
                )}
              </div>
            </div>
            {showMap && (
              <>
                <VenueMap
                  entries={venueMapEntries}
                  selectedVenue={filters.venues.length === 1 ? filters.venues[0] : null}
                  userLocation={userLocation}
                  onSelectVenue={selectVenue}
                  onClearVenue={clearVenue}
                />
                <p className="map-note">
                  Click a venue pin to show its exhibitions in the list.
                  {locationStatus && <span className="location-status"> {locationStatus}</span>}
                </p>
              </>
            )}
          </section>

          {(featuredContent || featuredHistory.length > 0) && (
            <section className="featured-footer" aria-label="Featured exhibitions">
              {featuredContent && (
                <FeaturedCard content={featuredContent} />
              )}

              {featuredHistory.length > 0 && (
                <details className="featured-history">
                  <summary>Feature history</summary>
                  <div className="featured-history-list">
                    {featuredHistory.map((entry) => (
                      <article key={entry.id}>
                        <strong>{entry.title}</strong>
                        {entry.dek && <span>{entry.dek}</span>}
                        <small>
                          {entry.status}
                          {entry.publishedAt ? ` · ${new Date(entry.publishedAt).toLocaleDateString()}` : ''}
                        </small>
                        {entry.ctaUrl && (
                          <a href={entry.ctaUrl} target="_blank" rel="noreferrer">
                            source
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}
        </section>
      </div>

      <footer className="mobile-footer">
        <a href="/admin/login">Admin</a>
      </footer>
    </main>
  );
}
