"use client";
import React, { useEffect, useState } from "react";
import { driverAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { DriverComplianceSkeleton } from "@/components/ui/Skeleton";
import Pagination, { useClientPagination } from "@/components/ui/Pagination";
import { Users, List, LayoutGrid, User, ChevronRight } from "lucide-react";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

interface DriverDoc {
  type: string;
  expiryDate: string;
}

interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseStatus: string;
  vehicleClass: string;
  profilePhoto: string | null;
  documents: DriverDoc[];
}

const DOC_LABELS: Record<string, string> = {
  DL: "DL", MEDICAL: "MED", POLICE_VERIFICATION: "POL", AADHAAR: "AAD",
};
const DOC_FULL: Record<string, string> = {
  DL: "Driving License", MEDICAL: "Medical", POLICE_VERIFICATION: "Police Verification", AADHAAR: "Aadhaar",
};

function getDocStatus(expiryDate: string) {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return { status: "RED", days, label: "Expired" };
  if (days <= 7) return { status: "ORANGE", days, label: "Critical" };
  if (days <= 30) return { status: "YELLOW", days, label: "Expiring" };
  return { status: "GREEN", days, label: "Valid" };
}

function getDriverOverall(driver: Driver) {
  if (driver.licenseStatus === "RED") return "RED";
  if (driver.licenseStatus === "ORANGE") return "ORANGE";
  if (driver.licenseStatus === "YELLOW") return "YELLOW";
  // Then documents
  if (driver.documents.length === 0) return driver.licenseStatus;
  const statuses = driver.documents.map((d) => getDocStatus(d.expiryDate).status);
  if (statuses.includes("RED")) return "RED";
  if (statuses.includes("ORANGE")) return "ORANGE";
  if (statuses.includes("YELLOW")) return "YELLOW";
  return "GREEN";
}

