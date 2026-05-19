"use client";
import React, { useEffect, useMemo, useState } from "react";
import { vehicleAPI, vehicleGroupAPI } from "@/lib/api";
import Link from "next/link";
import { ComplianceSkeleton } from "@/components/ui/Skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

interface ComplianceDoc {
  id: string;
  type: string;
  status: string;
  expiryDate: string | null;
  documentUrl?: string | null;
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
  ownerName: string | null;
  make: string;
  model: string;
  fuelType: string;
  overallStatus: string;
  profileImage: string | null;
  group?: { id: string; name: string; icon: string; color?: string } | null;
  complianceDocuments: ComplianceDoc[];
}

const DOC_LABELS: Record<string, string> = {
  RC: "Registration",
  INSURANCE: "Insurance",
  PERMIT: "Permit",
  PUCC: "Pollution (PUC)",
  FITNESS: "Fitness",
  TAX: "Road Tax",
};

const DOC_TINT: Record<string, string> = {
  RC: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  INSURANCE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  PERMIT: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  PUCC: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
  FITNESS: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  TAX: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

function docLabel(type: string): string {
  return DOC_LABELS[type] || titleCase(type.replace(/_/g, " "));
}

type DocItem = {
  vehicleId: string;
  registrationNumber: string;
  ownerName: string | null;
  vehicleMake: string;
  vehicleModel: string;
  group: Vehicle["group"];
  doc: ComplianceDoc;
  days: number | null;
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default function ValidComplianceDocumentsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("ALL");
  const [regSearch, setRegSearch] = useState("");

  useEffect(() => {
    vehicleAPI
      .getAll({ limit: 100 })
      .then((res) => setVehicles(res.data.data.vehicles))
      .catch(console.error)
      .finally(() => setLoading(false));
    vehicleGroupAPI.getAll().then((res) => setGroups(res.data.data)).catch(() => {});
  }, []);

  // Only valid (GREEN) docs make it into this page — match the bucketing rule
  // used by /compliance so the totals line up across both screens.
  const allValid = useMemo<DocItem[]>(() => {
    return vehicles.flatMap((v) =>
      v.complianceDocuments
        .filter((doc) => doc.status === "GREEN")
        .map((doc) => ({
          vehicleId: v.id,
          registrationNumber: v.registrationNumber,
          ownerName: v.ownerName,
          vehicleMake: v.make,
          vehicleModel: v.model,
          group: v.group,
          doc,
          days: daysUntil(doc.expiryDate),
        })),
    );
  }, [vehicles]);

  const docTypes = useMemo(
    () => [...new Set(allValid.map((it) => it.doc.type))],
    [allValid],
  );

  const docTypeCounts = useMemo(() => {
    const search = regSearch.trim().toLowerCase();
    const scoped = allValid.filter((it) => {
      if (groupFilter !== "ALL" && it.group?.id !== groupFilter) return false;
      if (search && !it.registrationNumber.toLowerCase().includes(search)) return false;
      return true;
    });
    const counts: Record<string, number> = { ALL: scoped.length };
    for (const it of scoped) counts[it.doc.type] = (counts[it.doc.type] ?? 0) + 1;
    return counts;
  }, [allValid, groupFilter, regSearch]);

  const filtered = useMemo(() => {
    const search = regSearch.trim().toLowerCase();
    return allValid
      .filter((it) => {
        if (groupFilter !== "ALL" && it.group?.id !== groupFilter) return false;
        if (docTypeFilter !== "ALL" && it.doc.type !== docTypeFilter) return false;
        if (search && !it.registrationNumber.toLowerCase().includes(search)) return false;
        return true;
      })
      .sort((a, b) => {
        // Most days remaining first (lifetime → bottom).
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        return b.days - a.days;
      });
  }, [allValid, groupFilter, docTypeFilter, regSearch]);

  if (loading) return <ComplianceSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/compliance"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 mt-1"
            title="Back to Compliance"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              Valid Documents
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {allValid.length} document{allValid.length === 1 ? "" : "s"} healthy · greater than 30 days remaining
            </p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDocTypeFilter("ALL")}
            className={`text-xs font-semibold px-3 h-8 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${docTypeFilter === "ALL" ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100" : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}
          >
            All docs
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${docTypeFilter === "ALL" ? "bg-white/20 text-white dark:bg-gray-900/15 dark:text-gray-900" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
              {docTypeCounts.ALL ?? 0}
            </span>
          </button>
          {docTypes.map((t) => (
            <button
              key={t}
              onClick={() => setDocTypeFilter(docTypeFilter === t ? "ALL" : t)}
              className={`text-xs font-semibold px-3 h-8 rounded-lg border transition-colors inline-flex items-center gap-1.5 ${docTypeFilter === t ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100" : `${DOC_TINT[t] ?? "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300"} border-transparent hover:opacity-80`}`}
            >
              {docLabel(t)}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${docTypeFilter === t ? "bg-white/20 text-white dark:bg-gray-900/15 dark:text-gray-900" : "bg-black/5 dark:bg-white/10"}`}>
                {docTypeCounts[t] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="ALL">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <SearchInput
            value={regSearch}
            onChange={setRegSearch}
            placeholder="Search reg. no..."
            className="w-56"
            size="sm"
          />
        </div>
      </div>

      {/* Valid docs grid */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {allValid.length === 0 ? "No valid documents yet" : "No matches"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {allValid.length === 0
                ? "Documents marked valid (more than 30 days to expiry) will show here."
                : "Try clearing the filter or search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {filtered.map((it) => <DocCard key={`${it.vehicleId}-${it.doc.id}`} item={it} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function DocCard({ item }: { item: DocItem }) {
  const tint = DOC_TINT[item.doc.type] ?? "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const daysLabel = item.days === null ? "Lifetime" : `${item.days}d left`;

  return (
    <Link
      href={`/vehicles/${item.vehicleId}`}
      className="group block p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-white/[0.01] hover:border-gray-300 hover:shadow-sm dark:hover:border-gray-700 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {docLabel(item.doc.type)}
            </p>
            <span className="text-[11px] font-bold flex-shrink-0 text-emerald-600 dark:text-emerald-400">
              {daysLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-mono font-bold text-gray-700 dark:text-gray-300 truncate">{item.registrationNumber}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="truncate">{titleCase(item.vehicleMake)} {titleCase(item.vehicleModel)}</span>
          </div>
          {item.ownerName && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5" title={item.ownerName}>
              <span className="opacity-60">Owner: </span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">{titleCase(item.ownerName)}</span>
            </p>
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[10px] text-gray-400 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {item.doc.expiryDate
                ? new Date(item.doc.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "No expiry"}
            </span>
            <span className="text-[10px] font-semibold text-brand-500 group-hover:text-brand-600 inline-flex items-center gap-0.5">
              <RefreshCw className="w-3 h-3" />
              Renew
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
