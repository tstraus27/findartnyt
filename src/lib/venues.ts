import type { Exhibition } from './exhibitions';

export type VenueLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type VenueMapEntry = VenueLocation & {
  exhibitions: Exhibition[];
};

export type UserLocation = {
  lat: number;
  lng: number;
};

export const venueLocations: Record<string, VenueLocation> = {
  'The Jewish Museum': {
    name: 'The Jewish Museum',
    address: '1109 Fifth Avenue, New York, NY 10128',
    lat: 40.7854,
    lng: -73.9574
  },
  'The Metropolitan Museum of Art': {
    name: 'The Metropolitan Museum of Art',
    address: '1000 Fifth Avenue, New York, NY 10028',
    lat: 40.7794,
    lng: -73.9632
  },
  'The Morgan Library & Museum': {
    name: 'The Morgan Library & Museum',
    address: '225 Madison Avenue, New York, NY 10016',
    lat: 40.7492,
    lng: -73.9815
  },
  'The Museum of Modern Art': {
    name: 'The Museum of Modern Art',
    address: '11 West 53 Street, New York, NY 10019',
    lat: 40.7614,
    lng: -73.9776
  }
};

export const getVenueMapEntries = (records: Exhibition[]): VenueMapEntry[] => {
  const grouped = new Map<string, Exhibition[]>();

  for (const record of records) {
    if (!venueLocations[record.venue]) continue;
    const exhibitions = grouped.get(record.venue) ?? [];
    exhibitions.push(record);
    grouped.set(record.venue, exhibitions);
  }

  return Array.from(grouped.entries())
    .map(([venue, exhibitions]) => ({
      ...venueLocations[venue],
      exhibitions
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const distanceMiles = (from: UserLocation, to: UserLocation) => {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const distanceToVenue = (venue: string, userLocation: UserLocation | null) => {
  if (!userLocation) return Number.POSITIVE_INFINITY;
  const location = venueLocations[venue];
  if (!location) return Number.POSITIVE_INFINITY;
  return distanceMiles(userLocation, location);
};
