"use client";
import React, { useEffect, useState } from "react";
import { vehicleAPI, vehicleGroupAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { ComplianceSkeleton } from "@/components/ui/Skeleton";
import Pagination, { useClientPagination } from "@/components/ui/Pagination";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { Truck, LayoutGrid, List, ChevronRight, ShieldCheck } from "lucide-react";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";
import { SearchInput } from "@/components/ui/SearchInput";

interface ComplianceDoc {
  type: string;
  status: string;
  expiryDate: string;
}

interface VehicleGroup {
  id: string;
  name: string;
  icon: string;
  color?: string;
  _count: { vehicles: number };
}

interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  fuelType: string;
  overallStatus: string;
  profileImage: string | null;
  group?: { id: string; name: string; icon: string; color?: string } | null;
  complianceDocuments: ComplianceDoc[];
}

const DOC_LABELS: Record<string, string> = {
  RC: "RC", INSURANCE: "INS", PERMIT: "PMT", PUCC: "PUC", FITNESS: "FIT", TAX: "TAX",
};

const DOC_FULL: Record<string, string> = {
  RC: "Registration", INSURANCE: "Insurance", PERMIT: "Permit", PUCC: "Pollution", FITNESS: "Fitness", TAX: "Road Tax",
};

export default function ComplianceOverviewPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [view, setView] = useState<"list" | "grid">("list");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);
  const [regSearch, setRegSearch] = useState("");

  useEffect(() => {
    vehicleAPI
      .getAll({ limit: 100 })
      .then((res) => setVehicles(res.data.data.vehicles))
      .catch(console.error)
      .finally(() => setLoading(false));
    vehicleGroupAPI.getAll().then((res) => setGroups(res.data.data)).catch(() => {});
  }, []);

  const counts = {
    ALL: vehicles.length,
    RED: vehicles.filter((v) => v.overallStatus === "RED").length,
    ORANGE: vehicles.filter((v) => v.overallStatus === "ORANGE").length,
    YELLOW: vehicles.filter((v) => v.overallStatus === "YELLOW").length,
    GREEN: vehicles.filter((v) => v.overallStatus === "GREEN").length,
  };

  const searchedVehicles = regSearch ? vehicles.filter((v) => v.registrationNumber.toLowerCase().includes(regSearch.toLowerCase())) : vehicles;
  const groupedVehicles = groupFilter === "ALL" ? searchedVehicles : searchedVehicles.filter((v) => v.group?.id === groupFilter);
  const filteredVehicles =
    filter === "ALL" ? groupedVehicles : groupedVehicles.filter((v) => v.overallStatus === filter);

  const { page: cpPage, setPage: setCpPage, perPage: cpPerPage, setPerPage: setCpPerPage, totalPages: cpTotalPages, totalItems: cpTotalItems, paginatedItems: paginatedVehicles } = useClientPagination(filteredVehicles, 10);

  // Global doc stats
  const allDocs = vehicles.flatMap((v) => v.complianceDocuments);
  const totalDocs = allDocs.length;
  const greenDocs = allDocs.filter((d) => d.status === "GREEN").length;
  const yellowDocs = allDocs.filter((d) => d.status === "YELLOW").length;
  const redDocs = allDocs.filter((d) => d.status === "RED").length;
  const complianceRate = totalDocs > 0 ? Math.round((greenDocs / totalDocs) * 100) : 0;

  if (loading) {
    return <ComplianceSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Document compliance status across your fleet
          </p>
        </div>
        <Link href="/vehicles"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-all">
          <Truck className="w-4 h-4" />
          View Vehicles
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Compliance Rate */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance Rate</p>
          <div className="flex items-end gap-2 mt-2">
            <span className={`text-3xl font-black ${complianceRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : complianceRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {complianceRate}%
            </span>
          </div>
          <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${complianceRate >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : complianceRate >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-red-400 to-red-500"}`}
              style={{ width: `${complianceRate}%` }}
            />
          </div>
        </div>

        {/* Green */}
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <p className="text-xs font-semibold text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-wider">Valid</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{greenDocs}</p>
          <p className="text-[11px] text-emerald-600/50 dark:text-emerald-400/50 mt-1">{totalDocs > 0 ? Math.round((greenDocs / totalDocs) * 100) : 0}% of {totalDocs} docs</p>
        </div>

        {/* Yellow */}
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-xs font-semibold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-wider">Expiring</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">{yellowDocs}</p>
          <p className="text-[11px] text-amber-600/50 dark:text-amber-400/50 mt-1">Within 30 days</p>
        </div>

        {/* Red */}
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <p className="text-xs font-semibold text-red-600/60 dark:text-red-400/60 uppercase tracking-wider">Expired</p>
          <p className="text-3xl font-black text-red-600 dark:text-red-400 mt-2">{redDocs}</p>
          <p className="text-[11px] text-red-600/50 dark:text-red-400/50 mt-1">Immediate action needed</p>
        </div>
      </div>

      {/* Group Filter */}
      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setGroupFilter("ALL")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border-2 transition-all flex-shrink-0 ${groupFilter === "ALL" ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
            <LayoutGrid className="w-5 h-5" />
            All
          </button>
          {groups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); return (
            <button key={g.id} onClick={() => setGroupFilter(g.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border-2 transition-all flex-shrink-0 ${groupFilter === g.id ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
              <Icon className="w-5 h-5" style={g.color ? { color: g.color } : undefined} />
              {g.name} <span className="text-xs text-gray-400">{g._count.vehicles}</span>
            </button>
          ); })}
        </div>
      )}

      {/* Filter Tabs + View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
          {(["ALL", "RED", "ORANGE", "YELLOW", "GREEN"] as const).map((status) => {
            const isActive = filter === status;
            const dotColor = status === "RED" ? "bg-red-500" : status === "ORANGE" ? "bg-orange-500" : status === "YELLOW" ? "bg-amber-500" : status === "GREEN" ? "bg-emerald-500" : "";
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {status !== "ALL" && <span className={`w-2 h-2 rounded-full ${dotColor}`} />}
                {status === "ALL" ? "All" : status === "RED" ? "Expired" : status === "YELLOW" ? "Expiring" : "Valid"}
                <span className={`text-xs ${isActive ? "text-gray-500 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}>
                  {counts[status]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <SearchInput
            className="w-44"
            size="sm"
            value={regSearch}
            onChange={setRegSearch}
            placeholder="Search reg. no..."
          />
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
            <button onClick={() => setView("list")} className={`rounded-lg px-2.5 transition-all ${view === "list" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
              <List className={`w-4 h-4 ${view === "list" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
            </button>
            <button onClick={() => setView("grid")} className={`rounded-lg px-2.5 transition-all ${view === "grid" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
              <LayoutGrid className={`w-4 h-4 ${view === "grid" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {cpTotalItems === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No vehicles found with this filter</p>
        </div>
      ) : view === "list" ? (
        /* ── LIST VIEW ── */
        <div className="space-y-2">
          {paginatedVehicles.map((vehicle) => {
            const vGreen = vehicle.complianceDocuments.filter((d) => d.status === "GREEN").length;
            const vTotal = vehicle.complianceDocuments.length;
            const vScore = vTotal > 0 ? Math.round((vGreen / vTotal) * 100) : 0;
            const grad = vehicle.overallStatus === "GREEN" ? "from-emerald-500 to-green-600" : vehicle.overallStatus === "YELLOW" ? "from-amber-500 to-yellow-600" : vehicle.overallStatus === "ORANGE" ? "from-orange-500 to-orange-600" : "from-red-500 to-rose-600";

            return (
              <Link
                key={vehicle.id}
                href={`/vehicles/${vehicle.id}`}
                className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none transition-all"
              >
                {/* Status bar */}
                <div className={`w-1 h-14 rounded-full bg-gradient-to-b ${grad} flex-shrink-0`} />

                {/* Icon / Profile */}
                {(() => { const GroupIcon = vehicle.group?.icon ? getVehicleTypeIcon(vehicle.group.icon) : Truck; return vehicle.profileImage ? (
                  <img src={`${resolveImageUrl(vehicle.profileImage) ?? ""}`} alt={vehicle.registrationNumber} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-md"
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(vehicle.profileImage) ?? ""}`, x: r.right + 12, y: r.top + r.height / 2 }); }}
                    onMouseLeave={() => setHoverPhoto(null)} onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${!vehicle.group?.color ? `bg-gradient-to-br ${grad}` : ''}`} style={{ backgroundColor: vehicle.group?.color ? vehicle.group.color + '12' : undefined }}>
                    <GroupIcon className="w-4 h-4" style={vehicle.group?.color ? { color: vehicle.group.color } : { color: 'white' }} />
                  </div>
                ); })()}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white font-mono tracking-wider group-hover:text-brand-500 transition-colors">
                      {vehicle.registrationNumber}
                    </h3>
                    <Badge color={vehicle.overallStatus === "GREEN" ? "success" : vehicle.overallStatus === "YELLOW" ? "warning" : vehicle.overallStatus === "ORANGE" ? "orange" : "error"} variant="light" size="sm">
                      {vScore}%
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    {vehicle.make} {vehicle.model} &bull; {vehicle.fuelType}
                    {vehicle.group && (() => { const GIcon = getVehicleTypeIcon(vehicle.group.icon); return (
                      <><span className="text-gray-300 dark:text-gray-600 mx-0.5">&bull;</span><span className="text-brand-500 dark:text-brand-400 font-medium inline-flex items-center gap-0.5"><GIcon className="w-3 h-3" />{vehicle.group.name}</span></>
                    ); })()}
                  </p>
                </div>

                {/* Doc dots */}
                <div className="hidden sm:flex items-center gap-3">
                  {vehicle.complianceDocuments.map((doc) => {
                    const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={`${doc.type}-${doc.expiryDate}`} className="text-center">
                        <p className={`text-[9px] font-bold ${
                          doc.status === "GREEN" ? "text-emerald-600 dark:text-emerald-400" : doc.status === "YELLOW" ? "text-amber-600 dark:text-amber-400" : doc.status === "ORANGE" ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
                        }`}>
                          {DOC_LABELS[doc.type] || doc.type.slice(0, 3)}
                        </p>
                        <span className={`block w-2 h-2 rounded-full mx-auto mt-0.5 ${
                          doc.status === "GREEN" ? "bg-emerald-500" : doc.status === "YELLOW" ? "bg-amber-500" : doc.status === "ORANGE" ? "bg-orange-500" : "bg-red-500"
                        }`} />
                        <p className="text-[8px] text-gray-400 mt-0.5">{days <= 0 ? "Exp" : `${days}d`}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Nearest expiry pill (mobile) */}
                <div className="sm:hidden flex-shrink-0">
                  {(() => {
                    const nearest = [...vehicle.complianceDocuments].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
                    if (!nearest) return null;
                    const days = Math.ceil((new Date(nearest.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <span className={`text-[10px] px-2 py-1 rounded-md font-semibold ${
                        nearest.status === "GREEN" ? "bg-emerald-100 text-emerald-700" : nearest.status === "YELLOW" ? "bg-amber-100 text-amber-700" : nearest.status === "ORANGE" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                      }`}>
                        {DOC_FULL[nearest.type] || nearest.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}: {days <= 0 ? "Exp" : `${days}d`}
                      </span>
                    );
                  })()}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {paginatedVehicles.map((vehicle) => {
            const vGreen = vehicle.complianceDocuments.filter((d) => d.status === "GREEN").length;
            const vTotal = vehicle.complianceDocuments.length;
            const vScore = vTotal > 0 ? Math.round((vGreen / vTotal) * 100) : 0;
            const statusGradient = vehicle.overallStatus === "GREEN"
              ? "from-emerald-500 to-green-600"
              : vehicle.overallStatus === "YELLOW"
              ? "from-amber-500 to-orange-500"
              : "from-red-500 to-rose-600";

            return (
              <Link
                key={vehicle.id}
                href={`/vehicles/${vehicle.id}`}
                className="group rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none transition-all duration-300"
              >
                <div className={`h-1 bg-gradient-to-r ${statusGradient}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {(() => { const GroupIcon = vehicle.group?.icon ? getVehicleTypeIcon(vehicle.group.icon) : Truck; return vehicle.profileImage ? (
                        <img src={`${resolveImageUrl(vehicle.profileImage) ?? ""}`} alt={vehicle.registrationNumber} className="w-11 h-11 rounded-xl object-cover shadow-md"
                          onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(vehicle.profileImage) ?? ""}`, x: r.right + 12, y: r.top + r.height / 2 }); }}
                          onMouseLeave={() => setHoverPhoto(null)} onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${!vehicle.group?.color ? `bg-gradient-to-br ${statusGradient}` : ''}`} style={{ backgroundColor: vehicle.group?.color ? vehicle.group.color + '12' : undefined }}>
                          <GroupIcon className="w-5 h-5" style={vehicle.group?.color ? { color: vehicle.group.color } : { color: 'white' }} />
                        </div>
                      ); })()}
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors font-mono tracking-wide">
                          {vehicle.registrationNumber}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          {vehicle.make} {vehicle.model} &bull; {vehicle.fuelType}
                          {vehicle.group && (() => { const GIcon = getVehicleTypeIcon(vehicle.group.icon); return (
                            <><span className="text-gray-300 dark:text-gray-600 mx-0.5">&bull;</span><span className="text-brand-500 dark:text-brand-400 font-medium inline-flex items-center gap-0.5"><GIcon className="w-3 h-3" />{vehicle.group.name}</span></>
                          ); })()}
                        </p>
                      </div>
                    </div>
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.5" fill="none"
                          className={vehicle.overallStatus === "GREEN" ? "stroke-emerald-500" : vehicle.overallStatus === "YELLOW" ? "stroke-amber-500" : vehicle.overallStatus === "ORANGE" ? "stroke-orange-500" : "stroke-red-500"}
                          strokeWidth="3" strokeLinecap="round" strokeDasharray={`${vScore * 0.975} 100`}
                        />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${
                        vehicle.overallStatus === "GREEN" ? "text-emerald-600 dark:text-emerald-400" : vehicle.overallStatus === "YELLOW" ? "text-amber-600 dark:text-amber-400" : vehicle.overallStatus === "ORANGE" ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
                      }`}>{vScore}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5">
                    {vehicle.complianceDocuments.map((doc) => {
                      const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={`${doc.type}-${doc.expiryDate}`} className={`relative rounded-lg p-2 text-center ${
                          doc.status === "GREEN" ? "bg-emerald-50 dark:bg-emerald-500/10" : doc.status === "YELLOW" ? "bg-amber-50 dark:bg-amber-500/10" : doc.status === "ORANGE" ? "bg-orange-50 dark:bg-orange-500/10" : "bg-red-50 dark:bg-red-500/10"
                        }`}>
                          <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${doc.status === "GREEN" ? "bg-emerald-500" : doc.status === "YELLOW" ? "bg-amber-500" : doc.status === "ORANGE" ? "bg-orange-500" : "bg-red-500"}`} />
                          <p className={`text-[10px] font-bold ${doc.status === "GREEN" ? "text-emerald-700 dark:text-emerald-400" : doc.status === "YELLOW" ? "text-amber-700 dark:text-amber-400" : doc.status === "ORANGE" ? "text-orange-700 dark:text-orange-400" : "text-red-700 dark:text-red-400"}`}>
                            {DOC_LABELS[doc.type] || doc.type}
                          </p>
                          <p className={`text-[9px] mt-0.5 ${doc.status === "GREEN" ? "text-emerald-600/60" : doc.status === "YELLOW" ? "text-amber-600/60" : doc.status === "ORANGE" ? "text-orange-600/60" : "text-red-600/60"}`}>
                            {days <= 0 ? "Expired" : `${days}d`}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    {[...vehicle.complianceDocuments].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()).slice(0, 3).map((doc) => {
                      const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <span key={`${doc.type}-${doc.expiryDate}`} className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                          doc.status === "GREEN" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : doc.status === "YELLOW" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                          : doc.status === "ORANGE" ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
                          : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                        }`}>
                          {DOC_FULL[doc.type] || doc.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}: {days <= 0 ? "Expired" : `${days}d`}
                        </span>
                      );
                    })}
                    {vehicle.complianceDocuments.length > 3 && (
                      <span className="text-[10px] text-gray-400">+{vehicle.complianceDocuments.length - 3} more</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Pagination
        currentPage={cpPage}
        totalPages={cpTotalPages}
        totalItems={cpTotalItems}
        itemsPerPage={cpPerPage}
        onPageChange={setCpPage}
        onItemsPerPageChange={setCpPerPage}
        itemLabel="vehicles"
      />

      {hoverPhoto && (
        <div className="fixed z-[99999] pointer-events-none" style={{ left: hoverPhoto.x, top: hoverPhoto.y, transform: "translateY(-50%)" }}>
          <img src={hoverPhoto.url} alt="Vehicle" className="w-44 h-44 rounded-2xl object-cover shadow-2xl ring-4 ring-white dark:ring-gray-900" />
        </div>
      )}
    </div>
  );
}
