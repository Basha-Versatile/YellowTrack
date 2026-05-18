"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { vehicleAPI, vehicleGroupAPI } from "@/lib/api";
import Link from "next/link";
import { ComplianceSkeleton } from "@/components/ui/Skeleton";
import {
  Truck,
  AlertOctagon,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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

type Bucket = "expired" | "critical" | "expiring" | "valid";

type DocItem = {
  vehicleId: string;
  registrationNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  group: Vehicle["group"];
  doc: ComplianceDoc;
  days: number | null; // null = lifetime
  bucket: Bucket;
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function bucketFor(doc: ComplianceDoc): Bucket {
  // Server already classifies via status — trust it as the source of truth.
  if (doc.status === "RED") return "expired";
  if (doc.status === "ORANGE") return "critical";
  if (doc.status === "YELLOW") return "expiring";
  return "valid";
}

export default function ComplianceOverviewPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<VehicleGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("ALL");
  const [regSearch, setRegSearch] = useState("");
  const [showValid, setShowValid] = useState(false);

  // Allow ?status=RED|ORANGE|YELLOW deep-link from the dashboard tiles to
  // focus the matching column visually (others render but are visually muted).
  const [focus, setFocus] = useState<Bucket | null>(() => {
    if (initialStatus === "RED") return "expired";
    if (initialStatus === "ORANGE") return "critical";
    if (initialStatus === "YELLOW") return "expiring";
    if (initialStatus === "GREEN") return "valid";
    return null;
  });

  useEffect(() => {
    vehicleAPI
      .getAll({ limit: 100 })
      .then((res) => setVehicles(res.data.data.vehicles))
      .catch(console.error)
      .finally(() => setLoading(false));
    vehicleGroupAPI.getAll().then((res) => setGroups(res.data.data)).catch(() => {});
  }, []);

  // Flatten every doc across every vehicle into a single typed list.
  const allItems = useMemo<DocItem[]>(() => {
    return vehicles.flatMap((v) =>
      v.complianceDocuments.map((doc) => ({
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        vehicleMake: v.make,
        vehicleModel: v.model,
        group: v.group,
        doc,
        days: daysUntil(doc.expiryDate),
        bucket: bucketFor(doc),
      })),
    );
  }, [vehicles]);

  const docTypes = useMemo(
    () => [...new Set(allItems.map((it) => it.doc.type))],
    [allItems],
  );

  // Per-chip counts honor the OTHER active filters (group + search) — that
  // way the number on each chip matches what you'd actually see after
  // clicking it. "All docs" is total across types under the same filters.
  const docTypeCounts = useMemo(() => {
    const search = regSearch.trim().toLowerCase();
    const scoped = allItems.filter((it) => {
      if (groupFilter !== "ALL" && it.group?.id !== groupFilter) return false;
      if (search && !it.registrationNumber.toLowerCase().includes(search)) return false;
      return true;
    });
    const counts: Record<string, number> = { ALL: scoped.length };
    for (const it of scoped) counts[it.doc.type] = (counts[it.doc.type] ?? 0) + 1;
    return counts;
  }, [allItems, groupFilter, regSearch]);

  // Apply filters once, then bucket.
  const filtered = useMemo(() => {
    const search = regSearch.trim().toLowerCase();
    return allItems.filter((it) => {
      if (groupFilter !== "ALL" && it.group?.id !== groupFilter) return false;
      if (docTypeFilter !== "ALL" && it.doc.type !== docTypeFilter) return false;
      if (search && !it.registrationNumber.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [allItems, groupFilter, docTypeFilter, regSearch]);

  const expired = filtered.filter((it) => it.bucket === "expired");
  const critical = filtered.filter((it) => it.bucket === "critical");
  const expiring = filtered.filter((it) => it.bucket === "expiring");
  const valid = filtered.filter((it) => it.bucket === "valid");

  // Top KPI numbers come from the unfiltered fleet snapshot, not the filtered
  // view — KPIs should reflect the fleet, not the current sub-cut.
  const fleetTotal = allItems.length;
  const fleetExpired = allItems.filter((it) => it.bucket === "expired").length;
  const fleetCritical = allItems.filter((it) => it.bucket === "critical").length;
  const fleetExpiring = allItems.filter((it) => it.bucket === "expiring").length;
  const fleetValid = allItems.filter((it) => it.bucket === "valid").length;
  const complianceRate = fleetTotal > 0 ? Math.round((fleetValid / fleetTotal) * 100) : 0;

  // Sort each bucket: most urgent first (lowest days remaining).
  // Within Expired, the most-overdue items come first.
  const sortByUrgency = (a: DocItem, b: DocItem) => {
    if (a.days === null) return 1;
    if (b.days === null) return -1;
    return a.days - b.days;
  };
  expired.sort(sortByUrgency);
  critical.sort(sortByUrgency);
  expiring.sort(sortByUrgency);

  if (loading) {
    return <ComplianceSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Compliance</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Every fleet document that needs attention — sorted by urgency
          </p>
        </div>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-all"
        >
          <Truck className="w-3.5 h-3.5" />
          View Vehicles
        </Link>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-lg border border-gray-200/80 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Compliance Rate</p>
          <p className={`text-lg font-black leading-none mt-1 ${complianceRate >= 80 ? "text-emerald-600 dark:text-emerald-400" : complianceRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
            {complianceRate}%
          </p>
          <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${complianceRate >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : complianceRate >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-red-400 to-red-500"}`}
              style={{ width: `${complianceRate}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{fleetValid} of {fleetTotal} docs valid</p>
        </div>
        <button
          type="button"
          onClick={() => setFocus(focus === "expired" ? null : "expired")}
          className={`rounded-lg border px-3 py-2.5 text-left transition-all ${focus === "expired" ? "border-red-400 ring-2 ring-red-200 dark:ring-red-500/20" : "border-red-200/60 hover:border-red-300"} bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5`}
        >
          <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-wider flex items-center gap-1"><AlertOctagon className="w-3 h-3" /> Expired</p>
          <p className="text-lg font-black text-red-600 dark:text-red-400 leading-none mt-1">{fleetExpired}</p>
          <p className="text-[10px] text-red-600/60 dark:text-red-400/60 mt-1">Past expiry — act now</p>
        </button>
        <button
          type="button"
          onClick={() => setFocus(focus === "critical" ? null : "critical")}
          className={`rounded-lg border px-3 py-2.5 text-left transition-all ${focus === "critical" ? "border-amber-400 ring-2 ring-amber-200 dark:ring-amber-500/20" : "border-amber-200/60 hover:border-amber-300"} bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5`}
        >
          <p className="text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3 animate-blink" /> Critical</p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400 leading-none mt-1 animate-blink">{fleetCritical}</p>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1">≤ 7 days remaining</p>
        </button>
        <button
          type="button"
          onClick={() => setFocus(focus === "expiring" ? null : "expiring")}
          className={`rounded-lg border px-3 py-2.5 text-left transition-all ${focus === "expiring" ? "border-amber-400 ring-2 ring-amber-200 dark:ring-amber-500/20" : "border-amber-200/60 hover:border-amber-300"} bg-amber-50/30 dark:border-amber-500/15 dark:bg-amber-500/[0.03]`}
        >
          <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Expiring</p>
          <p className="text-lg font-black text-amber-600 dark:text-amber-400 leading-none mt-1">{fleetExpiring}</p>
          <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1">8 – 30 days out</p>
        </button>
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
            className="w-48"
            size="sm"
            value={regSearch}
            onChange={setRegSearch}
            placeholder="Search reg. no…"
          />
        </div>
      </div>

      {/* Action queue — 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ColumnBoard
          title="Expired"
          subtitle="Past expiry — immediate action"
          tone="red"
          items={expired}
          dimmed={focus !== null && focus !== "expired"}
          icon={<AlertOctagon className="w-4 h-4" />}
        />
        <ColumnBoard
          title="Critical"
          subtitle="≤ 7 days remaining"
          tone="amber-strong"
          items={critical}
          dimmed={focus !== null && focus !== "critical"}
          icon={<AlertTriangle className="w-4 h-4" />}
          blink
        />
        <ColumnBoard
          title="Expiring"
          subtitle="8 – 30 days remaining"
          tone="amber"
          items={expiring}
          dimmed={focus !== null && focus !== "expiring"}
          icon={<Clock className="w-4 h-4" />}
        />
      </div>

      {/* Collapsed Valid section */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowValid((s) => !s)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900 dark:text-white">All Valid Documents</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {valid.length} document{valid.length === 1 ? "" : "s"} healthy · greater than 30 days remaining
              </p>
            </div>
          </div>
          {showValid ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {showValid && (
          <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {valid.length === 0 ? (
              <p className="text-xs text-gray-400 col-span-full text-center py-6">No matching valid documents.</p>
            ) : (
              valid.map((it) => <DocCard key={`${it.vehicleId}-${it.doc.id}`} item={it} variant="valid" />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Column ─────────────────────────────────────────────── */

function ColumnBoard({
  title,
  subtitle,
  tone,
  items,
  dimmed,
  icon,
  blink,
}: {
  title: string;
  subtitle: string;
  tone: "red" | "amber-strong" | "amber";
  items: DocItem[];
  dimmed: boolean;
  icon: React.ReactNode;
  blink?: boolean;
}) {
  const headerTone =
    tone === "red"
      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
      : tone === "amber-strong"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
        : "bg-amber-50/60 text-amber-700/80 dark:bg-amber-500/[0.06] dark:text-amber-400/80";
  return (
    <div className={`rounded-2xl border bg-white dark:bg-white/[0.02] flex flex-col min-h-[280px] transition-opacity ${dimmed ? "opacity-40" : "opacity-100"} ${tone === "red" ? "border-red-200/80 dark:border-red-500/20" : "border-amber-200/80 dark:border-amber-500/20"}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 rounded-t-2xl ${headerTone}`}>
        <div className="flex items-center gap-2">
          <span className={blink ? "animate-blink" : ""}>{icon}</span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider">{title}</p>
            <p className="text-[10px] font-medium opacity-70">{subtitle}</p>
          </div>
        </div>
        <span className={`text-lg font-black ${blink ? "animate-blink" : ""}`}>{items.length}</span>
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[640px]">
        {items.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle2 className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Nothing here — all clear.</p>
          </div>
        ) : (
          items.map((it) => <DocCard key={`${it.vehicleId}-${it.doc.id}`} item={it} variant={it.bucket} />)
        )}
      </div>
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────── */

function DocCard({ item, variant }: { item: DocItem; variant: Bucket }) {
  const tint = DOC_TINT[item.doc.type] ?? "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  const daysLabel = (() => {
    if (item.days === null) return "Lifetime";
    if (item.days < 0) return `${Math.abs(item.days)}d overdue`;
    if (item.days === 0) return "Due today";
    return `${item.days}d left`;
  })();
  const daysColor =
    variant === "expired"
      ? "text-red-700 dark:text-red-400"
      : variant === "critical"
        ? "text-amber-700 dark:text-amber-400"
        : variant === "expiring"
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400";

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
            <span className={`text-[11px] font-bold flex-shrink-0 ${daysColor} ${variant === "critical" ? "animate-blink" : ""}`}>
              {daysLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-mono font-bold text-gray-700 dark:text-gray-300 truncate">{item.registrationNumber}</span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="truncate">{titleCase(item.vehicleMake)} {titleCase(item.vehicleModel)}</span>
          </div>
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
