"use client";
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { driverAPI } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";
import { DriversListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import Pagination, { useClientPagination } from "@/components/ui/Pagination";
import { Download, UserPlus, Users, Check, AlertTriangle, AlertCircle, List, LayoutGrid, User, Link2, ChevronRight } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { resolveImageUrl } from "@/components/vehicles/VehicleThumb";

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleClass: string;
  riskScore: number;
  licenseStatus: string;
  profilePhoto: string | null;
  verificationToken: string | null;
  selfVerifiedAt: string | null;
  adminVerified: boolean;
  createdAt: string;
  documents: Array<{ id: string }>;
}

export default function DriversPage() {
  const toast = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "GREEN" | "YELLOW" | "ORANGE" | "RED">("ALL");
  const [view, setView] = useState<"list" | "cards">("list");
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "xlsx" | "pdf">("csv");
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);

  const handleExport = () => {
    const data = drivers.map((d) => ({
      Name: d.name,
      Phone: d.phone || "",
      "License Number": d.licenseNumber,
      "License Expiry": new Date(d.licenseExpiry).toLocaleDateString("en-IN"),
      "Vehicle Class": d.vehicleClass,
      Status: d.licenseStatus === "GREEN" ? "Active" : d.licenseStatus === "YELLOW" ? "Expiring" : "Expired",
      "Risk Score": d.riskScore,
      Documents: d.documents?.length || 0,
    }));

    if (exportFormat === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, "drivers.json");
    } else if (exportFormat === "csv") {
      const headers = Object.keys(data[0] || {});
      const csvRows = [headers.join(","), ...data.map((row) => headers.map((h) => `"${String((row as Record<string, unknown>)[h] ?? "")}"`).join(","))];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      downloadBlob(blob, "drivers.csv");
    } else if (exportFormat === "xlsx") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Drivers");
      XLSX.writeFile(wb, "drivers.xlsx");
    } else if (exportFormat === "pdf") {
      const printWin = window.open("", "_blank", "width=800,height=600");
      if (!printWin) return;
      const rows = data.map((d) => `<tr>${Object.values(d).map((v) => `<td style="padding:8px;border:1px solid #e5e7eb;font-size:12px">${v}</td>`).join("")}</tr>`).join("");
      const headers = Object.keys(data[0] || {}).map((h) => `<th style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;text-align:left">${h}</th>`).join("");
      printWin.document.write(`<html><head><title>Drivers Export</title><style>body{font-family:system-ui,sans-serif;margin:40px}table{border-collapse:collapse;width:100%}h1{font-size:20px;margin-bottom:4px}p{color:#666;font-size:13px;margin-bottom:20px}</style></head><body><h1>Drivers Report</h1><p>Yellow Track — ${new Date().toLocaleDateString("en-IN")} — ${data.length} drivers</p><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table><script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
      printWin.document.close();
    }
    setShowExport(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const fetchDrivers = () => {
    driverAPI.getAll()
      .then((res) => setDrivers(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDrivers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = drivers.filter((d) => {
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || d.licenseStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { page, setPage, perPage, setPerPage, totalPages, totalItems, paginatedItems } = useClientPagination(filtered, 10);

  const activeCount = drivers.filter((d) => d.licenseStatus === "GREEN").length;
  const expiringCount = drivers.filter((d) => d.licenseStatus === "YELLOW").length;
  const expiredCount = drivers.filter((d) => d.licenseStatus === "RED").length;

  if (loading) return <DriversListSkeleton view={view} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Drivers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage fleet drivers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link
            href="/drivers/add"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Add Driver
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{drivers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-emerald-500/60 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-amber-500/60 uppercase tracking-wider">Expiring</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{expiringCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-red-500/60 uppercase tracking-wider">Expired</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-400">{expiredCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search by name or license..."
        />
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl h-10">
          {(["ALL", "GREEN", "YELLOW", "ORANGE", "RED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all ${statusFilter === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              {s !== "ALL" && <span className={`w-1.5 h-1.5 rounded-full ${s === "GREEN" ? "bg-emerald-500" : s === "YELLOW" ? "bg-amber-500" : s === "ORANGE" ? "bg-orange-500" : "bg-red-500"}`} />}
              {s === "ALL" ? "All" : s === "GREEN" ? "Active" : s === "YELLOW" ? "Expiring" : s === "ORANGE" ? "Critical" : "Expired"}
            </button>
          ))}
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

      {/* Driver Cards */}
      {totalItems === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <User className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">{drivers.length === 0 ? "No drivers yet. Add your first driver." : "No drivers match your search."}</p>
          {drivers.length === 0 && <Link href="/drivers/add" className="mt-3 inline-block text-sm font-medium text-brand-500 hover:text-brand-600">Add Driver</Link>}
        </div>
      ) : view === "cards" ? (
        /* ── CARD VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((driver) => {
            const daysToExpiry = Math.ceil((new Date(driver.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const ls = driver.licenseStatus;
            const grad = ls === "RED" ? "from-red-500 to-rose-600" : ls === "ORANGE" ? "from-orange-500 to-orange-600" : ls === "YELLOW" ? "from-amber-500 to-yellow-600" : "from-emerald-500 to-green-600";
            const avatarCls = ls === "RED" ? "bg-gradient-to-br from-red-400 to-red-600" : ls === "ORANGE" ? "bg-gradient-to-br from-orange-400 to-orange-600" : ls === "YELLOW" ? "bg-gradient-to-br from-yellow-400 to-yellow-500" : "bg-gradient-to-br from-brand-400 to-brand-600";
            const badgeColor = ls === "RED" ? "error" : ls === "ORANGE" ? "orange" : ls === "YELLOW" ? "warning" : "success";
            const badgeLabel = ls === "RED" ? "Expired" : ls === "ORANGE" ? "Critical" : ls === "YELLOW" ? "Expiring" : "Active";
            const shadowClr = ls === "RED" ? "shadow-red-500/10" : ls === "ORANGE" ? "shadow-orange-500/10" : ls === "YELLOW" ? "shadow-amber-500/10" : "shadow-emerald-500/10";
            const docCount = driver.documents?.length || 0;

            return (
              <Link key={driver.id} href={`/drivers/${driver.id}`}
                className={`group rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden hover:shadow-xl ${shadowClr} transition-all duration-300`}>
                <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {driver.profilePhoto ? (
                        <img src={(resolveImageUrl(driver.profilePhoto) ?? "")} alt={driver.name}
                          className={`w-12 h-12 rounded-xl object-cover shadow-lg ${shadowClr}`}
                          onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoverPhoto({ url: (resolveImageUrl(driver.profilePhoto) ?? ""), x: r.right + 12, y: r.top + r.height / 2 }); }}
                          onMouseLeave={() => setHoverPhoto(null)} />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-lg ${avatarCls} ${shadowClr}`}>
                          {driver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors">{driver.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{driver.licenseNumber}</p>
                      </div>
                    </div>
                    <Badge color={badgeColor} variant="light" size="sm">{badgeLabel}</Badge>
                  </div>

                  {/* Meta chips */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{driver.vehicleClass}</span>
                    {driver.phone && <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{driver.phone}</span>}
                    {docCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">{docCount} doc{docCount > 1 ? "s" : ""}</span>}
                    {driver.verificationToken && (
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const url = `${window.location.origin}/public/driver/verify/${driver.verificationToken}`; navigator.clipboard.writeText(url); setCopiedId(driver.id); setTimeout(() => setCopiedId(null), 2000); }}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 transition-colors ${copiedId === driver.id ? "bg-emerald-50 text-emerald-600" : "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100"}`}>
                        {copiedId === driver.id ? (
                          <><Check className="w-3 h-3" />Copied</>
                        ) : (
                          <><Link2 className="w-3 h-3" />Link</>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expiry + Verification */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className={`text-xs font-bold ${daysToExpiry <= 0 ? "text-red-600" : daysToExpiry <= 30 ? "text-amber-600" : "text-emerald-600"}`}>
                      {daysToExpiry <= 0 ? `Expired ${Math.abs(daysToExpiry)}d ago` : `${daysToExpiry}d left`}
                    </span>
                    {driver.selfVerifiedAt ? (
                      <button
                        disabled={togglingId === driver.id}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTogglingId(driver.id); (async () => { try { await driverAPI.toggleVerification(driver.id); setDrivers((prev) => prev.map((d) => d.id === driver.id ? { ...d, adminVerified: !d.adminVerified } : d)); toast.success(driver.adminVerified ? "Unverified" : "Verified"); } catch { toast.error("Failed"); } finally { setTogglingId(null); } })(); }}
                        className="flex items-center gap-1.5 disabled:cursor-wait" title={driver.adminVerified ? "Verified — click to unverify" : "Unverified — click to verify"}>
                        <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-300 ${togglingId === driver.id ? "bg-gray-300 dark:bg-gray-600 animate-pulse" : driver.adminVerified ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-300 ${togglingId === driver.id ? "left-[8px]" : driver.adminVerified ? "left-[15px]" : "left-[2px]"}`} />
                        </div>
                        <span className={`text-[9px] font-bold ${togglingId === driver.id ? "text-gray-400" : driver.adminVerified ? "text-emerald-600" : "text-gray-400"}`}>{togglingId === driver.id ? "..." : driver.adminVerified ? "Verified" : "Unverified"}</span>
                      </button>
                    ) : (
                      <span className="text-[9px] text-gray-400">Pending</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="space-y-3">
          {paginatedItems.map((driver) => {
            const daysToExpiry = Math.ceil((new Date(driver.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const ls = driver.licenseStatus;

            const borderCls = ls === "RED" ? "border-red-200/80 dark:border-red-500/20" : ls === "ORANGE" ? "border-orange-200/80 dark:border-orange-500/20" : ls === "YELLOW" ? "border-amber-200/80 dark:border-amber-500/20" : "border-gray-200/80 dark:border-gray-800";
            const barCls = ls === "RED" ? "bg-gradient-to-r from-red-500 to-rose-500" : ls === "ORANGE" ? "bg-gradient-to-r from-orange-500 to-orange-600" : ls === "YELLOW" ? "bg-gradient-to-r from-amber-500 to-amber-600" : "bg-gradient-to-r from-emerald-500 to-green-500";
            const avatarCls = ls === "RED" ? "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20" : ls === "ORANGE" ? "bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/20" : ls === "YELLOW" ? "bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-yellow-500/20" : "bg-gradient-to-br from-brand-400 to-brand-600 shadow-brand-500/20";
            const badgeColor = ls === "RED" ? "error" : ls === "ORANGE" ? "orange" : ls === "YELLOW" ? "warning" : "success";
            const badgeLabel = ls === "RED" ? "Expired" : ls === "ORANGE" ? "Critical" : ls === "YELLOW" ? "Expiring" : "Active";

            return (
              <div key={driver.id}
                className={`rounded-xl border bg-white dark:bg-white/[0.02] transition-all duration-200 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none ${borderCls}`}>
                <div className={`h-0.5 rounded-t-xl ${barCls}`} />

                <div className="p-4 flex items-center gap-4">
                  {/* Avatar */}
                  <Link href={`/drivers/${driver.id}`} className="flex-shrink-0">
                    {driver.profilePhoto ? (
                      <img
                        src={(resolveImageUrl(driver.profilePhoto) ?? "")}
                        alt={driver.name}
                        className="w-12 h-12 rounded-xl object-cover shadow-lg cursor-pointer"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverPhoto({ url: (resolveImageUrl(driver.profilePhoto) ?? ""), x: rect.right + 12, y: rect.top + rect.height / 2 });
                        }}
                        onMouseLeave={() => setHoverPhoto(null)}
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg ${avatarCls}`}>
                        {driver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/drivers/${driver.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-brand-500 transition-colors">{driver.name}</Link>
                      <Badge color={badgeColor} variant="light" size="sm">
                        {badgeLabel}
                      </Badge>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">{driver.vehicleClass}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{driver.licenseNumber}</span>
                      <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                      <span className={daysToExpiry <= 0 ? "text-red-600 dark:text-red-400 font-semibold" : daysToExpiry <= 7 ? "text-orange-600 dark:text-orange-400 font-semibold" : daysToExpiry <= 30 ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                        {daysToExpiry <= 0 ? `Expired ${Math.abs(daysToExpiry)}d ago` : `${daysToExpiry}d to expiry`}
                      </span>
                      {driver.phone && (<><span className="text-gray-300 dark:text-gray-600">&bull;</span><span>{driver.phone}</span></>)}
                      {driver.documents?.length > 0 && (<><span className="text-gray-300 dark:text-gray-600">&bull;</span><span>{driver.documents.length} doc{driver.documents.length > 1 ? "s" : ""}</span></>)}
                    </div>
                  </div>

                  {/* Copy Link */}
                  {driver.verificationToken && (
                    <button
                      onClick={async (e) => { e.preventDefault(); const url = `${window.location.origin}/public/driver/verify/${driver.verificationToken}`; await navigator.clipboard.writeText(url); setCopiedId(driver.id); setTimeout(() => setCopiedId(null), 2000); }}
                      className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 transition-colors" title="Copy verification link">
                      {copiedId === driver.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Verification Toggle */}
                  {driver.selfVerifiedAt ? (
                    <button
                      disabled={togglingId === driver.id}
                      onClick={async (e) => { e.preventDefault(); setTogglingId(driver.id); try { await driverAPI.toggleVerification(driver.id); setDrivers((prev) => prev.map((d) => d.id === driver.id ? { ...d, adminVerified: !d.adminVerified } : d)); toast.success(driver.adminVerified ? "Unverified" : "Verified", driver.adminVerified ? "Driver can edit profile" : "Driver profile locked"); } catch { toast.error("Failed"); } finally { setTogglingId(null); } }}
                      className="flex items-center gap-1.5 flex-shrink-0 disabled:cursor-wait" title={driver.adminVerified ? "Click to unverify" : "Click to verify"}>
                      <div className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${togglingId === driver.id ? "bg-gray-300 dark:bg-gray-600 animate-pulse" : driver.adminVerified ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${togglingId === driver.id ? "left-[10px]" : driver.adminVerified ? "left-[18px]" : "left-0.5"}`} />
                      </div>
                    </button>
                  ) : (
                    <span className="text-[9px] text-gray-400 flex-shrink-0">Pending</span>
                  )}

                  {/* View */}
                  <Link href={`/drivers/${driver.id}`}
                    className="rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 p-2 text-gray-500 transition-colors" title="View Details">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} totalItems={totalItems} itemsPerPage={perPage} onPageChange={setPage} onItemsPerPageChange={setPerPage} itemLabel="drivers" />

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowExport(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-brand-500 to-brand-400 px-6 py-5">
              <h3 className="text-lg font-bold text-white">Export Drivers</h3>
              <p className="text-white/70 text-sm mt-0.5">{drivers.length} driver{drivers.length !== 1 ? "s" : ""} will be exported</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Select Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "csv" as const, label: "CSV", desc: "Spreadsheet compatible", icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125" },
                    { value: "json" as const, label: "JSON", desc: "Developer friendly", icon: "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" },
                    { value: "xlsx" as const, label: "Excel", desc: "Microsoft Excel", icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" },
                    { value: "pdf" as const, label: "PDF", desc: "Print ready", icon: "M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247" },
                  ]).map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setExportFormat(f.value)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all ${
                        exportFormat === f.value
                          ? "border-yellow-400 bg-yellow-50 shadow-sm dark:bg-yellow-500/10 dark:border-yellow-500"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      }`}
                    >
                      <svg className={`w-6 h-6 ${exportFormat === f.value ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                      </svg>
                      <span className={`text-sm font-bold ${exportFormat === f.value ? "text-yellow-700 dark:text-yellow-400" : "text-gray-700 dark:text-gray-300"}`}>{f.label}</span>
                      <span className="text-[10px] text-gray-400">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download {exportFormat.toUpperCase()}
                </button>
                <button
                  onClick={() => setShowExport(false)}
                  className="h-11 px-5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hover photo preview (fixed position, escapes all parent overflow) */}
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