export default function DriverCompliancePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [view, setView] = useState<"list" | "grid">("list");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

  useEffect(() => {
    driverAPI.getAll()
      .then((res) => setDrivers(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const driversWithStatus = drivers.map((d) => ({ ...d, overallStatus: getDriverOverall(d) }));
  const filteredDrivers = filter === "ALL" ? driversWithStatus : driversWithStatus.filter((d) => d.overallStatus === filter);
  const { page, setPage, perPage, setPerPage, totalPages, totalItems, paginatedItems } = useClientPagination(filteredDrivers, 10);

  const counts = {
    ALL: driversWithStatus.length,
    GREEN: driversWithStatus.filter((d) => d.overallStatus === "GREEN").length,
    YELLOW: driversWithStatus.filter((d) => d.overallStatus === "YELLOW").length,
    ORANGE: driversWithStatus.filter((d) => d.overallStatus === "ORANGE").length,
    RED: driversWithStatus.filter((d) => d.overallStatus === "RED").length,
  };

  // Doc stats
  const allLicenses = drivers.length;
  const greenLicenses = drivers.filter((d) => d.licenseStatus === "GREEN").length;
  const totalDocs = drivers.reduce((s, d) => s + d.documents.length, 0);
  const greenDocs = drivers.reduce((s, d) => s + d.documents.filter((doc) => getDocStatus(doc.expiryDate).status === "GREEN").length, 0);
  const complianceRate = (allLicenses + totalDocs) > 0
    ? Math.round(((greenLicenses + greenDocs) / (allLicenses + totalDocs)) * 100)
    : 0;

  if (loading) return <DriverComplianceSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Driver Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">License &amp; document compliance for all drivers</p>
        </div>
        <Link href="/drivers" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition-all">
          <Users className="w-4 h-4" />
          View Drivers
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance Rate</p>
          <p className={`text-3xl font-black mt-2 ${complianceRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : complianceRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{complianceRate}%</p>
          <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${complianceRate >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : complianceRate >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-red-400 to-red-500"}`} style={{ width: `${complianceRate}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <p className="text-xs font-semibold text-emerald-600/60 uppercase tracking-wider">Valid</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{counts.GREEN}</p>
          <p className="text-[11px] text-emerald-600/50 mt-1">All docs &amp; license OK</p>
        </div>
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-xs font-semibold text-amber-600/60 uppercase tracking-wider">Expiring</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">{counts.YELLOW}</p>
          <p className="text-[11px] text-amber-600/50 mt-1">Within 30 days</p>
        </div>
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <p className="text-xs font-semibold text-red-600/60 uppercase tracking-wider">Expired</p>
          <p className="text-3xl font-black text-red-600 dark:text-red-400 mt-2">{counts.RED}</p>
          <p className="text-[11px] text-red-600/50 mt-1">Immediate action needed</p>
        </div>
      </div>

      {/* Filter + View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
          {(["ALL", "RED", "ORANGE", "YELLOW", "GREEN"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${filter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              {s !== "ALL" && <span className={`w-2 h-2 rounded-full ${s === "RED" ? "bg-red-500" : s === "ORANGE" ? "bg-orange-500" : s === "YELLOW" ? "bg-amber-500" : "bg-emerald-500"}`} />}
              {s === "ALL" ? "All" : s === "RED" ? "Expired" : s === "ORANGE" ? "Critical" : s === "YELLOW" ? "Expiring" : "Valid"}
              <span className="text-xs text-gray-400">{counts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          <button onClick={() => setView("list")} className={`rounded-lg px-2.5 transition-all ${view === "list" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <List className={`w-4 h-4 ${view === "list" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
          <button onClick={() => setView("grid")} className={`rounded-lg px-2.5 transition-all ${view === "grid" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <LayoutGrid className={`w-4 h-4 ${view === "grid" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {totalItems === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-sm text-gray-500">No drivers found with this filter</p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {paginatedItems.map((driver) => {
            const grad = driver.overallStatus === "GREEN" ? "from-emerald-500 to-green-600" : driver.overallStatus === "YELLOW" ? "from-amber-500 to-yellow-600" : driver.overallStatus === "ORANGE" ? "from-orange-500 to-orange-600" : "from-red-500 to-rose-600";
            const licenseDays = Math.ceil((new Date(driver.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            return (
              <Link key={driver.id} href={`/drivers/${driver.id}`}
                className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none transition-all">
                <div className={`w-1 h-14 rounded-full bg-gradient-to-b ${grad} flex-shrink-0`} />
                <div className="flex-shrink-0">
                  {driver.profilePhoto ? (
                    <img src={(resolveImageUrl(driver.profilePhoto) ?? "")} alt={driver.name} className="w-10 h-10 rounded-xl object-cover shadow-md"
                      onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: (resolveImageUrl(driver.profilePhoto) ?? ""), x: r.right + 12, y: r.top + r.height / 2 }); }}
                      onMouseLeave={() => setHoverPhoto(null)} />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md`}>
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">{driver.name}</h3>
                    <Badge color={driver.overallStatus === "GREEN" ? "success" : driver.overallStatus === "YELLOW" ? "warning" : driver.overallStatus === "ORANGE" ? "orange" : "error"} variant="light" size="sm">
                      {driver.overallStatus === "GREEN" ? "OK" : driver.overallStatus === "YELLOW" ? "Expiring" : "Expired"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-mono">{driver.licenseNumber}</span>
                    <span className="text-gray-300 dark:text-gray-600 mx-1">&bull;</span>
                    <span className={licenseDays <= 0 ? "text-red-600 font-semibold" : licenseDays <= 30 ? "text-amber-600 font-semibold" : ""}>
                      DL: {licenseDays <= 0 ? "Expired" : `${licenseDays}d`}
                    </span>
                  </p>
                </div>
                {/* Doc dots */}
                <div className="hidden sm:flex items-center gap-3">
                  {/* License — render either the uploaded DL doc OR the implicit one from driver.licenseExpiry, never both */}
                  {(() => {
                    const uploadedDl = driver.documents.find((d) => d.type === "DL");
                    if (uploadedDl) {
                      const ds = getDocStatus(uploadedDl.expiryDate);
                      return (
                        <div className="text-center">
                          <p className={`text-[9px] font-bold ${ds.status === "GREEN" ? "text-emerald-600" : ds.status === "YELLOW" ? "text-amber-600" : ds.status === "ORANGE" ? "text-orange-600" : "text-red-600"}`}>DL</p>
                          <span className={`block w-2 h-2 rounded-full mx-auto mt-0.5 ${ds.status === "GREEN" ? "bg-emerald-500" : ds.status === "YELLOW" ? "bg-amber-500" : ds.status === "ORANGE" ? "bg-orange-500" : "bg-red-500"}`} />
                        </div>
                      );
                    }
                    return (
                      <div className="text-center">
                        <p className={`text-[9px] font-bold ${driver.licenseStatus === "GREEN" ? "text-emerald-600" : driver.licenseStatus === "YELLOW" ? "text-amber-600" : driver.licenseStatus === "ORANGE" ? "text-orange-600" : "text-red-600"}`}>DL</p>
                        <span className={`block w-2 h-2 rounded-full mx-auto mt-0.5 ${driver.licenseStatus === "GREEN" ? "bg-emerald-500" : driver.licenseStatus === "YELLOW" ? "bg-amber-500" : driver.licenseStatus === "ORANGE" ? "bg-orange-500" : "bg-red-500"}`} />
                      </div>
                    );
                  })()}
                  {driver.documents
                    .filter((doc) => doc.type !== "DL")
                    .map((doc) => {
                      const ds = getDocStatus(doc.expiryDate);
                      return (
                        <div key={`${doc.type}-${doc.expiryDate}`} className="text-center">
                          <p className={`text-[9px] font-bold ${ds.status === "GREEN" ? "text-emerald-600" : ds.status === "YELLOW" ? "text-amber-600" : ds.status === "ORANGE" ? "text-orange-600" : "text-red-600"}`}>{DOC_LABELS[doc.type] || doc.type.slice(0, 3)}</p>
                          <span className={`block w-2 h-2 rounded-full mx-auto mt-0.5 ${ds.status === "GREEN" ? "bg-emerald-500" : ds.status === "YELLOW" ? "bg-amber-500" : ds.status === "ORANGE" ? "bg-orange-500" : "bg-red-500"}`} />
                        </div>
                      );
                    })}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {paginatedItems.map((driver) => {
            const grad = driver.overallStatus === "GREEN" ? "from-emerald-500 to-green-600" : driver.overallStatus === "YELLOW" ? "from-amber-500 to-yellow-600" : driver.overallStatus === "ORANGE" ? "from-orange-500 to-orange-600" : "from-red-500 to-rose-600";
            const licenseDays = Math.ceil((new Date(driver.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const hasUploadedDl = driver.documents.some((d) => d.type === "DL");
            const allItems = [
              ...(hasUploadedDl
                ? []
                : [{ type: "DL", status: driver.licenseStatus, days: licenseDays }]),
              ...driver.documents.map((d) => ({ type: d.type, ...getDocStatus(d.expiryDate) })),
            ];
            const greenCount = allItems.filter((i) => i.status === "GREEN").length;
            const score = allItems.length > 0 ? Math.round((greenCount / allItems.length) * 100) : 0;

            return (
              <Link key={driver.id} href={`/drivers/${driver.id}`}
                className="group rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden hover:shadow-lg transition-all">
                <div className={`h-1 bg-gradient-to-r ${grad}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        {driver.profilePhoto ? (
                          <img src={(resolveImageUrl(driver.profilePhoto) ?? "")} alt={driver.name} className="w-11 h-11 rounded-xl object-cover shadow-md"
                            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: (resolveImageUrl(driver.profilePhoto) ?? ""), x: r.right + 12, y: r.top + r.height / 2 }); }}
                            onMouseLeave={() => setHoverPhoto(null)} />
                        ) : (
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md`}>
                            <User className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">{driver.name}</h3>
                        <p className="text-xs text-gray-500">{driver.vehicleClass} &bull; <span className="font-mono">{driver.licenseNumber}</span></p>
                      </div>
                    </div>
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none"
                          className={driver.overallStatus === "GREEN" ? "stroke-emerald-500" : driver.overallStatus === "YELLOW" ? "stroke-amber-500" : driver.overallStatus === "ORANGE" ? "stroke-orange-500" : "stroke-red-500"}
                          strokeWidth="3" strokeLinecap="round" strokeDasharray={`${score * 0.88} 100`} />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-black ${driver.overallStatus === "GREEN" ? "text-emerald-600" : driver.overallStatus === "YELLOW" ? "text-amber-600" : driver.overallStatus === "ORANGE" ? "text-orange-600" : "text-red-600"}`}>{score}%</span>
                    </div>
                  </div>

                  {/* Items grid */}
                  <div className="space-y-1.5">
                    {/* License row */}
                    <div className={`flex items-center justify-between p-2.5 rounded-lg ${driver.licenseStatus === "GREEN" ? "bg-emerald-50 dark:bg-emerald-500/10" : driver.licenseStatus === "YELLOW" ? "bg-amber-50 dark:bg-amber-500/10" : driver.licenseStatus === "ORANGE" ? "bg-orange-50 dark:bg-orange-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Driving License</span>
                      <span className={`text-[10px] font-bold ${driver.licenseStatus === "GREEN" ? "text-emerald-600" : driver.licenseStatus === "YELLOW" ? "text-amber-600" : driver.licenseStatus === "ORANGE" ? "text-orange-600" : "text-red-600"}`}>
                        {licenseDays <= 0 ? "Expired" : `${licenseDays}d`}
                      </span>
                    </div>
                    {driver.documents.map((doc) => {
                      const ds = getDocStatus(doc.expiryDate);
                      return (
                        <div key={`${doc.type}-${doc.expiryDate}`} className={`flex items-center justify-between p-2.5 rounded-lg ${ds.status === "GREEN" ? "bg-emerald-50 dark:bg-emerald-500/10" : ds.status === "YELLOW" ? "bg-amber-50 dark:bg-amber-500/10" : ds.status === "ORANGE" ? "bg-orange-50 dark:bg-orange-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{DOC_FULL[doc.type] || doc.type}</span>
                          <span className={`text-[10px] font-bold ${ds.status === "GREEN" ? "text-emerald-600" : ds.status === "YELLOW" ? "text-amber-600" : ds.status === "ORANGE" ? "text-orange-600" : "text-red-600"}`}>
                            {ds.days <= 0 ? "Expired" : `${ds.days}d`}
                          </span>
                        </div>
                      );
                    })}
                    {driver.documents.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No documents uploaded</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemLabel="drivers" />

      {hoverPhoto && (
        <div
          className="fixed z-[99999] pointer-events-none animate-in fade-in duration-150"
          style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}
        >
          <img src={hoverPhoto.url} alt="Driver" className="w-44 h-44 rounded-2xl object-cover shadow-2xl ring-4 ring-white dark:ring-gray-900" />
        </div>
      )}
    </div>
  );
}
