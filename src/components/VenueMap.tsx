import { useEffect, useRef } from 'react';
import L, { type LatLngExpression, type LatLngTuple, type Map as LeafletMap, type Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { UserLocation, VenueMapEntry } from '../lib/venues';

const nycCenter: LatLngExpression = [40.7679, -73.9705];

type VenueMapProps = {
  entries: VenueMapEntry[];
  selectedVenue: string | null;
  userLocation: UserLocation | null;
  onSelectVenue: (venue: string) => void;
  onClearVenue: () => void;
};

export function VenueMap({ entries, selectedVenue, userLocation, onSelectVenue, onClearVenue }: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelectVenue);
  const onClearRef = useRef(onClearVenue);
  const selectedVenueRef = useRef(selectedVenue);

  useEffect(() => {
    onSelectRef.current = onSelectVenue;
  }, [onSelectVenue]);

  useEffect(() => {
    onClearRef.current = onClearVenue;
  }, [onClearVenue]);

  useEffect(() => {
    selectedVenueRef.current = selectedVenue;
  }, [selectedVenue]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: nycCenter,
      zoom: 12,
      scrollWheelZoom: false,
      closePopupOnClick: false,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      userMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds: LatLngTuple[] = [];

    for (const entry of entries) {
      const count = entry.exhibitions.length;
      const marker = L.marker([entry.lat, entry.lng], {
        title: `${entry.name}: ${count} exhibition${count === 1 ? '' : 's'}`
      })
        .bindPopup(
          `<strong>${entry.name}</strong><br>${count} exhibition${count === 1 ? '' : 's'}<br>${entry.address}`,
          {
            autoClose: false,
            closeOnClick: false
          }
        )
        .on('click', () => {
          onSelectRef.current(entry.name);
        })
        .on('popupclose', () => {
          if (selectedVenueRef.current === entry.name) {
            onClearRef.current();
          }
        })
        .addTo(map);

      if (entry.name === selectedVenue) {
        marker.openPopup();
      }

      markersRef.current.push(marker);
      bounds.push([entry.lat, entry.lng]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [22, 22], maxZoom: 14 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else {
      map.setView(nycCenter, 12);
    }
  }, [entries, selectedVenue]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    const location: LatLngTuple = [userLocation.lat, userLocation.lng];
    userMarkerRef.current = L.marker(location, {
      title: 'Your location',
      opacity: 0.8
    })
      .bindPopup('Your location')
      .addTo(map);

    map.setView(location, Math.max(map.getZoom(), 13));
  }, [userLocation]);

  return <div className="venue-map-canvas" ref={containerRef} aria-label="Venue map" />;
}
