"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { vehicleAPI, driverAPI, notificationAPI } from "@/lib/api";
import { formatINRCompact, formatINRFull } from "@/lib/currency";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardSkeleton, ChartSkeleton } from "@/components/ui/Skeleton";
import DatePicker from "@/components/ui/DatePicker";
import { Plus, UserPlus, Truck, Users, AlertTriangle, CheckCircle2, ChevronRight, FileText, BarChart3, PieChart as PieIcon, Disc3, RefreshCw, type LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiAudi, SiBmw, SiFord, SiHonda, SiHyundai, SiKia, SiMahindra,
  SiMaserati, SiMg, SiNissan, SiSuzuki, SiTata, SiTesla, SiToyota,
  SiVolkswagen, SiVolvo,
} from "react-icons/si";

// Two dynamic handles for the same module so each chart slot shows a shimmer
// shaped like its eventual chart while the ~200KB ApexCharts chunk loads.
// Without this, the slot stayed blank for several seconds after the API
// resolved — the exact gap users were seeing on first dashboard paint.
const BarApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <ChartSkeleton variant="bar" height={280} />,
});
const DonutApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <ChartSkeleton variant="donut" height={260} />,
});

interface DashboardStats {
  totalVehicles: number;
  compliance: { green: number; yellow: number; orange: number; red: number };
  byBrand: Array<{ brand: string | null; count: number }>;
  tyreBrandPerformance: Array<{
    brand: string;
    avgKm: number;
    replacements: number;
    vehicles: number;
  }>;
  challans: {
    total: number;
    pending: { count: number; amount: number };
    paid: { count: number; amount: number };
  };
}

interface DriverStats {
  totalDrivers: number;
  license: { green: number; yellow: number; orange: number; red: number };
  documents: { green: number; yellow: number; orange: number; red: number };
}

interface ExpenseReport {
  summary: { totalSpent: number; breakdown: Record<string, number> };
  timeline: Array<{ period: string; [key: string]: string | number }>;
}

// Same palette/labels the Expenses page uses — kept here so the dashboard
// chart matches the source-of-truth report card.
const CATEGORY_LABELS: Record<string, string> = {
  challans: "Challans",
  services: "Services",
  fastag: "FASTag",
  compliance: "Compliance",
  emi: "EMI",
  invoices: "Invoices",
};
const CATEGORY_COLORS_HEX: Record<string, string> = {
  challans: "#ef4444",
  services: "#3b82f6",
  fastag: "#f59e0b",
  compliance: "#10b981",
  emi: "#a855f7",
  invoices: "#06b6d4",
};

// Auto-refresh cadence — dashboard re-pulls every minute in the background.
// On tab focus we always refetch immediately, so the user never sees stale
// data when they come back from another tab where they changed something.
const REFRESH_INTERVAL_MS = 60_000;

