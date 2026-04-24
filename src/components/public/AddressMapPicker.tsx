"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

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

/**
 * Reverse geocode using Nominatim (free, no API key).
 * Returns empty string on failure — caller keeps the existing address.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18`,
      { headers: { "Accept-Language": "en" } },
    );
    const data = await res.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

// Map area runs client-only — leaflet touches `window` on import.
const MapArea = dynamic(() => import("./AddressMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400"
      style={{ height: 240 }}
    >
      Loading map…
    </div>
  ),
});

export default function AddressMapPicker({
  value,
  onChange,
  disabled,
  label,
  autoDetect,
}: AddressMapPickerProps) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const autoDetectedRef = useRef(false);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashCapture = useCallback((msg: string) => {
    setDetectError(null);
    setCaptureMessage(msg);
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => setCaptureMessage(null), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, []);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setDetectError("Geolocation is not supported in this browser.");
      return;
    }
    setDetecting(true);
    setDetectError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Drop the pin immediately — don't wait for the reverse-geocode request.
        onChange({ address: value.address || "", lat, lng });
        flashCapture("Location captured — fetching address…");
        // Fetch the human-readable address in the background.
        reverseGeocode(lat, lng).then((addr) => {
          if (addr) onChange({ address: addr, lat, lng });
          setDetecting(false);
          flashCapture(
            addr ? "Location captured successfully" : "Pin placed — address not found, please type it",
          );
        });
      },
      (err) => {
        setDetecting(false);
        setDetectError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it in your browser settings."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Couldn't determine your location — try again outdoors or enable GPS."
              : "Location request timed out. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, flashCapture]);

  // Auto-detect on first mount when requested and no coords yet
  useEffect(() => {
    if (
      autoDetect &&
      !autoDetectedRef.current &&
      value.lat == null &&
      value.lng == null &&
      !disabled
    ) {
      autoDetectedRef.current = true;
      detectLocation();
    }
  }, [autoDetect, disabled, value.lat, value.lng, detectLocation]);

  return (
    <div>
      {label ? (
        <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </label>
      ) : null}

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          disabled={disabled}
          placeholder="Enter address or use the map below"
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
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            )}
            <span className="text-xs font-medium hidden sm:inline">
              {detecting ? "Detecting…" : "My Location"}
            </span>
          </button>
        )}
      </div>

      <MapArea
        lat={value.lat}
        lng={value.lng}
        disabled={Boolean(disabled)}
        onChange={async (lat, lng) => {
          onChange({ ...value, lat, lng });
          flashCapture("Pin dropped — fetching address…");
          const addr = await reverseGeocode(lat, lng);
          if (addr) onChange({ address: addr, lat, lng });
          flashCapture(
            addr ? "Location captured successfully" : "Pin placed — address not found, please type it",
          );
        }}
      />

      {detectError ? (
        <p className="mt-2 text-[11px] text-red-500">{detectError}</p>
      ) : captureMessage ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {captureMessage}
        </p>
      ) : !disabled ? (
        <p className="mt-1 text-[10px] text-gray-400">
          Tap on the map or drag the pin to set your exact location.
        </p>
      ) : null}
    </div>
  );
}
