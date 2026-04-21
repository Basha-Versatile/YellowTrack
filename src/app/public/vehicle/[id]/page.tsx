"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicAPI } from "@/lib/api";

interface ComplianceDoc {
  type: string;
  status: string;
  expiryDate: string;
}

interface PublicVehicle {
  registrationNumber: string;
  make: string;
  model: string;
  fuelType: string;
  permitType: string | null;
  ownerName: string | null;
  currentDriver: {
    name: string;
    licenseNumber: string;
    assignedAt: string;
  } | null;
  compliance: ComplianceDoc[];
}

const DOC_LABELS: Record<string, string> = {
  RC: "Registration Certificate",
  INSURANCE: "Insurance",
  PERMIT: "Permit",
  PUCC: "PUC Certificate",
  FITNESS: "Fitness Certificate",
  TAX: "Road Tax",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  GREEN: {
    label: "Valid",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20",
    icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  YELLOW: {
    label: "Expiring Soon",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
  },
  RED: {
    label: "Expired",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20",
    icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export default function PublicVehiclePage() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    publicAPI
      .getVehicle(id)
      .then((res) => setVehicle(res.data.data))
      .catch(() => setError("Vehicle not found or invalid QR code"))
      .finally(() => setLoading(false));
  }, [id]);

  const greenCount = vehicle?.compliance.filter((d) => d.status === "GREEN").length || 0;
  const totalDocs = vehicle?.compliance.length || 0;
  const complianceScore = totalDocs > 0 ? Math.round((greenCount / totalDocs) * 100) : 0;

  const overallStatus =
    vehicle?.compliance.some((d) => d.status === "RED")
      ? "RED"
      : vehicle?.compliance.some((d) => d.status === "YELLOW")
      ? "YELLOW"
      : "GREEN";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse w-16 h-16 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          <div className="animate-pulse h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Vehicle Not Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error || "The QR code may be invalid or the vehicle has been removed."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
        {/* Decorative */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-orange-500/10 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <img src="/images/logo/yellow-track-logo.png" alt="Yellow Track" className="w-11 h-11 rounded-xl object-contain" />
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-yellow-400">Yellow</span>
              <span className="text-white"> Track</span>
            </span>
          </div>

          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5 ${
              overallStatus === "GREEN"
                ? "bg-emerald-500/15 text-emerald-400"
                : overallStatus === "YELLOW"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                overallStatus === "GREEN"
                  ? "bg-emerald-400"
                  : overallStatus === "YELLOW"
                  ? "bg-amber-400"
                  : "bg-red-400"
              }`}
            />
            {overallStatus === "GREEN"
              ? "All Documents Valid"
              : overallStatus === "YELLOW"
              ? "Some Documents Expiring"
              : "Attention Required"}
          </div>

          {/* Reg Number */}
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-wider mb-3 font-mono">
            {vehicle.registrationNumber}
          </h1>

          <p className="text-lg text-white/60">
            {vehicle.make} {vehicle.model}
          </p>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-6 mt-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{complianceScore}%</p>
              <p className="text-white/40 text-xs mt-0.5">Compliance</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{greenCount}/{totalDocs}</p>
              <p className="text-white/40 text-xs mt-0.5">Docs Valid</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{vehicle.fuelType}</p>
              <p className="text-white/40 text-xs mt-0.5">Fuel Type</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 -mt-6 pb-12 space-y-5">
        {/* Vehicle Details Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/50 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H6.375m11.25 0h3.375a1.125 1.125 0 0 0 1.125-1.125v-5.25a3.375 3.375 0 0 0-3.375-3.375H5.625a3.375 3.375 0 0 0-3.375 3.375v5.25m16.5-5.25V6.375a2.625 2.625 0 0 0-2.625-2.625H7.125A2.625 2.625 0 0 0 4.5 6.375v2.25" />
            </svg>
            Vehicle Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Registration" value={vehicle.registrationNumber} />
            <InfoItem label="Make & Model" value={`${vehicle.make} ${vehicle.model}`} />
            <InfoItem label="Fuel Type" value={vehicle.fuelType} />
            <InfoItem label="Permit Type" value={vehicle.permitType || "N/A"} />
            {vehicle.ownerName && (
              <InfoItem label="Owner" value={vehicle.ownerName} />
            )}
          </div>
        </div>


        {/* Compliance Documents */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/50 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            Compliance Status
          </h2>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Overall Compliance</span>
              <span className={`font-bold ${complianceScore >= 80 ? "text-emerald-600" : complianceScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
                {complianceScore}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  complianceScore >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : complianceScore >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-red-400 to-red-500"
                }`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {vehicle.compliance.map((doc) => {
              const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.GREEN;
              const daysLeft = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={`${doc.type}-${doc.expiryDate}`}
                  className={`flex items-center justify-between p-4 rounded-xl border ${cfg.bg} transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-5 h-5 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {DOC_LABELS[doc.type] || doc.type}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Expires: {new Date(doc.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {daysLeft > 0 ? ` (${daysLeft} days)` : " (Expired)"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.color} ${
                    doc.status === "GREEN" ? "bg-emerald-100 dark:bg-emerald-500/20" :
                    doc.status === "YELLOW" ? "bg-amber-100 dark:bg-amber-500/20" :
                    "bg-red-100 dark:bg-red-500/20"
                  }`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Verified by <span className="font-semibold">Yellow Track</span> &mdash; Fleet Compliance Management
          </p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
            Last updated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}
