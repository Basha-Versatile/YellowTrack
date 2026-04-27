"use client";
import React, { useEffect, useState, useRef } from "react";
import { vehicleAPI, vehicleGroupAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { VehiclesListSkeleton } from "@/components/ui/Skeleton";
import Pagination from "@/components/ui/Pagination";
import { getVehicleTypeIcon } from "@/components/icons/VehicleTypeIcons";
import { Plus, Truck, LayoutGrid, List, ChevronRight, User } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

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
  permitType: string;
  vehicleUsage: "PRIVATE" | "COMMERCIAL" | null;
  qrCodeUrl: string | null;
  profileImage: string | null;
  overallStatus: string;
  pendingChallanAmount: number;
  activeDriver: { id: string; name: string } | null;
  group?: { id: string; name: string; icon: string; color?: string } | null;
  complianceDocuments: Array<{ type: string; status: string; expiryDate: string }>;
  driverMappings: Array<{ isActive: boolean; driver: { id: string; name: string } }>;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DOC_ABBR: Record<string, string> = { RC: "RC", INSURANCE: "INS", PERMIT: "PMT", PUCC: "PUC", FITNESS: "FIT", TAX: "TAX" };

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [usageFilter, setUsageFilter] = useState<"ALL" | "PRIVATE" | "COMMERCIAL">("ALL");
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setFetching] = useState(false);
  const [view, setView] = useState<"cards" | "list">("list");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);
  const searchRef = useRef(search);
  const filterRef = useRef(statusFilter);
  const groupRef = useRef(groupFilter);
  const usageRef = useRef(usageFilter);
  searchRef.current = search;
  filterRef.current = statusFilter;
  groupRef.current = groupFilter;
  usageRef.current = usageFilter;

  const fetchVehicles = async (page = 1, opts?: { initial?: boolean; overrideStatus?: string; overrideGroup?: string; overrideUsage?: "ALL" | "PRIVATE" | "COMMERCIAL" }) => {
    if (opts?.initial) setLoading(true); else setFetching(true);
    try {
      const usage = opts?.overrideUsage ?? usageRef.current;
      const res = await vehicleAPI.getAll({
        page, limit: 10,
        search: searchRef.current || undefined,
        status: (opts?.overrideStatus ?? filterRef.current) !== "ALL" ? (opts?.overrideStatus ?? filterRef.current) : undefined,
        groupId: (opts?.overrideGroup ?? groupRef.current) !== "ALL" ? (opts?.overrideGroup ?? groupRef.current) : undefined,
        vehicleUsage: usage !== "ALL" ? usage : undefined,
      });
      setVehicles(res.data.data.vehicles);
      setPagination(res.data.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setFetching(false); }
  };

  useEffect(() => {
    fetchVehicles(1, { initial: true });
    vehicleGroupAPI.getAll().then((res) => setGroups(res.data.data)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce live search so every keystroke doesn't hit the API
  const [didMount, setDidMount] = useState(false);
  useEffect(() => {
    if (!didMount) { setDidMount(true); return; }
    const timer = setTimeout(() => fetchVehicles(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Stats
  const greenCount = vehicles.filter((v) => v.overallStatus === "GREEN").length;
  const yellowCount = vehicles.filter((v) => v.overallStatus === "YELLOW").length;
  const redCount = vehicles.filter((v) => v.overallStatus === "RED").length;
  const totalPending = vehicles.reduce((s, v) => s + (v.pendingChallanAmount || 0), 0);

  if (loading) return <VehiclesListSkeleton view={view} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {pagination.total} vehicle{pagination.total !== 1 ? "s" : ""} in your fleet
          </p>
        </div>
        <Link
          href="/vehicles/onboard"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Onboard Vehicle
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</p>
          <p className="text-xl font-black text-gray-900 dark:text-white mt-1">{pagination.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <p className="text-[10px] font-semibold text-emerald-500/60 uppercase tracking-wider">Compliant</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{greenCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-[10px] font-semibold text-amber-500/60 uppercase tracking-wider">Expiring</p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{yellowCount}</p>
        </div>
        <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-4 dark:border-red-500/20 dark:bg-red-500/5">
          <p className="text-[10px] font-semibold text-red-500/60 uppercase tracking-wider">Critical</p>
          <p className="text-xl font-black text-red-600 dark:text-red-400 mt-1">{redCount}</p>
        </div>
        <div className="rounded-xl border border-brand-200/60 bg-brand-25 p-4 dark:border-brand-500/20 dark:bg-brand-500/5 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold text-brand-500/60 uppercase tracking-wider">Pending Fines</p>
          <p className="text-xl font-black text-brand-600 dark:text-brand-400 mt-1">&#8377;{totalPending.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Group Filter */}
      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => { setGroupFilter("ALL"); fetchVehicles(1, { overrideGroup: "ALL" }); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border-2 transition-all flex-shrink-0 ${groupFilter === "ALL" ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
            <LayoutGrid className="w-5 h-5" />
            All <span className="text-xs text-gray-400">{pagination.total}</span>
          </button>
          {groups.map((g) => { const Icon = getVehicleTypeIcon(g.icon); return (
            <button key={g.id} onClick={() => { setGroupFilter(g.id); fetchVehicles(1, { overrideGroup: g.id }); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border-2 transition-all flex-shrink-0 ${groupFilter === g.id ? "border-brand-400 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500 dark:text-brand-400" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
              <Icon className="w-5 h-5" style={g.color ? { color: g.color } : undefined} />
              {g.name} <span className="text-xs text-gray-400">{g._count.vehicles}</span>
            </button>
          ); })}
        </div>
      )}

      {/* Search + Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search registration, make, model..."
        />

        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          {(["ALL", "PRIVATE", "COMMERCIAL"] as const).map((u) => (
            <button key={u} onClick={() => { setUsageFilter(u); fetchVehicles(1, { overrideUsage: u }); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${usageFilter === u ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              {u === "ALL" ? "All" : u === "PRIVATE" ? "Private" : "Commercial"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          {(["ALL", "GREEN", "YELLOW", "ORANGE", "RED"] as const).map((s) => {
            const dot = s === "GREEN" ? "bg-emerald-500" : s === "YELLOW" ? "bg-amber-500" : s === "ORANGE" ? "bg-orange-500" : s === "RED" ? "bg-red-500" : "";
            return (
              <button key={s} onClick={() => { setStatusFilter(s); fetchVehicles(1, { overrideStatus: s }); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${statusFilter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                {s !== "ALL" && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
                {s === "ALL" ? "All" : s === "GREEN" ? "OK" : s === "YELLOW" ? "Warn" : s === "ORANGE" ? "Critical" : "Expired"}
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          <button onClick={() => setView("list")} className={`rounded-lg px-2.5 transition-all ${view === "list" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <List className={`w-4 h-4 ${view === "list" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
          <button onClick={() => setView("cards")} className={`rounded-lg px-2.5 transition-all ${view === "cards" ? "bg-white shadow-sm dark:bg-gray-700" : ""}`}>
            <LayoutGrid className={`w-4 h-4 ${view === "cards" ? "text-gray-900 dark:text-white" : "text-gray-400"}`} />
          </button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">No vehicles found</p>
          <Link href="/vehicles/onboard" className="mt-3 inline-block text-sm font-medium text-brand-500 hover:text-brand-600">Onboard your first vehicle</Link>
        </div>
      ) : view === "cards" ? (
        /* ── CARD VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v) => {
            const grad = v.overallStatus === "GREEN" ? "from-emerald-500 to-green-600" : v.overallStatus === "YELLOW" ? "from-amber-500 to-yellow-600" : v.overallStatus === "ORANGE" ? "from-orange-500 to-orange-600" : "from-red-500 to-rose-600";
            const shadowClr = v.overallStatus === "GREEN" ? "shadow-emerald-500/10" : v.overallStatus === "YELLOW" ? "shadow-amber-500/10" : v.overallStatus === "ORANGE" ? "shadow-orange-500/10" : "shadow-red-500/10";
            const greenDocs = v.complianceDocuments.filter((d) => d.status === "GREEN").length;
            const totalDocs = v.complianceDocuments.length;
            const score = totalDocs > 0 ? Math.round((greenDocs / totalDocs) * 100) : 0;
            const activeDriver = v.activeDriver || v.driverMappings?.find((m) => m.isActive)?.driver;

            return (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className={`group rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden hover:shadow-xl ${shadowClr} transition-all duration-300`}
              >
                {/* Top gradient bar */}
                <div className={`h-1.5 bg-gradient-to-r ${grad}`} />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {(() => { const GroupIcon = v.group?.icon ? getVehicleTypeIcon(v.group.icon) : Truck; return v.profileImage ? (
                        <img src={`${resolveImageUrl(v.profileImage) ?? ""}`} alt={v.registrationNumber} className={`w-11 h-11 rounded-xl object-cover shadow-lg ${shadowClr}`}
                          onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(v.profileImage) ?? ""}`, x: r.right + 12, y: r.top + r.height / 2 }); }}
                          onMouseLeave={() => setHoverPhoto(null)} onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${shadowClr} ${!v.group?.color ? `bg-gradient-to-br ${grad}` : ''}`} style={{ backgroundColor: v.group?.color ? v.group.color + '12' : undefined }}>
                          <GroupIcon className="w-5 h-5" style={v.group?.color ? { color: v.group.color } : { color: 'white' }} />
                        </div>
                      ); })()}
                      <div>
                        <h3 className="text-sm font-black text-gray-900 dark:text-white font-mono tracking-wider group-hover:text-brand-500 transition-colors">
                          {v.registrationNumber}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{v.make} {v.model}</p>
                      </div>
                    </div>
                    {/* Score ring */}
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none"
                          className={v.overallStatus === "GREEN" ? "stroke-emerald-500" : v.overallStatus === "YELLOW" ? "stroke-amber-500" : v.overallStatus === "ORANGE" ? "stroke-orange-500" : "stroke-red-500"}
                          strokeWidth="3" strokeLinecap="round" strokeDasharray={`${score * 0.88} 100`}
                        />
                      </svg>
                      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-black ${
                        v.overallStatus === "GREEN" ? "text-emerald-600 dark:text-emerald-400" : v.overallStatus === "YELLOW" ? "text-amber-600 dark:text-amber-400" : v.overallStatus === "ORANGE" ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
                      }`}>{score}%</span>
                    </div>
                  </div>

                  {/* Meta chips */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {v.group && (() => { const GIcon = getVehicleTypeIcon(v.group.icon); return (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1"><GIcon className="w-3 h-3" />{v.group.name}</span>
                    ); })()}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{v.fuelType}</span>
                    {v.vehicleUsage && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${v.vehicleUsage === "COMMERCIAL" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                        {v.vehicleUsage === "COMMERCIAL" ? "Commercial" : "Private"}
                      </span>
                    )}
                    {v.permitType && <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{v.permitType}</span>}
                    {activeDriver && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {activeDriver.name.split(" ")[0]}
                      </span>
                    )}
                  </div>

                  {/* Doc mini grid */}
                  <div className="grid grid-cols-6 gap-1">
                    {v.complianceDocuments.map((doc, di) => (
                      <div key={`${doc.type}-${di}`} className={`rounded-md py-1 text-center text-[9px] font-bold ${
                        doc.status === "GREEN" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : doc.status === "YELLOW" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        : doc.status === "ORANGE" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                      }`}>
                        {DOC_ABBR[doc.type] || doc.type}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  {v.pendingChallanAmount > 0 && (
                    <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-[11px] text-gray-400">Pending Challans</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">&#8377;{v.pendingChallanAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="space-y-2">
          {vehicles.map((v) => {
            const grad = v.overallStatus === "GREEN" ? "from-emerald-500 to-green-600" : v.overallStatus === "YELLOW" ? "from-amber-500 to-yellow-600" : v.overallStatus === "ORANGE" ? "from-orange-500 to-orange-600" : "from-red-500 to-rose-600";
            const activeDriver = v.activeDriver || v.driverMappings?.find((m) => m.isActive)?.driver;

            return (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className="group flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none transition-all"
              >
                {/* Status indicator */}
                <div className={`w-1 h-12 rounded-full bg-gradient-to-b ${grad} flex-shrink-0`} />

                {/* Icon */}
                {(() => { const GroupIcon = v.group?.icon ? getVehicleTypeIcon(v.group.icon) : Truck; return v.profileImage ? (
                  <img src={`${resolveImageUrl(v.profileImage) ?? ""}`} alt={v.registrationNumber} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-md"
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: `${resolveImageUrl(v.profileImage) ?? ""}`, x: r.right + 12, y: r.top + r.height / 2 }); }}
                    onMouseLeave={() => setHoverPhoto(null)} onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${!v.group?.color ? `bg-gradient-to-br ${grad}` : ''}`} style={{ backgroundColor: v.group?.color ? v.group.color + '12' : undefined }}>
                    <GroupIcon className="w-4 h-4" style={v.group?.color ? { color: v.group.color } : { color: 'white' }} />
                  </div>
                ); })()}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white font-mono tracking-wider group-hover:text-brand-500 transition-colors">
                      {v.registrationNumber}
                    </h3>
                    <Badge color={v.overallStatus === "GREEN" ? "success" : v.overallStatus === "YELLOW" ? "warning" : v.overallStatus === "ORANGE" ? "orange" : "error"} variant="light" size="sm">
                      {v.overallStatus === "GREEN" ? "OK" : v.overallStatus === "YELLOW" ? "Warn" : v.overallStatus === "ORANGE" ? "Critical" : "Expired"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    <span>{v.make} {v.model}</span>
                    <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                    <span>{v.fuelType}</span>
                    {v.vehicleUsage && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${v.vehicleUsage === "COMMERCIAL" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                        {v.vehicleUsage === "COMMERCIAL" ? "Commercial" : "Private"}
                      </span>
                    )}
                    {v.group && (() => { const GIcon = getVehicleTypeIcon(v.group.icon); return (
                      <><span className="text-gray-300 dark:text-gray-600">&bull;</span><span className="text-brand-500 dark:text-brand-400 font-medium flex items-center gap-0.5"><GIcon className="w-3 h-3" />{v.group.name}</span></>
                    ); })()}
                    {activeDriver && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{activeDriver.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Doc pills (desktop) */}
                <div className="hidden lg:flex items-center gap-2.5">
                  {v.complianceDocuments.slice(0, 6).map((doc) => {
                    const days = Math.ceil((new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const dotColor = doc.status === "GREEN" ? "bg-emerald-500" : doc.status === "YELLOW" ? "bg-amber-500" : doc.status === "ORANGE" ? "bg-orange-500" : "bg-red-500";
                    const textColor = doc.status === "GREEN" ? "text-emerald-600 dark:text-emerald-400" : doc.status === "YELLOW" ? "text-amber-600 dark:text-amber-400" : doc.status === "ORANGE" ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400";
                    return (
                      <div key={`${doc.type}-pill`} className="flex flex-col items-center gap-0.5">
                        <span className={`text-[9px] font-bold ${textColor}`}>{DOC_ABBR[doc.type] || doc.type}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                        <span className={`text-[8px] font-medium ${days <= 0 ? "text-red-500" : "text-gray-400"}`}>{days <= 0 ? "Exp" : `${days}d`}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Pending amount */}
                {v.pendingChallanAmount > 0 ? (
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 flex-shrink-0">
                    &#8377;{v.pendingChallanAmount.toLocaleString("en-IN")}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300 dark:text-gray-600 flex-shrink-0">&mdash;</span>
                )}

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        onPageChange={(p) => fetchVehicles(p)}
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
