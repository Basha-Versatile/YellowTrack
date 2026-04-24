"use client";
/**
 * Client-only map using react-leaflet v5. Loaded via `next/dynamic` with
 * `ssr: false` so the Leaflet package (which touches `window`) never runs on the server.
 */
import "leaflet/dist/leaflet.css";
import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";

// Leaflet's default marker icon references image URLs that webpack can't resolve —
// point them explicitly at the bundled assets (or a CDN as fallback).
const DefaultIcon = L.icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
  lat: number | null;
  lng: number | null;
  disabled: boolean;
  onChange: (lat: number, lng: number) => void;
}

// ── Syncs the map view with incoming props and forces a size recalc ──
function MapController({
  lat,
  lng,
  containerEl,
}: {
  lat: number | null;
  lng: number | null;
  containerEl: HTMLElement | null;
}) {
  const map = useMap();

  // When the containing element resizes (e.g. "Same as current" toggles,
  // tabs change, etc.) Leaflet's internal tile math goes stale. Watching the
  // container with ResizeObserver + `invalidateSize()` fixes the map-goes-blank bug.
  useEffect(() => {
    if (!containerEl) return;
    let disposed = false;
    let rafId = 0;
    const safeInvalidate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (disposed) return;
        try {
          map.invalidateSize();
        } catch {
          // container may have been detached between rAF schedule and fire
        }
      });
    };
    const ro = new ResizeObserver(safeInvalidate);
    ro.observe(containerEl);
    safeInvalidate();
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [map, containerEl]);

  // Fly to new coordinates when props change (e.g. "Detect my location")
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], 16, { duration: 0.6 });
  }, [lat, lng, map]);

  return null;
}

function ClickHandler({
  onClick,
  disabled,
}: {
  onClick: (lat: number, lng: number) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddressMapInner({
  lat,
  lng,
  disabled,
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Default center when no coords yet — falls back to Hyderabad
  const center: [number, number] = useMemo(
    () => [lat ?? 17.385, lng ?? 78.4867],
    [lat, lng],
  );

  return (
    <div
      ref={containerRef}
      className={`rounded-xl overflow-hidden border border-gray-200 ${
        disabled ? "opacity-60 pointer-events-none" : ""
      }`}
      style={{ height: 240 }}
    >
      <MapContainer
        // Note: MapContainer treats `center` / `zoom` as init-only — subsequent
        // updates happen imperatively via the child `MapController`.
        center={center}
        zoom={lat != null && lng != null ? 16 : 12}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapController
          lat={lat}
          lng={lng}
          containerEl={containerRef.current}
        />
        <ClickHandler onClick={onChange} disabled={disabled} />
        {lat != null && lng != null ? (
          <Marker
            position={[lat, lng]}
            draggable={!disabled}
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng();
                onChange(pos.lat, pos.lng);
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