// Date helpers for the expense-range filter.
const ymd = (d: Date) => d.toISOString().split("T")[0];
const startOfYear = () => ymd(new Date(new Date().getFullYear(), 0, 1));
const today = () => ymd(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

// Returns null when the range is valid, otherwise a user-facing error string.
// Caller binds this to both onChange and to the Apply gate so the same rules
// drive the inline hint AND the disabled state.
function validateDateRange(from: string, to: string): string | null {
  if (!from) return "Select a 'From' date";
  if (!to) return "Select a 'To' date";
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime())) return "'From' date is not a valid date";
  if (Number.isNaN(toDate.getTime())) return "'To' date is not a valid date";
  if (fromDate > toDate) return "'From' date must be on or before 'To' date";
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (toDate > endOfToday) return "'To' date can't be in the future";
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (fromDate < fiveYearsAgo) return "'From' date can't be more than 5 years ago";
  return null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStats | null>(null);
  const [expenseReport, setExpenseReport] = useState<ExpenseReport | null>(null);
  // const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Expense-range filter. Defaults to YTD (same as the previous hardcoded
  // behaviour). `applied` is what's actually being shown; `dateFrom`/`dateTo`
  // are the editing values — they only become "applied" after validation.
  const [dateFrom, setDateFrom] = useState(startOfYear());
  const [dateTo, setDateTo] = useState(today());
  const [appliedRange, setAppliedRange] = useState({
    from: startOfYear(),
    to: today(),
  });
  const dateError = validateDateRange(dateFrom, dateTo);
  // Guard so background ticks can't pile up if a fetch is already in flight.
  const inFlight = useRef(false);
  // Background poll reads dates via a ref so changing the filter doesn't
  // churn the interval/visibility effect.
  const appliedRangeRef = useRef(appliedRange);
  useEffect(() => {
    appliedRangeRef.current = appliedRange;
  }, [appliedRange]);

  const fetchAll = useCallback(async (mode: "initial" | "background") => {
    if (inFlight.current && mode === "background") return;
    inFlight.current = true;
    if (mode === "background") setRefreshing(true);
    const { from, to } = appliedRangeRef.current;
    try {
      const [s, ds, , er] = await Promise.all([
        vehicleAPI.getStats().then((r) => r.data.data),
        driverAPI.getStats().then((r) => r.data.data).catch(() => null),
        notificationAPI.getUnreadCount().then((r) => r.data.data.count).catch(() => 0),
        vehicleAPI.getExpenseReport({ from, to }).then((r) => r.data.data).catch(() => null),
      ]);
      setStats(s);
      setDriverStats(ds);
      setExpenseReport(er);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      inFlight.current = false;
      if (mode === "initial") setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  // Re-fetch only the expense report when the user applies a new range. KPI
  // tiles aren't date-scoped so we don't waste a round-trip on them.
  const applyDateRange = useCallback(async () => {
    const err = validateDateRange(dateFrom, dateTo);
    if (err) return;
    if (dateFrom === appliedRange.from && dateTo === appliedRange.to) return;
    setAppliedRange({ from: dateFrom, to: dateTo });
    setRefreshing(true);
    try {
      const er = await vehicleAPI
        .getExpenseReport({ from: dateFrom, to: dateTo })
        .then((r) => r.data.data)
        .catch(() => null);
      setExpenseReport(er);
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, appliedRange]);

  const setPreset = useCallback(
    (from: string, to: string) => {
      setDateFrom(from);
      setDateTo(to);
      // Apply presets immediately — they're known-valid so no confirmation.
      if (from === appliedRange.from && to === appliedRange.to) return;
      setAppliedRange({ from, to });
      setRefreshing(true);
      void vehicleAPI
        .getExpenseReport({ from, to })
        .then((r) => r.data.data)
        .catch(() => null)
        .then((er) => {
          setExpenseReport(er);
          setLastUpdated(new Date());
        })
        .finally(() => setRefreshing(false));
    },
    [appliedRange],
  );

  const rangeChanged =
    dateFrom !== appliedRange.from || dateTo !== appliedRange.to;

  useEffect(() => {
    void fetchAll("initial");

    // Background poll. Skip when the tab is hidden so we don't burn API
    // budget on backgrounded windows — visibilitychange covers waking up.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchAll("background");
      }
    }, REFRESH_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchAll("background");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchAll]);

  if (loading) return <DashboardSkeleton />;

  const vc = stats?.compliance || { green: 0, yellow: 0, orange: 0, red: 0 };
  const totalVDocs = vc.green + vc.yellow + vc.orange + vc.red;
  const vcPct = totalVDocs > 0 ? Math.round((vc.green / totalVDocs) * 100) : 0;

  const dl = driverStats?.license || { green: 0, yellow: 0, orange: 0, red: 0 };
  const dd = driverStats?.documents || { green: 0, yellow: 0, orange: 0, red: 0 };
  // Treat license as just another driver document — merge for the dashboard view.
  const dAll = {
    green: dl.green + dd.green,
    yellow: dl.yellow + dd.yellow,
    orange: dl.orange + dd.orange,
    red: dl.red + dd.red,
  };
  const totalDAll = dAll.green + dAll.yellow + dAll.orange + dAll.red;
  const dlPct = totalDAll > 0 ? Math.round((dAll.green / totalDAll) * 100) : 0;

  // Pre-compute health hints so tiles can show one extra useful number.
  const vehiclesOk = vc.green;
  const vehiclesIssues = vc.yellow + vc.orange + vc.red;
  const driversOk = dAll.green;
  const driversIssues = dAll.yellow + dAll.orange + dAll.red;

  return (
    <div className="space-y-4">
      {/* ── HEADER ROW ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 flex items-center gap-1.5">
            Fleet compliance overview at a glance
            {lastUpdated && (
              <span className="hidden sm:inline text-gray-400 dark:text-gray-500">
                · Updated <LastUpdated at={lastUpdated} />
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void fetchAll("background")}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
          <Link href="/vehicles/onboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2 text-xs font-bold text-white shadow shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all">
            <Plus className="w-3.5 h-3.5" />
            Onboard Vehicle
          </Link>
          <Link href="/drivers/add"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 transition-all">
            <UserPlus className="w-3.5 h-3.5" />
            Add Driver
          </Link>
        </div>
      </div>

      {/* ── COMPACT STAT CHIPS ── */}
      <div className="grid grid-cols-1 2xsm:grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatChip
          Icon={Truck}
          label="Vehicles"
          value={`${stats?.totalVehicles || 0}`}
          sub={totalVDocs > 0 ? `${vehiclesOk} valid · ${vehiclesIssues} issue${vehiclesIssues === 1 ? "" : "s"}` : undefined}
          href="/vehicles"
          tint="brand"
        />
        <StatChip
          Icon={Users}
          label="Drivers"
          value={`${driverStats?.totalDrivers || 0}`}
          sub={totalDAll > 0 ? `${driversOk} valid · ${driversIssues} issue${driversIssues === 1 ? "" : "s"}` : undefined}
          href="/drivers"
          tint="indigo"
        />
        <StatChip
          Icon={AlertTriangle}
          label="Pending Challans"
          value={`₹${(stats?.challans?.pending?.amount || 0).toLocaleString("en-IN")}`}
          sub={`${stats?.challans?.pending?.count || 0} open`}
          href="/challans"
          tint="red"
        />
        <StatChip
          Icon={CheckCircle2}
          label="Paid Challans"
          value={`₹${(stats?.challans?.paid?.amount || 0).toLocaleString("en-IN")}`}
          sub={`${stats?.challans?.paid?.count || 0} of ${stats?.challans?.total || 0}`}
          tint="emerald"
        />
      </div>

      {/* ── COMPLIANCE SECTIONS ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Vehicle Compliance */}
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">Vehicle Compliance</h3>
                <p className="text-white/80 text-[10px]">{totalVDocs} docs · {stats?.totalVehicles || 0} vehicles</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-white leading-none">{vcPct}%</p>
              <p className="text-[9px] text-white/70 uppercase tracking-wider font-bold mt-0.5">Compliant</p>
            </div>
          </div>

          <div className="p-4">
            <ComplianceSection
              icon={<FileText className="w-3 h-3" />}
              title="Document Status"
              counts={vc}
              total={totalVDocs}
              basePath="/compliance"
            />

            <Link href="/compliance" className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              View Vehicle Compliance
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Driver Compliance */}
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">Driver Compliance</h3>
                <p className="text-white/80 text-[10px]">{totalDAll} docs · {driverStats?.totalDrivers || 0} drivers</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-white leading-none">{dlPct}%</p>
              <p className="text-[9px] text-white/70 uppercase tracking-wider font-bold mt-0.5">Compliant</p>
            </div>
          </div>

          <div className="p-4">
            <ComplianceSection
              icon={<FileText className="w-3 h-3" />}
              title="Document Status"
              counts={dAll}
              total={totalDAll}
              basePath="/drivers/compliance"
            />

            <Link href="/drivers/compliance" className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              View Driver Compliance
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── EXPENSE RANGE FILTER ── */}
      <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-2.5">
            {/* Flatpickr-backed pickers — match the calendar UX used on the
                Vehicles → Expenses filter so users get the same picker app-wide.
                Native <input type="date"> gave inconsistent UI across browsers.
                Fixed wrapper width sits just wide enough for "DD Mmm YYYY" +
                the icon so the text and icon stay visually close (the input
                inside is w-full and would otherwise stretch). */}
            <div className="flex flex-col gap-1 w-[170px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">From</span>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                maxDate={dateTo || today()}
                placeholder="Pick a date"
              />
            </div>
            <div className="flex flex-col gap-1 w-[170px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">To</span>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                minDate={dateFrom}
                maxDate={today()}
                placeholder="Pick a date"
              />
            </div>
            <button
              type="button"
              onClick={() => void applyDateRange()}
              disabled={Boolean(dateError) || !rangeChanged || refreshing}
              className="h-11 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 text-sm font-bold text-white shadow shadow-yellow-500/20 hover:shadow-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              Apply
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Last 30d", from: daysAgo(30), to: today() },
              { label: "Last 90d", from: daysAgo(90), to: today() },
              { label: "YTD", from: startOfYear(), to: today() },
              { label: "Last 12m", from: daysAgo(365), to: today() },
            ].map((p) => {
              const active = appliedRange.from === p.from && appliedRange.to === p.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPreset(p.from, p.to)}
                  className={`h-7 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        {dateError && (
          <p
            id="date-range-error"
            role="alert"
            className="mt-2 text-[11px] text-red-500 dark:text-red-400"
          >
            {dateError}
          </p>
        )}
      </div>

      {/* ── EXPENSE CHARTS (moved from /vehicles/expenses) ── */}
      {expenseReport && (() => {
        const activeCategories = Object.entries(expenseReport.summary.breakdown).filter(
          ([, v]) => (v as number) > 0,
        );
        if (activeCategories.length === 0) return null;
        const barCategories = expenseReport.timeline.map((t) =>
          new Date(String(t.period) + "-01").toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          }),
        );
        const barSeries = activeCategories.map(([key]) => ({
          name: CATEGORY_LABELS[key] || key,
          data: expenseReport.timeline.map((t) =>
            typeof t[key] === "number" ? (t[key] as number) : 0,
          ),
          color: CATEGORY_COLORS_HEX[key] || "#6b7280",
        }));
        const donutSeries = activeCategories.map(([, v]) => v as number);
        const donutLabels = activeCategories.map(
          ([k]) => CATEGORY_LABELS[k] || k,
        );
        const donutColors = activeCategories.map(
          ([k]) => CATEGORY_COLORS_HEX[k] || "#6b7280",
        );
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar Chart */}
            <div className="lg:col-span-2 rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4">
              <h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-white" />
                </span>
                Monthly Expense Trend
              </h3>
              <BarApexChart
                type="bar"
                height={280}
                options={{
                  chart: {
                    stacked: true,
                    toolbar: { show: false },
                    fontFamily: "inherit",
                    background: "transparent",
                  },
                  xaxis: {
                    categories: barCategories,
                    labels: { style: { fontSize: "10px" } },
                  },
                  yaxis: {
                    labels: {
                      formatter: (v: number) => formatINRCompact(v),
                      style: { fontSize: "10px" },
                    },
                  },
                  plotOptions: { bar: { borderRadius: 6, columnWidth: "50%" } },
                  legend: { position: "top", fontSize: "11px", fontWeight: 600 },
                  tooltip: {
                    y: {
                      formatter: (v: number) => formatINRFull(v),
                    },
                    theme: "light",
                  },
                  grid: { borderColor: "#e5e7eb30", strokeDashArray: 4 },
                  dataLabels: { enabled: false },
                }}
                series={barSeries}
              />
            </div>

            {/* Donut Chart */}
            <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] p-4">
              <h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <PieIcon className="w-3 h-3 text-white" />
                </span>
                Category Split
              </h3>
              <DonutApexChart
                type="donut"
                height={260}
                options={{
                  labels: donutLabels,
                  colors: donutColors,
                  legend: {
                    position: "bottom",
                    fontSize: "11px",
                    fontWeight: 600,
                  },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: "68%",
                        labels: {
                          show: true,
                          total: {
                            show: true,
                            label: "Total",
                            fontSize: "11px",
                            fontWeight: "700",
                            formatter: () =>
                              formatINRCompact(expenseReport.summary.totalSpent),
                          },
                        },
                      },
                    },
                  },
                  tooltip: {
                    y: {
                      formatter: (v: number) => formatINRFull(v),
                    },
                  },
                  dataLabels: { enabled: false },
                  stroke: { width: 3, colors: ["#fff"] },
                }}
                series={donutSeries}
              />
            </div>
          </div>
        );
      })()}

      {/* ── BOTTOM ROW: Fleet by Brand (half) + placeholder for future section (half) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fleet by Brand */}
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Truck className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Fleet by Brand</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Tap a brand to filter the vehicles list
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Brands</p>
              <p className="text-sm font-black text-gray-900 dark:text-white leading-none mt-0.5">
                {stats?.byBrand?.filter((b) => b.brand).length ?? 0}
              </p>
            </div>
          </div>

          <div className="p-3">
            {!stats?.byBrand || stats.byBrand.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No brand data yet. Set the <span className="font-semibold text-gray-700 dark:text-gray-200">Brand</span> field on a vehicle to see counts here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {stats.byBrand.map(({ brand, count }) => (
                  <BrandCard key={brand ?? "__unbranded"} brand={brand} count={count} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tyre Brand Performance — which tyre brand gives the most km */}
        <div className="rounded-xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Disc3 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Tyre Brand Performance</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Avg km per change, ranked highest first
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Brands</p>
              <p className="text-sm font-black text-gray-900 dark:text-white leading-none mt-0.5">
                {stats?.tyreBrandPerformance?.length ?? 0}
              </p>
            </div>
          </div>

          <div className="p-3">
            {!stats?.tyreBrandPerformance || stats.tyreBrandPerformance.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No tyre run-length data yet. Log at least two tyre changes on a vehicle to see brand performance.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.tyreBrandPerformance.map((t, i) => {
                  const isBest = i === 0;
                  return (
                    <li key={t.brand} className="flex items-center gap-3 py-2.5">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs font-black ${isBest ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{t.brand}</p>
                          {isBest && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                              Best
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {t.replacements} change{t.replacements === 1 ? "" : "s"} · {t.vehicles} vehicle{t.vehicles === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums leading-none">
                          {t.avgKm.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] uppercase tracking-wider font-bold text-gray-400 mt-0.5">km avg</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      {/*<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { href: "/vehicles", Icon: Truck, label: "All Vehicles", color: "from-yellow-400 to-yellow-500", shadow: "shadow-yellow-500/20" },
          { href: "/drivers", Icon: Users, label: "All Drivers", color: "from-blue-400 to-blue-500", shadow: "shadow-blue-500/20" },
          { href: "/compliance", Icon: ShieldCheck, label: "Vehicle Docs", color: "from-emerald-400 to-emerald-500", shadow: "shadow-emerald-500/20" },
          { href: "/drivers/compliance", Icon: CreditCard, label: "Driver Docs", color: "from-purple-400 to-purple-500", shadow: "shadow-purple-500/20" },
          { href: "/challans", Icon: AlertTriangle, label: "Challans", color: "from-red-400 to-red-500", shadow: "shadow-red-500/20" },
          { href: "/fleet-alerts", Icon: Bell, label: "Alerts", color: "from-orange-400 to-orange-500", shadow: "shadow-orange-500/20", badge: unreadNotifs > 0 ? unreadNotifs : undefined },
        ] as Array<{ href: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }>; label: string; color: string; shadow: string; badge?: number }>).map((item) => (
          <Link key={item.href} href={item.href}
            className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none hover:-translate-y-0.5 transition-all duration-300">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg ${item.shadow} group-hover:scale-110 transition-transform duration-300`}>
              <item.Icon className="w-5.5 h-5.5 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 text-center">{item.label}</span>
            {item.badge && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-red-500/30">{item.badge}</span>
            )}
          </Link>
        ))}
      </div>*/}
    </div>
  );
}

