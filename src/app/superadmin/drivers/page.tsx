"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { SuperadminDriversSkeleton } from "../skeletons";
import { useViewMode, ViewToggle } from "../_components/ViewToggle";
import {
  UserCircle,
  Search,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldOff,
  Phone,
} from "lucide-react";

type Driver = {
  id: string;
  name: string;
  licenseNumber: string;
  licenseExpiry: string;
  phone?: string | null;
  vehicleClass?: string;
  adminVerified?: boolean;
  tenant: { id: string; name: string; slug: string } | null;
};

type TenantOption = { id: string; name: string; slug: string };

function daysToExpiry(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function licenseBadge(d: string) {
  const days = daysToExpiry(d);
  if (days <= 0)
    return {
      label: "Expired",
      cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
      Icon: XCircle,
    };
  if (days <= 30)
    return {
      label: `${days}d`,
      cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
      Icon: AlertTriangle,
    };
  return {
    label: "OK",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Icon: CheckCircle2,
  };
}

export default function SuperadminDriversPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useViewMode("superadmin.drivers.view", "grid");

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

  const load = async () => {
    setLoading(true);
    try {
      const res = await superadminAPI.listDrivers({
        tenantId: tenantId || undefined,
      });
      setDrivers(res.data.data as Driver[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.licenseNumber.toLowerCase().includes(q) ||
        (d.phone || "").includes(q)
      );
    });
  }, [drivers, search]);

  const verifiedCount = useMemo(
    () => filtered.filter((d) => d.adminVerified).length,
    [filtered],
  );
  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId),
    [tenants, tenantId],
  );

  if (loading && drivers.length === 0) return <SuperadminDriversSkeleton />;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:border-gray-800 dark:from-emerald-500/[0.04] dark:via-gray-900 dark:to-emerald-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-400">
              Platform · Drivers
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              All drivers
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filtered.length} driver{filtered.length !== 1 ? "s" : ""}
              {selectedTenant
                ? ` in ${selectedTenant.name}`
                : " across all tenants"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <MiniStat
              label="Showing"
              value={String(filtered.length)}
              tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            />
            <MiniStat
              label="Verified"
              value={`${verifiedCount}/${filtered.length}`}
              tint="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
            />
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
              placeholder="Search by name / license / phone…"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all"
            />
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* Drivers */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
          title="No drivers match the current filters"
          description="Try clearing search or selecting a different tenant."
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <DriverCard key={d.id} driver={d} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden dark:border-gray-800 dark:bg-white/[0.02]">
          {filtered.map((d, i) => (
            <DriverRow key={d.id} driver={d} isFirst={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function DriverCard({ driver: d }: { driver: Driver }) {
  const badge = licenseBadge(d.licenseExpiry);
  const initials = d.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="group relative rounded-2xl border border-gray-200/80 bg-white p-5 transition-all hover:shadow-xl hover:shadow-gray-200/40 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-sm shadow-sm">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {d.name}
          </h3>
          <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
            {d.licenseNumber}
          </p>
        </div>
        {d.adminVerified ? (
          <span
            title="Admin verified"
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
          >
            <ShieldCheck className="w-3 h-3" />
            Verified
          </span>
        ) : (
          <span
            title="Not verified"
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          >
            <ShieldOff className="w-3 h-3" />
            Pending
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {d.tenant && (
          <Link
            href={`/superadmin/tenants/${d.tenant.id}`}
            className="flex items-center gap-1.5 text-[11px] text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 font-semibold"
          >
            <Building2 className="w-3 h-3" />
            {d.tenant.name}
          </Link>
        )}
        {d.phone && (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <Phone className="w-3 h-3" />
            {d.phone}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <span className="font-semibold">Class:</span>
          <span className="font-mono">{d.vehicleClass || "—"}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badge.cls}`}
        >
          <badge.Icon className="w-3 h-3" />
          License {badge.label}
        </span>
      </div>
    </div>
  );
}

function DriverRow({
  driver: d,
  isFirst,
}: {
  driver: Driver;
  isFirst: boolean;
}) {
  const badge = licenseBadge(d.licenseExpiry);
  const initials = d.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
        isFirst ? "" : "border-t border-gray-100 dark:border-gray-800"
      }`}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-xs flex-shrink-0 shadow-sm">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {d.name}
        </p>
        <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">
          {d.licenseNumber}
        </p>
      </div>

      {d.tenant ? (
        <Link
          href={`/superadmin/tenants/${d.tenant.id}`}
          className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 font-semibold min-w-[140px]"
        >
          <Building2 className="w-3 h-3" />
          {d.tenant.name}
        </Link>
      ) : (
        <span className="hidden md:inline text-[11px] text-gray-400 min-w-[140px]">—</span>
      )}

      <span className="hidden lg:inline text-[11px] font-mono text-gray-500 dark:text-gray-400 min-w-[60px]">
        {d.vehicleClass || "—"}
      </span>

      <span className="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 min-w-[110px]">
        {d.phone ? (
          <>
            <Phone className="w-3 h-3" />
            {d.phone}
          </>
        ) : (
          "—"
        )}
      </span>

      <span
        className={`hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${badge.cls}`}
      >
        <badge.Icon className="w-3 h-3" />
        {badge.label}
      </span>

      {d.adminVerified ? (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
          <ShieldCheck className="w-3 h-3" />
          Verified
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <ShieldOff className="w-3 h-3" />
          Pending
        </span>
      )}
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
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/20 p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}
