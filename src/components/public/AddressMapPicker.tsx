"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
// import dynamic from "next/dynamic";

interface AddressValue {
  address: string;
  lat: number | null;
  lng: number | null;
}

interface AddressMapPickerProps {
  value: AddressValue;
  onChange: (val: AddressValue) => void;
  disabled?: boolean;
  label: string;
  autoDetect?: boolean;
}

// Reverse geocode using Nominatim (free, no API key)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

// The actual map component — loaded only on client side
function MapInner({ value, onChange, disabled }: { value: AddressValue; onChange: (val: AddressValue) => void; disabled?: boolean }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    import("leaflet").then((L) => {
      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      setLeaflet(L);
    });
  }, []);

  useEffect(() => {
    if (!leaflet || !mapContainerRef.current || mapRef.current) return;

    const lat = value.lat || 17.385;
    const lng = value.lng || 78.4867;

    const map = leaflet.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: value.lat ? 16 : 12,
      zoomControl: true,
    });

    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = leaflet.marker([lat, lng], { draggable: !disabled }).addTo(map);
    mapRef.current = map;
    markerRef.current = marker;

    if (!disabled) {
      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        const address = await reverseGeocode(pos.lat, pos.lng);
        onChange({ address: address || value.address, lat: pos.lat, lng: pos.lng });
      });

      map.on("click", async (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        const address = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        onChange({ address: address || value.address, lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    // Resize fix
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [leaflet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker when value changes externally
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !value.lat || !value.lng) return;
    const currentPos = markerRef.current.getLatLng();
    if (Math.abs(currentPos.lat - value.lat) > 0.0001 || Math.abs(currentPos.lng - value.lng) > 0.0001) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      mapRef.current.setView([value.lat, value.lng], 16);
    }
  }, [value.lat, value.lng]);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div
        ref={mapContainerRef}
        className={`rounded-xl overflow-hidden border border-gray-200 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        style={{ height: 220 }}
      />
    </>
  );
}

export default function AddressMapPicker({ value, onChange, disabled, label, autoDetect }: AddressMapPickerProps) {
  const [detecting, setDetecting] = useState(false);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        onChange({ address, lat, lng });
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onChange]);

  // Auto-detect on mount if requested and no existing value
  useEffect(() => {
    if (autoDetect && !value.lat && !value.lng && !disabled) {
      detectLocation();
    }
  }, [autoDetect]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {label && <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          disabled={disabled}
          placeholder="Enter address or use map below"
          className="flex-1 h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 disabled:opacity-50 disabled:bg-gray-50"
        />
        {!disabled && (
          <button
            type="button"
            onClick={detectLocation}
            disabled={detecting}
            className="h-11 px-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-yellow-600 transition-all disabled:opacity-50 flex items-center gap-1.5"
            title="Detect my location"
          >
            {detecting ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            )}
            <span className="text-xs font-medium hidden sm:inline">{detecting ? "Detecting..." : "My Location"}</span>
          </button>
        )}
      </div>
      <MapInner value={value} onChange={onChange} disabled={disabled} />
      {!disabled && (
        <p className="text-[10px] text-gray-400 mt-1">Tap on the map or drag the pin to set location</p>
      )}
    </div>
  );
}
