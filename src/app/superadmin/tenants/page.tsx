"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { TenantsListSkeleton } from "../skeletons";
import { useViewMode, ViewToggle } from "../_components/ViewToggle";
import {
  Building2,
  Plus,
  Search,
  Users,
  Pause,
  Play,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  plan: "FREE" | "PRO" | "ENTERPRISE";
  billingEmail?: string | null;
  userCount: number;
  createdAt: string;
};

const PLAN_LABEL: Record<Tenant["plan"], string> = {
  FREE: "Free",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const PLAN_TINT: Record<Tenant["plan"], string> = {
  FREE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  PRO: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  ENTERPRISE: "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white",
};

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [planFilter, setPlanFilter] = useState<"ALL" | "FREE" | "PRO" | "ENTERPRISE">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useViewMode("superadmin.tenants.view", "grid");

  const load = async () => {
    setLoading(true);
    try {
      const res = await superadminAPI.listTenants({
        search: search || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        plan: planFilter === "ALL" ? undefined : planFilter,
      });
      setTenants(res.data.data.tenants as Tenant[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, planFilter]);

  const toggleSuspend = async (t: Tenant) => {
    setBusy(t.id);
    try {
      if (t.status === "ACTIVE") {
        await superadminAPI.suspendTenant(t.id);
      } else if (t.status === "SUSPENDED") {
        await superadminAPI.resumeTenant(t.id);
      }
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(null);
    }
  };

  const summary = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.status === "ACTIVE").length;
    const suspended = tenants.filter((t) => t.status === "SUSPENDED").length;
    return { total, active, suspended };
  }, [tenants]);

  if (loading && tenants.length === 0) return <TenantsListSkeleton />;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
              Platform · Tenants
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              All tenants
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {summary.total} total · {summary.active} active · {summary.suspended} suspended
            </p>
          </div>
          <Link
            href="/superadmin/tenants/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            Provision tenant
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, slug, or billing email…"
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white transition-all"
            />
          </div>
          <FilterChipGroup
            label="Status"
            options={[
              { value: "ALL", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended" },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
          />
          <FilterChipGroup
            label="Plan"
            options={[
              { value: "ALL", label: "All" },
              { value: "FREE", label: "Free" },
              { value: "PRO", label: "Pro" },
              { value: "ENTERPRISE", label: "Enterprise" },
            ]}
            value={planFilter}
            onChange={(v) => setPlanFilter(v as typeof planFilter)}
          />
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* Tenants */}
      {tenants.length === 0 ? (
        <EmptyTenants />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenants.map((t) => (
            <TenantCard
              key={t.id}
              tenant={t}
              busy={busy === t.id}
              onSuspendToggle={() => toggleSuspend(t)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden dark:border-gray-800 dark:bg-white/[0.02]">
          {tenants.map((t, i) => (
            <TenantRow
              key={t.id}
              tenant={t}
              busy={busy === t.id}
              onSuspendToggle={() => toggleSuspend(t)}
              isFirst={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-1 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-1.5 pl-2.5 pr-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        <Filter className="w-3 h-3" />
        {label}
      </div>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 h-9 rounded-lg text-xs font-semibold transition-all ${
            value === o.value
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TenantCard({
  tenant: t,
  busy,
  onSuspendToggle,
}: {
  tenant: Tenant;
  busy: boolean;
  onSuspendToggle: () => void;
}) {
  const initial = t.name.charAt(0).toUpperCase();
  const isActive = t.status === "ACTIVE";
  const isSuspended = t.status === "SUSPENDED";
  const isDeleted = t.status === "DELETED";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white transition-all hover:shadow-xl hover:shadow-gray-200/40 hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700">
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isActive
            ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
            : isSuspended
              ? "bg-gradient-to-r from-amber-400 to-amber-500"
              : "bg-gradient-to-r from-red-400 to-red-500"
        }`}
      />

      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-black text-lg shadow-sm">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/superadmin/tenants/${t.id}`} className="block">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                {t.name}
              </h3>
              <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">
                {t.slug}
              </p>
            </Link>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${PLAN_TINT[t.plan]}`}
            >
              {PLAN_LABEL[t.plan]}
            </span>
            <StatusBadge status={t.status} />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {t.userCount} user{t.userCount !== 1 ? "s" : ""}
          </span>
          <span>Created {timeAgo(t.createdAt)}</span>
        </div>

        {t.billingEmail && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mb-4">
            <span className="font-semibold">Billing:</span> {t.billingEmail}
          </p>
        )}

        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/superadmin/tenants/${t.id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            View details
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          {!isDeleted && (
            <button
              onClick={onSuspendToggle}
              disabled={busy}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                isActive
                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  Suspend
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TenantRow({
  tenant: t,
  busy,
  onSuspendToggle,
  isFirst,
}: {
  tenant: Tenant;
  busy: boolean;
  onSuspendToggle: () => void;
  isFirst: boolean;
}) {
  const initial = t.name.charAt(0).toUpperCase();
  const isActive = t.status === "ACTIVE";
  const isSuspended = t.status === "SUSPENDED";
  const isDeleted = t.status === "DELETED";

  return (
    <div
      className={`group relative flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
        isFirst ? "" : "border-t border-gray-100 dark:border-gray-800"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${
          isActive
            ? "bg-emerald-500"
            : isSuspended
              ? "bg-amber-500"
              : "bg-red-500"
        }`}
      />
      <Link
        href={`/superadmin/tenants/${t.id}`}
        className="flex items-center gap-3 flex-1 min-w-0 ml-2"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-black text-sm shadow-sm flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
            {t.name}
          </p>
          <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">
            {t.slug}
          </p>
        </div>
      </Link>

      <span
        className={`hidden md:inline-flex text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${PLAN_TINT[t.plan]}`}
      >
        {PLAN_LABEL[t.plan]}
      </span>
      <div className="hidden md:block">
        <StatusBadge status={t.status} />
      </div>
      <span className="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 min-w-[80px]">
        <Users className="w-3 h-3" />
        {t.userCount} user{t.userCount !== 1 ? "s" : ""}
      </span>
      <span className="hidden lg:inline text-[11px] text-gray-500 dark:text-gray-400 min-w-[100px]">
        {timeAgo(t.createdAt)}
      </span>

      <div className="flex gap-2 flex-shrink-0">
        {!isDeleted && (
          <button
            onClick={onSuspendToggle}
            disabled={busy}
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              isActive
                ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/15"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-3 h-3" />
                Suspend
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Resume
              </>
            )}
          </button>
        )}
        <Link
          href={`/superadmin/tenants/${t.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 group-hover:text-yellow-600 group-hover:bg-yellow-50 dark:group-hover:text-yellow-400 dark:group-hover:bg-yellow-500/10 transition-all"
          aria-label="View tenant"
        >
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Tenant["status"] }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    );
  if (status === "SUSPENDED")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <AlertTriangle className="w-3 h-3" />
        Suspended
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
      <XCircle className="w-3 h-3" />
      Deleted
    </span>
  );
}

function EmptyTenants() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/20 p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 flex items-center justify-center mb-4">
        <Building2 className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        No tenants match your filters
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
        Either provision your first tenant or relax the search filters.
      </p>
      <Link
        href="/superadmin/tenants/new"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30"
      >
        <Plus className="w-4 h-4" />
        Provision your first tenant
      </Link>
    </div>
  );
}
