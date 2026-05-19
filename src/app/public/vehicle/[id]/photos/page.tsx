"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { Car, ImageIcon, AlertTriangle, ExternalLink } from "lucide-react";

interface PhotosPayload {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  ownerName: string | null;
  profileImage: string | null;
  images: string[];
}

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export default function PublicVehiclePhotosPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<PhotosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/public/vehicles/${id}/photos`)
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Unable to load");
          return;
        }
        setData(res.data);
      })
      .catch(() => setError("Unable to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading photos…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mb-3">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-sm font-medium text-gray-700">Vehicle not found</p>
        <p className="text-xs text-gray-500 mt-1">{error || "This link is no longer valid."}</p>
      </div>
    );
  }

  // Profile image first (if set), then the rest of the gallery, de-duplicated.
  const ordered = [
    ...(data.profileImage ? [data.profileImage] : []),
    ...data.images.filter((u) => u !== data.profileImage),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <Car className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-gray-900 truncate">
              {data.ownerName ? titleCase(data.ownerName) : titleCase(data.make)}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              <span className="font-mono font-bold text-gray-700">{data.registrationNumber}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              {titleCase(data.make)} {titleCase(data.model)}
            </p>
          </div>
          <span className="ml-auto text-[11px] text-gray-400 inline-flex items-center gap-1 flex-shrink-0">
            <ImageIcon className="w-3.5 h-3.5" />
            {ordered.length} photo{ordered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Gallery */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {ordered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-gray-500">No photos uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ordered.map((url, i) => {
              const isProfile = i === 0 && data.profileImage === url;
              const src = resolveImageUrl(url) ?? "";
              return (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => setZoomUrl(src)}
                  className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-yellow-400 hover:shadow-lg transition-all bg-gray-100"
                >
                  <img
                    src={src}
                    alt={`${data.registrationNumber} — photo ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  {isProfile && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-md shadow">
                      PROFILE
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomUrl(null)}
        >
          <img
            src={zoomUrl}
            alt="Zoomed vehicle photo"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={zoomUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open original
          </a>
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 pb-8">
        Shared via Yellow Track
      </p>
    </div>
  );
}