/* ── Sub-components ── */

// All-gray palette — subtle variation across neutral families for tone-on-tone interest.
const BRAND_PALETTE = [
  { avatar: "bg-gray-100 dark:bg-gray-800/60", icon: "text-gray-700 dark:text-gray-200" },
  { avatar: "bg-slate-100 dark:bg-slate-800/60", icon: "text-slate-700 dark:text-slate-200" },
  { avatar: "bg-zinc-100 dark:bg-zinc-800/60", icon: "text-zinc-700 dark:text-zinc-200" },
  { avatar: "bg-stone-100 dark:bg-stone-800/60", icon: "text-stone-700 dark:text-stone-200" },
  { avatar: "bg-neutral-100 dark:bg-neutral-800/60", icon: "text-neutral-700 dark:text-neutral-200" },
];

function brandColor(brand: string) {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  return BRAND_PALETTE[Math.abs(hash) % BRAND_PALETTE.length];
}

// Brand → icon map. Key is lowercase brand name (with typo-aliases). Brands
// without an entry fall back to the colored letter avatar.
const BRAND_ICONS: Record<string, IconType> = {
  audi: SiAudi,
  bmw: SiBmw,
  ford: SiFord,
  honda: SiHonda,
  hyundai: SiHyundai,
  kia: SiKia,
  mahindra: SiMahindra,
  maserati: SiMaserati,
  mg: SiMg,
  nissan: SiNissan,
  suzuki: SiSuzuki,
  tata: SiTata,
  tesla: SiTesla,
  toyota: SiToyota,
  volkswagen: SiVolkswagen,
  vw: SiVolkswagen,
  volvo: SiVolvo,
  volovo: SiVolvo, // common typo
};

