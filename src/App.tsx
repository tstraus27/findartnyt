import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AdminDashboard, AdminHistory, AdminLogin, AdminReview, FeaturedContentAdmin } from './components/AdminReview';
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
  sort: 'closingSoon'
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
      <td>{record.venue}</td>
      <td className={closingSoon ? 'closing-soon-date' : undefined}>{record.dateText}</td>
      <td>
        <a href={record.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          source
        </a>
      </td>
    </tr>
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
        <DetailRow label="Venue">{record.venue}</DetailRow>
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

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [filters, setFilters] = useState<ExhibitionFilters>(() => parseFilters());
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialSelectedId());
  const [showMap, setShowMap] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [catalogRecords, setCatalogRecords] = useState<Exhibition[]>(() => exhibitions);
  const [featuredContent, setFeaturedContent] = useState<FeaturedContent | null>(null);
  const [featuredHistory, setFeaturedHistory] = useState<FeaturedContent[]>([]);
  const venueOptions = useMemo(() => getVenueOptions(catalogRecords), [catalogRecords]);
  const areaOptions = useMemo(() => getAreaOptions(catalogRecords), [catalogRecords]);
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
      })
      .catch((error) => {
        console.warn('Using local catalog fallback.', error);
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
    if (path.startsWith('/admin')) return;
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
    const matching = mapRecords.filter((record) => record.venue === venue);
    setFilters((current) => ({ ...current, venues: [venue] }));
    setSelectedId(matching[0]?.id ?? null);
  };

  const clearVenue = () => {
    setFilters((current) => ({ ...current, venues: [] }));
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

  return (
    <main className="app">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toEventJsonLd(catalogRecords)) }}
      />
      <header className="site-header">
        <div>
          <h1>FindArtNYC</h1>
          <p>Public beta.</p>
        </div>
        <a className="admin-link" href="/admin/login">Admin sign-on</a>
      </header>

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

            <details className="menu-filter">
              <summary>Venue: {venueSummary}</summary>
              <div className="menu-panel">
                {venueOptions.map((venue) => (
                  <label key={venue} className="checkline">
                    <input
                      type="checkbox"
                      checked={filters.venues.includes(venue)}
                      onChange={() => toggleVenue(venue)}
                    />
                    {venue}
                  </label>
                ))}
              </div>
            </details>

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
                  <th scope="col">Exhibition</th>
                  <th scope="col">Venue</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Link</th>
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
                <section className="featured-content" aria-label="Featured exhibition">
                  <div>
                    <p className="featured-label">Featured</p>
                    <h2>{featuredContent.title}</h2>
                    {featuredContent.dek && <p className="featured-dek">{featuredContent.dek}</p>}
                    {featuredContent.bodyMarkdown && <p>{featuredContent.bodyMarkdown}</p>}
                    {featuredContent.ctaUrl && (
                      <a href={featuredContent.ctaUrl} target="_blank" rel="noreferrer">
                        More information
                      </a>
                    )}
                  </div>
                  {featuredContent.imageUrl && <img src={featuredContent.imageUrl} alt="" loading="lazy" />}
                </section>
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
    </main>
  );
}
