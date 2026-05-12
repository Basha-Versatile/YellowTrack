"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { SuperadminDashboardSkeleton } from "./skeletons";
import {
  Building2,
  Truck,
  Users,
  UserCircle,
  Plus,
  TrendingUp,
  Database,
  Activity,
  Mail,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";

type TopTenant = {
  tenantId: string;
  name: string;
  slug: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  vehicles: number;
  drivers: number;
};

type RecentTenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
};

type Stats = {
  tenants: number;
  suspended: number;
  users: number;
  vehicles: number;
  drivers: number;
  growth7d: { tenants: number; users: number; vehicles: number; drivers: number };
  plans: { FREE: number; PRO: number; ENTERPRISE: number };
  statuses: { ACTIVE: number; SUSPENDED: number; DELETED: number };
  topTenants: TopTenant[];
  recentTenants: RecentTenant[];
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
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function SuperadminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date>(new Date());
  const { user } = useAuth();

  useEffect(() => {
    superadminAPI
      .getStats()
      .then((r) => setStats(r.data.data as Stats))
      .catch(console.error)
      .finally(() => setLoading(false));
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (loading || !stats) return <SuperadminDashboardSkeleton />;

  return (
    <div className="space-y-6">
      <HeroHeader name={user?.name ?? "Super Admin"} now={now} />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Tenants"
          value={stats.tenants}
          delta={stats.growth7d.tenants}
          deltaLabel="this week"
          Icon={Building2}
          tint="from-yellow-400/15 to-yellow-500/5"
          iconTint="text-yellow-600 bg-yellow-100 dark:bg-yellow-500/15 dark:text-yellow-400"
          href="/superadmin/tenants"
        />
        <KpiCard
          label="Vehicles"
          value={stats.vehicles}
          delta={stats.growth7d.vehicles}
          deltaLabel="this week"
          Icon={Truck}
          tint="from-blue-400/15 to-blue-500/5"
          iconTint="text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400"
          href="/superadmin/vehicles"
        />
        <KpiCard
          label="Drivers"
          value={stats.drivers}
          delta={stats.growth7d.drivers}
          deltaLabel="this week"
          Icon={UserCircle}
          tint="from-emerald-400/15 to-emerald-500/5"
          iconTint="text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400"
          href="/superadmin/drivers"
        />
        <KpiCard
          label="Users"
          value={stats.users}
          delta={stats.growth7d.users}
          deltaLabel="this week"
          Icon={Users}
          tint="from-purple-400/15 to-purple-500/5"
          iconTint="text-purple-600 bg-purple-100 dark:bg-purple-500/15 dark:text-purple-400"
        />
      </div>

      {/* Top tenants + plan donut */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <TopTenantsLeaderboard tenants={stats.topTenants} />
        <PlanBreakdown plans={stats.plans} statuses={stats.statuses} />
      </div>

      {/* Recent activity + system health */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RecentTenants tenants={stats.recentTenants} className="xl:col-span-2" />
        <SystemHealth />
      </div>
    </div>
  );
}

// ── Hero header ──────────────────────────────────────────────────────────────
function HeroHeader({ name, now }: { name: string; now: Date }) {
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);
  const firstName = name.split(" ")[0];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-1/3 w-64 h-64 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/10"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
              Platform · Superadmin
            </span>
            <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-yellow-500/50" />
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              live
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage tenants, monitor fleet activity, and keep the platform healthy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/superadmin/tenants"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 transition-all"
          >
            View tenants
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/superadmin/tenants/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            New tenant
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  Icon,
  tint,
  iconTint,
  href,
}: {
  label: string;
  value: number;
  delta: number;
  deltaLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
  iconTint: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-lg hover:shadow-gray-200/40 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700`}
    >
      <div
        aria-hidden
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${tint} blur-2xl`}
      />
      <div className="relative flex items-start justify-between">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconTint}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
        )}
      </div>
      <p className="relative mt-4 text-3xl font-black text-gray-900 dark:text-white tracking-tight">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="relative text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="relative mt-3 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${
            delta > 0
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
              : delta < 0
                ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          <TrendingUp className={`w-3 h-3 ${delta < 0 ? "rotate-180" : ""}`} />
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
        <span className="text-[11px] text-gray-400">{deltaLabel}</span>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Top tenants leaderboard ─────────────────────────────────────────────────
function TopTenantsLeaderboard({ tenants }: { tenants: TopTenant[] }) {
  const max = Math.max(...tenants.map((t) => t.vehicles), 1);
  return (
    <div className="xl:col-span-2 rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Top tenants by fleet
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Ranked by active vehicles
          </p>
        </div>
        <Link
          href="/superadmin/tenants"
          className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 flex items-center gap-1"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {tenants.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-5 h-5" />}
          title="No tenants yet"
          description="Provision your first tenant to start seeing rankings here."
        />
      ) : (
        <div className="space-y-3">
          {tenants.map((t, i) => {
            const pct = (t.vehicles / max) * 100;
            return (
              <Link
                key={t.tenantId}
                href={`/superadmin/tenants/${t.tenantId}`}
                className="group block rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-lg text-[11px] font-black ${
                      i === 0
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-md shadow-yellow-500/30"
                        : i === 1
                          ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          : i === 2
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                        {t.name}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {t.plan}
                      </span>
                      {t.status === "SUSPENDED" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          Suspended
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {t.vehicles} vehicles
                      </span>
                      <span className="flex items-center gap-1">
                        <UserCircle className="w-3 h-3" />
                        {t.drivers} drivers
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          i === 0
                            ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                            : "bg-gray-400/70 dark:bg-gray-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Plan donut + status breakdown ───────────────────────────────────────────
function PlanBreakdown({
  plans,
  statuses,
}: {
  plans: { FREE: number; PRO: number; ENTERPRISE: number };
  statuses: { ACTIVE: number; SUSPENDED: number; DELETED: number };
}) {
  const total = plans.FREE + plans.PRO + plans.ENTERPRISE;
  const segments = [
    { label: "ENTERPRISE", value: plans.ENTERPRISE, color: "#ca8a04" }, // brand-500
    { label: "PRO", value: plans.PRO, color: "#facc15" }, // brand-300
    { label: "FREE", value: plans.FREE, color: "#fde68a" }, // amber-200
  ];

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">
        Plans
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Active tenant breakdown
      </p>

      <div className="flex items-center justify-center mb-5">
        <Donut size={160} thickness={18} segments={segments} total={total}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Total
          </p>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {total}
          </p>
        </Donut>
      </div>

      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {s.label}
              </span>
            </div>
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              {s.value}
              <span className="ml-1 text-gray-400 font-medium">
                ({total ? Math.round((s.value / total) * 100) : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/70">
              Active
            </p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {statuses.ACTIVE}
            </p>
          </div>
          <div className="rounded-xl bg-amber-50/60 dark:bg-amber-500/5 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70 dark:text-amber-400/70">
              Suspended
            </p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
              {statuses.SUSPENDED}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pure-SVG donut chart ────────────────────────────────────────────────────
function Donut({
  size,
  thickness,
  segments,
  total,
  children,
}: {
  size: number;
  thickness: number;
  segments: { label: string; value: number; color: string }[];
  total: number;
  children?: React.ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        {total > 0 &&
          segments.map((s) => {
            const length = (s.value / total) * circumference;
            const segment = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += length;
            return segment;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

// ── Recent tenants ──────────────────────────────────────────────────────────
function RecentTenants({
  tenants,
  className = "",
}: {
  tenants: RecentTenant[];
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02] ${className}`}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Recently provisioned
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Latest tenants onboarded
          </p>
        </div>
        <Link
          href="/superadmin/tenants/new"
          className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </Link>
      </div>
      {tenants.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-5 h-5" />}
          title="Quiet so far"
          description="No tenants have been provisioned yet."
        />
      ) : (
        <ul className="space-y-1">
          {tenants.map((t) => (
            <li key={t.id}>
              <Link
                href={`/superadmin/tenants/${t.id}`}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-bold text-sm">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                      {t.name}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                      {t.slug}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="font-semibold">{t.plan}</span> · {timeAgo(t.createdAt)}
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-yellow-500 transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── System health ───────────────────────────────────────────────────────────
function SystemHealth() {
  const services: Array<{
    name: string;
    Icon: React.ComponentType<{ className?: string }>;
    status: "ok" | "warn" | "down";
    note?: string;
  }> = [
    { name: "Database", Icon: Database, status: "ok" },
    { name: "API", Icon: Activity, status: "ok" },
    { name: "Auth", Icon: ShieldCheck, status: "ok" },
    {
      name: "Email provider",
      Icon: Mail,
      status: "warn",
      note: "Console fallback (dev)",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">
        System health
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Core services status
      </p>
      <ul className="space-y-2.5">
        {services.map((s) => {
          const tone =
            s.status === "ok"
              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              : s.status === "warn"
                ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400";
          return (
            <li key={s.name} className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-xl ${tone}`}
              >
                <s.Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {s.name}
                </p>
                {s.note && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {s.note}
                  </p>
                )}
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  s.status === "ok"
                    ? "bg-emerald-500"
                    : s.status === "warn"
                      ? "bg-amber-500"
                      : "bg-red-500"
                } ${s.status === "ok" ? "animate-pulse" : ""}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────
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
    <div className="text-center py-8">
      <div className="mx-auto w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {description}
      </p>
    </div>
  );
}
