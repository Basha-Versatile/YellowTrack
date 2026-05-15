"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { SuperadminVehiclesSkeleton } from "../skeletons";
import { useViewMode, ViewToggle } from "../_components/ViewToggle";
import {
  Truck,
  Search,
  Filter,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  Fuel,
} from "lucide-react";

type Vehicle = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  fuelType: string;
  overallStatus: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  pendingChallanAmount: number;
  tenant: { id: string; name: string; slug: string } | null;
};

type TenantOption = { id: string; name: string; slug: string };
type Pagination = { page: number; totalPages: number; total: number };

const STATUS_OPTIONS = [
  { value: "", label: "All", Icon: null },
  { value: "GREEN", label: "OK", Icon: CheckCircle2 },
  { value: "YELLOW", label: "Warn", Icon: AlertTriangle },
  { value: "RED", label: "Expired", Icon: XCircle },
];

const STATUS_TINT: Record<Vehicle["overallStatus"], string> = {
  GREEN: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  YELLOW: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  ORANGE: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 animate-blink",
  RED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default function SuperadminVehiclesPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "GREEN" | "YELLOW" | "RED">("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useViewMode("superadmin.vehicles.view", "list");

  useEffect(() => {
    superadminAPI
      .listTenants({ limit: 100 })
      .then((r) => {
        const list =
          (r.data.data.tenants as Array<{
            id: string;
            name: string;
            slug: string;
          }>) ?? [];
        setTenants(
          list
            .map((t) => ({ id: String(t.id ?? ""), name: t.name, slug: t.slug }))
            .filter((t) => t.id),
        );
      })
      .catch(console.error);
  }, []);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await superadminAPI.listVehicles({
        tenantId: tenantId || undefined,
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 20,
      });
      setVehicles(res.data.data.vehicles as Vehicle[]);
      setPagination({
        page: res.data.data.pagination.page,
        totalPages: res.data.data.pagination.totalPages,
        total: res.data.data.pagination.total,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(1), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, search, status]);

  const totalPendingFines = useMemo(
    () => vehicles.reduce((s, v) => s + (v.pendingChallanAmount || 0), 0),
    [vehicles],
  );
  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId),
    [tenants, tenantId],
  );

  if (loading && vehicles.length === 0) return <SuperadminVehiclesSkeleton />;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:border-gray-800 dark:from-blue-500/[0.04] dark:via-gray-900 dark:to-blue-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700/70 dark:text-blue-400">
              Platform · Fleet
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              All vehicles
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {pagination.total} vehicle{pagination.total !== 1 ? "s" : ""}
              {selectedTenant
                ? ` in ${selectedTenant.name}`
                : " across all tenants"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <MiniStat
              label="Showing"
              value={String(vehicles.length)}
              tint="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
            />
            {totalPendingFines > 0 && (
              <MiniStat
                label="Pending fines"
                value={`₹${totalPendingFines.toLocaleString("en-IN")}`}
                tint="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
              />
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-3">
          <TenantSelect
            tenants={tenants}
            value={tenantId}
            onChange={setTenantId}
          />
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search registration / make / model…"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-1 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 pl-2.5 pr-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <Filter className="w-3 h-3" />
              Status
            </div>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value || "ALL"}
                onClick={() => setStatus(s.value as typeof status)}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold transition-all ${
                  status === s.value
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {s.Icon && <s.Icon className="w-3 h-3" />}
                {s.label}
              </button>
            ))}
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* List / Grid */}
      <div className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden dark:border-gray-800 dark:bg-white/[0.02]">
        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            title="No vehicles match the current filters"
            description="Try clearing filters or switching tenant scope."
          />
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
            {pagination.totalPages > 1 && (
              <PaginationBar
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onChange={load}
              />
            )}
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-gray-800/40 backdrop-blur">
                  <tr className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Pending fines</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr
                      key={v.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-500/10 text-blue-700 dark:text-blue-400">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                              {v.registrationNumber}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              {v.make} {v.model} · {v.fuelType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {v.tenant ? (
                          <Link
                            href={`/superadmin/tenants/${v.tenant.id}`}
                            className="inline-flex items-center gap-1.5 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 font-semibold text-xs"
                          >
                            <Building2 className="w-3 h-3" />
                            {v.tenant.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={v.overallStatus} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        {v.pendingChallanAmount > 0 ? (
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">
                            ₹{v.pendingChallanAmount.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <PaginationBar
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onChange={load}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VehicleCard({ vehicle: v }: { vehicle: Vehicle }) {
  return (
    <div className="group rounded-2xl border border-gray-200/80 bg-white p-4 transition-all hover:shadow-xl hover:shadow-gray-200/40 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-500/10 text-blue-700 dark:text-blue-400 flex-shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono font-bold text-sm text-gray-900 dark:text-white truncate">
            {v.registrationNumber}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {v.make} {v.model}
          </p>
        </div>
        <StatusPill status={v.overallStatus} />
      </div>
      <div className="flex items-center justify-between text-[11px] mb-3">
        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Fuel className="w-3 h-3" />
          {v.fuelType}
        </span>
        {v.pendingChallanAmount > 0 && (
          <span className="font-bold text-red-600 dark:text-red-400">
            ₹{v.pendingChallanAmount.toLocaleString("en-IN")}
          </span>
        )}
      </div>
      {v.tenant && (
        <Link
          href={`/superadmin/tenants/${v.tenant.id}`}
          className="inline-flex items-center gap-1.5 mt-2 pt-3 border-t border-gray-100 dark:border-gray-800 w-full text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 font-semibold text-xs"
        >
          <Building2 className="w-3 h-3" />
          {v.tenant.name}
        </Link>
      )}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/40 dark:bg-gray-800/20">
      <p className="text-xs text-gray-500">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TenantSelect({
  tenants,
  value,
  onChange,
}: {
  tenants: TenantOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative min-w-[220px]">
      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 pl-10 pr-8 appearance-none rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all"
      >
        <option value="">All tenants</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={`rounded-xl px-4 py-2.5 ${tint}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="text-lg font-black mt-0.5">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: Vehicle["overallStatus"] }) {
  const Icon =
    status === "GREEN"
      ? CheckCircle2
      : status === "YELLOW"
        ? AlertTriangle
        : status === "ORANGE"
          ? AlertOctagon
          : XCircle;
  const label =
    status === "GREEN"
      ? "OK"
      : status === "YELLOW"
        ? "Warn"
        : status === "ORANGE"
          ? "Critical"
          : "Expired";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${STATUS_TINT[status]}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400/20 to-blue-500/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}
