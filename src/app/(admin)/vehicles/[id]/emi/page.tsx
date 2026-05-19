"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { vehicleAPI } from "@/lib/api";
import VehicleEmiPanel from "@/components/vehicles/VehicleEmiPanel";
import { ChevronLeft, ChevronRight, Car, AlertTriangle } from "lucide-react";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

type Vehicle = {
  id: string;
  registrationNumber: string;
  ownerName: string | null;
  make: string;
  model: string;
  fuelType: string;
  profileImage: string | null;
};

export default function VehicleEmiDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    vehicleAPI
      .getById(id)
      .then((res) => setVehicle(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-gray-500">Loading…</div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-gray-500">Vehicle not found</p>
        <Link href="/vehicles/emi" className="text-brand-500 hover:underline text-sm">Back to EMI Tracker</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — same compact style used elsewhere */}
      <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/vehicles/emi"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors flex-shrink-0"
              title="Back to EMI Tracker"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
              {vehicle.profileImage ? (
                <img
                  src={resolveImageUrl(vehicle.profileImage) ?? ""}
                  alt={vehicle.registrationNumber}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <Car className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-gray-900 dark:text-white font-mono tracking-wide truncate">
                  {vehicle.registrationNumber}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded bg-yellow-50 dark:bg-yellow-500/10">EMI Details</span>
              </div>
              {vehicle.ownerName && (
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate" title={vehicle.ownerName}>{titleCase(vehicle.ownerName)}</p>
              )}
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {titleCase(vehicle.make)} {titleCase(vehicle.model)} · {titleCase(vehicle.fuelType)}
              </p>
            </div>
          </div>
          <Link
            href={`/vehicles/${vehicle.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors flex-shrink-0"
          >
            View Vehicle Details
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* EMI Panel — same component used on the vehicle details page */}
      <VehicleEmiPanel
        vehicleId={vehicle.id}
        vehicleRegistration={vehicle.registrationNumber}
        vehicleMake={vehicle.make}
        vehicleModel={vehicle.model}
      />
    </div>
  );
}