function BrandCard({ brand, count }: { brand: string | null; count: number }) {
  const isUnbranded = !brand;
  const label = brand ?? "Unbranded";
  const palette = isUnbranded
    ? { avatar: "bg-gray-100 dark:bg-gray-800", icon: "text-gray-400 dark:text-gray-500" }
    : brandColor(label);
  const Icon = isUnbranded ? null : BRAND_ICONS[label.toLowerCase()] ?? null;
  // `__none__` is the sentinel the vehicles list / repo recognises for
  // "vehicles with no brand on file". A bare `/vehicles` link is wrong
  // because it shows every vehicle, not just the unbranded ones.
  const href = isUnbranded
    ? "/vehicles?brand=__none__"
    : `/vehicles?brand=${encodeURIComponent(label)}`;

  return (
    <Link
      href={href}
      title={`${label} — ${count} vehicle${count === 1 ? "" : "s"}`}
      className="group flex flex-col items-center text-center rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-3 transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm"
    >
      <div className={`flex-shrink-0 w-14 h-14 rounded-xl ${palette.avatar} flex items-center justify-center`}>
        {Icon ? (
          <Icon className={`w-9 h-9 ${palette.icon}`} />
        ) : (
          <span className={`text-2xl font-black ${palette.icon}`}>{label.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <p className={`mt-2 w-full text-xs font-semibold truncate ${isUnbranded ? "italic text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100"}`}>
        {label}
      </p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
        {count} vehicle{count === 1 ? "" : "s"}
      </p>
    </Link>
  );
}


function StatChip({
  Icon,
  label,
  value,
  sub,
  href,
  tint,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tint: "brand" | "indigo" | "red" | "emerald";
}) {
  const palette = {
    brand: {
      iconBg: "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400",
      value: "text-gray-900 dark:text-white",
      ring: "hover:border-yellow-300 dark:hover:border-yellow-500/30",
    },
    indigo: {
      iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
      value: "text-gray-900 dark:text-white",
      ring: "hover:border-indigo-300 dark:hover:border-indigo-500/30",
    },
    red: {
      iconBg: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
      value: "text-red-600 dark:text-red-400",
      ring: "hover:border-red-300 dark:hover:border-red-500/30",
    },
    emerald: {
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      value: "text-emerald-600 dark:text-emerald-400",
      ring: "hover:border-emerald-300 dark:hover:border-emerald-500/30",
    },
  }[tint];

  const content = (
    <div className={`rounded-xl border border-gray-200/80 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.02] transition-all ${palette.ring} ${href ? "cursor-pointer hover:shadow-md" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${palette.iconBg}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 truncate">
          {label}
        </span>
      </div>
      <p className={`text-xl font-black leading-none ${palette.value}`}>{value}</p>
      {sub && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">{sub}</p>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">{content}</Link>
  ) : (
    content
  );
}

type ComplianceCounts = { green: number; yellow: number; orange: number; red: number };

function ComplianceSection({
  icon,
  title,
  counts,
  total,
  basePath,
}: {
  icon: React.ReactNode;
  title: string;
  counts: ComplianceCounts;
  total: number;
  basePath?: string;
}) {
  // Donut geometry: standard SVG technique using strokeDasharray. Radius 40
  // on a 100×100 viewBox; circumference = 2πr ≈ 251.327. We rotate the
  // <svg> by -90deg so segments start at 12 o'clock.
  const RADIUS = 40;
  const CIRC = 2 * Math.PI * RADIUS;
  const segments = [
    { key: "GREEN" as const, label: "Valid", sublabel: "> 30 days", count: counts.green, color: "#10b981" },
    { key: "YELLOW" as const, label: "Upcoming Expiry", sublabel: "≤ 30 days", count: counts.yellow, color: "#f59e0b" },
    { key: "ORANGE" as const, label: "Critical", sublabel: "≤ 7 days", count: counts.orange, color: "#d97706", blink: true },
    { key: "RED" as const, label: "Expired", sublabel: "≤ 0 days", count: counts.red, color: "#ef4444" },
  ];
  let cumulative = 0;
  const drawn = segments.map((s) => {
    const portion = total > 0 ? s.count / total : 0;
    const dash = portion * CIRC;
    const offset = -cumulative * CIRC;
    cumulative += portion;
    return { ...s, dash, offset, portion };
  });
  const tileHref = (status: "GREEN" | "YELLOW" | "ORANGE" | "RED") => {
    if (!basePath) return undefined;
    // Vehicle compliance moved its valid (GREEN) bucket to a dedicated page;
    // driver compliance still shows valid inline, so only redirect when the
    // vehicle base path is active.
    if (status === "GREEN" && basePath === "/compliance") return "/compliance/valid";
    return `${basePath}?status=${status}`;
  };

  const router = useRouter();
  const [hoveredKey, setHoveredKey] = useState<typeof segments[number]["key"] | null>(null);
  const hovered = hoveredKey ? drawn.find((d) => d.key === hoveredKey) : null;
  const hoveredPct = hovered ? Math.round(hovered.portion * 100) : 0;

  return (
    <div>
      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h4>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Donut */}
        <div className="relative w-36 h-36 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
              className="dark:opacity-20"
            />
            {total > 0 &&
              drawn
                .filter((d) => d.count > 0)
                .map((d) => {
                  const isHover = hoveredKey === d.key;
                  const href = tileHref(d.key);
                  return (
                    <circle
                      key={d.key}
                      cx="50"
                      cy="50"
                      r={RADIUS}
                      fill="none"
                      stroke={d.color}
                      strokeWidth={isHover ? 14 : 12}
                      strokeDasharray={`${d.dash} ${CIRC - d.dash}`}
                      strokeDashoffset={d.offset}
                      onMouseEnter={() => setHoveredKey(d.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => { if (href) router.push(href); }}
                      className={`cursor-pointer transition-[stroke-width] duration-150 ${d.blink ? "animate-blink" : ""}`}
                      style={{ opacity: hoveredKey && !isHover ? 0.45 : 1 }}
                    >
                      <title>{`${d.label}: ${d.count} — click to open`}</title>
                    </circle>
                  );
                })}
          </svg>
          {/* Center label — swaps to hovered segment info on hover */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            {hovered ? (
              <>
                <span
                  className="text-[9px] uppercase tracking-wider font-bold leading-tight"
                  style={{ color: hovered.color }}
                >
                  {hovered.label}
                </span>
                <span className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">
                  {hovered.count}
                </span>
                <span className="text-[9px] text-gray-400 mt-0.5">{hoveredPct}%</span>
              </>
            ) : (
              <>
                <span className="text-[9px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">Total</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">{total}</span>
              </>
            )}
          </div>
        </div>

        {/* Legend — clickable rows that deep-link into the compliance page.
            Hovering a legend row also drives the donut highlight. */}
        <div className="flex-1 w-full grid grid-cols-1 2xsm:grid-cols-2 gap-1.5">
          {segments.map((s) => {
            const href = tileHref(s.key);
            const row = (
              <div
                onMouseEnter={() => setHoveredKey(s.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${hoveredKey === s.key ? "bg-gray-100 dark:bg-gray-800/60" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.blink ? "animate-blink" : ""}`}
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 leading-tight truncate">{s.label}</p>
                    <p className="text-[9px] text-gray-400 leading-tight">{s.sublabel}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-gray-900 dark:text-white flex-shrink-0">{s.count}</span>
              </div>
            );
            return href ? (
              <Link key={s.key} href={href} className="block">{row}</Link>
            ) : (
              <div key={s.key}>{row}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Renders "just now" / "12s ago" / "3m ago" and re-renders itself every 15s
// so the label stays current without re-running the whole dashboard tree.
function LastUpdated({ at }: { at: Date }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const diffSec = Math.max(0, Math.floor((Date.now() - at.getTime()) / 1000));
  const label =
    diffSec < 5
      ? "just now"
      : diffSec < 60
        ? `${diffSec}s ago`
        : diffSec < 3600
          ? `${Math.floor(diffSec / 60)}m ago`
          : `${Math.floor(diffSec / 3600)}h ago`;
  return <span>{label}</span>;
}
