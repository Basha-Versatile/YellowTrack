"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { emiAPI, vehicleAPI, debitAccountAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { VehicleAutocomplete } from "@/components/vehicles/VehicleAutocomplete";
import {
  Plus,
  Wallet,
  CalendarClock,
  CheckCircle2,
  Pause,
  Ban,
  Building2,
  CreditCard,
  IndianRupee,
  Calendar,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  X,
  FileSpreadsheet,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

type VehicleBasic = {
  id: string;
  registrationNumber: string;
  ownerName?: string | null;
  make: string;
  model: string;
};

type EmiPlanRow = {
  id: string;
  vehicleId: string;
  lenderName: string;
  lenderType: "BANK" | "NBFC" | "PARTNER";
  debitBankName: string | null;
  debitAccountMasked: string | null;
  principalAmount: number | null;
  emiAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  startDate: string;
  endDate: string;
  dueDayOfMonth: number;
  status: "ACTIVE" | "PAUSED" | "DEFAULTED" | "CLOSED";
  nextDueDate: string | null;
  vehicle: {
    id: string;
    registrationNumber: string;
    ownerName?: string | null;
    make: string;
    model: string;
  } | null;
};

type HubResponse = {
  rows: EmiPlanRow[];
  summary: {
    active: number;
    paused: number;
    defaulted: number;
    closed: number;
    monthlyOutflow: number;
    duesThisWeek: number;
    defaulters: number;
  };
};

type FilterKey = "all" | "due7" | "due30" | "overdue" | "closed";

const STATUS_TINT: Record<EmiPlanRow["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  PAUSED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  DEFAULTED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatINR(n: number): string {
  return `₹${(n ?? 0).toLocaleString("en-IN")}`;
}

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function EmiHubPage() {
  const toast = useToast();
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [vehicles, setVehicles] = useState<VehicleBasic[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState<VehicleBasic | null>(null);
  const [openCreatePicker, setOpenCreatePicker] = useState(false);
  const [createPickerSelection, setCreatePickerSelection] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);
  const [emiView, setEmiView] = useState<"list" | "calendar">("calendar");

  // Per-column header filters (sit on top of the chip strip + vehicle dropdown).
  const [colFilters, setColFilters] = useState<{
    vehicle: string;
    lender: string;
    statuses: EmiPlanRow["status"][];
    nextDueFrom: string;
    nextDueTo: string;
  }>({ vehicle: "", lender: "", statuses: [], nextDueFrom: "", nextDueTo: "" });
  const [sortBy, setSortBy] = useState<{ col: "emi" | "outstanding" | "progress" | "nextDue"; dir: "asc" | "desc" } | null>(null);

  // Note: `toast` intentionally excluded from deps — useToast returns a new
  // ref each render and would re-fire this loader on every render.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await emiAPI.getHub();
      setHub(res.data.data as HubResponse);
    } catch {
      toast.error("Failed to load EMI data", "Try refreshing the page");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await vehicleAPI.getAll({ page: 1, limit: 100 });
      setVehicles(res.data.data.vehicles ?? []);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setVehiclesError(
        status === 403
          ? "You don't have permission to view the vehicle list."
          : "Could not load vehicles. Try again.",
      );
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
    load();
  }, [load, loadVehicles]);

  const filtered = useMemo(() => {
    if (!hub) return [];
    let rows = hub.rows;

    // Top-level vehicle dropdown + chip strip (unchanged behaviour).
    if (vehicleId) rows = rows.filter((r) => String(r.vehicleId) === vehicleId);
    if (filter === "closed") rows = rows.filter((r) => r.status === "CLOSED");
    else if (filter === "overdue") {
      rows = rows.filter((r) => {
        if (r.status !== "ACTIVE") return false;
        const d = daysUntil(r.nextDueDate);
        return d !== null && d < 0;
      });
    } else if (filter === "due7" || filter === "due30") {
      const horizon = filter === "due7" ? 7 : 30;
      rows = rows.filter((r) => {
        if (r.status !== "ACTIVE") return false;
        const d = daysUntil(r.nextDueDate);
        return d !== null && d >= 0 && d <= horizon;
      });
    }

    // Per-column header filters.
    if (colFilters.vehicle.trim()) {
      const q = colFilters.vehicle.trim().toLowerCase();
      rows = rows.filter((r) =>
        `${r.vehicle?.registrationNumber ?? ""} ${r.vehicle?.ownerName ?? ""} ${r.vehicle?.make ?? ""} ${r.vehicle?.model ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (colFilters.lender.trim()) {
      const q = colFilters.lender.trim().toLowerCase();
      rows = rows.filter((r) =>
        `${r.lenderName} ${r.lenderType} ${r.debitBankName ?? ""} ${r.debitAccountMasked ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (colFilters.statuses.length > 0) {
      rows = rows.filter((r) => colFilters.statuses.includes(r.status));
    }
    if (colFilters.nextDueFrom) {
      const from = new Date(colFilters.nextDueFrom).getTime();
      rows = rows.filter((r) => r.nextDueDate != null && new Date(r.nextDueDate).getTime() >= from);
    }
    if (colFilters.nextDueTo) {
      const to = new Date(colFilters.nextDueTo).getTime() + 24 * 60 * 60 * 1000 - 1;
      rows = rows.filter((r) => r.nextDueDate != null && new Date(r.nextDueDate).getTime() <= to);
    }

    // Sort (single column).
    if (sortBy) {
      const dir = sortBy.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const aPending = Math.max(0, a.totalInstallments - a.paidInstallments);
        const bPending = Math.max(0, b.totalInstallments - b.paidInstallments);
        const aVal =
          sortBy.col === "emi" ? a.emiAmount
          : sortBy.col === "outstanding" ? a.emiAmount * aPending
          : sortBy.col === "progress" ? (a.totalInstallments ? a.paidInstallments / a.totalInstallments : 0)
          : a.nextDueDate ? new Date(a.nextDueDate).getTime() : Number.POSITIVE_INFINITY;
        const bVal =
          sortBy.col === "emi" ? b.emiAmount
          : sortBy.col === "outstanding" ? b.emiAmount * bPending
          : sortBy.col === "progress" ? (b.totalInstallments ? b.paidInstallments / b.totalInstallments : 0)
          : b.nextDueDate ? new Date(b.nextDueDate).getTime() : Number.POSITIVE_INFINITY;
        return (aVal - bVal) * dir;
      });
    }

    return rows;
  }, [hub, filter, vehicleId, colFilters, sortBy]);

  // Aggregate outstanding + pending count across all ACTIVE plans.
  const hubTotals = useMemo(() => {
    if (!hub) return { outstanding: 0, pendingCount: 0 };
    return hub.rows.reduce(
      (acc, r) => {
        if (r.status !== "ACTIVE") return acc;
        const pending = Math.max(0, r.totalInstallments - r.paidInstallments);
        acc.outstanding += r.emiAmount * pending;
        acc.pendingCount += pending;
        return acc;
      },
      { outstanding: 0, pendingCount: 0 },
    );
  }, [hub]);

  // EMI calendar — group ACTIVE plans by their due day in the viewed month.
  // dueDayOfMonth that exceeds the month's length is clamped to the last day.
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const firstWeekday = new Date(calMonth.year, calMonth.month, 1).getDay();
    const byDay = new Map<number, EmiPlanRow[]>();
    if (hub) {
      for (const r of hub.rows) {
        if (r.status !== "ACTIVE") continue;
        if (vehicleId && String(r.vehicleId) !== vehicleId) continue;
        const day = Math.min(r.dueDayOfMonth, daysInMonth);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(r);
      }
    }
    let monthTotal = 0;
    let monthCount = 0;
    for (const rows of byDay.values()) {
      for (const r of rows) {
        monthTotal += r.emiAmount;
        monthCount += 1;
      }
    }
    return { daysInMonth, firstWeekday, byDay, monthTotal, monthCount };
  }, [hub, calMonth, vehicleId]);

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const stepMonth = (delta: number) => {
    setCalMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setCalSelectedDay(null);
  };
  const goToday = () => {
    const d = new Date();
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
    setCalSelectedDay(null);
  };

  const selectedDayPlans = useMemo(() => {
    if (calSelectedDay == null) return [];
    return calendarData.byDay.get(calSelectedDay) ?? [];
  }, [calSelectedDay, calendarData]);
  const selectedDayTotal = useMemo(
    () => selectedDayPlans.reduce((s, r) => s + r.emiAmount, 0),
    [selectedDayPlans],
  );

  const today = new Date();
  const isTodayInMonth = today.getFullYear() === calMonth.year && today.getMonth() === calMonth.month;

  const openCreate = () => {
    setCreatePickerSelection("");
    setOpenCreatePicker(true);
  };

  const proceedToCreate = () => {
    if (!createPickerSelection) {
      toast.error("Pick a vehicle", "Choose which vehicle this EMI is for");
      return;
    }
    const v = vehicles.find((x) => x.id === createPickerSelection);
    if (!v) return;
    setCreatingFor(v);
    setOpenCreatePicker(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Vehicles under EMI</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Track loan installments and upcoming dues across your fleet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle: Calendar (default) on the left, List on the right.
              The inactive option bounces in a faded-blue tint so users notice
              the alternate view they can switch to. */}
          <div className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => setEmiView("calendar")}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                emiView === "calendar"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "bg-blue-50/70 text-blue-400 hover:bg-blue-100 hover:text-blue-500 dark:bg-blue-500/10 dark:text-blue-300/70 dark:hover:bg-blue-500/15 animate-bounce"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setEmiView("list")}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                emiView === "list"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "bg-blue-50/70 text-blue-400 hover:bg-blue-100 hover:text-blue-500 dark:bg-blue-500/10 dark:text-blue-300/70 dark:hover:bg-blue-500/15 animate-bounce"
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              List
            </button>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2 text-xs font-bold text-white shadow shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New EMI plan
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <KpiCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Active EMIs"
          value={hub?.summary.active ?? 0}
          tint="emerald"
        />
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="Monthly outflow"
          value={formatINR(hub?.summary.monthlyOutflow ?? 0)}
          tint="yellow"
        />
        <KpiCard
          icon={<IndianRupee className="w-4 h-4" />}
          label="Total outstanding"
          value={formatINR(hubTotals.outstanding)}
          tint="amber"
          hint={`${hubTotals.pendingCount} EMI${hubTotals.pendingCount === 1 ? "" : "s"} pending`}
        />
        <KpiCard
          icon={<CalendarClock className="w-4 h-4" />}
          label="Dues this week"
          value={hub?.summary.duesThisWeek ?? 0}
          tint="blue"
        />
      </div>

      {emiView === "list" && (<>
      {/* Filters */}
      <div className="flex items-center flex-wrap gap-2.5 justify-between">
        <div className="flex items-center flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          <FilterChip active={filter === "due7"} onClick={() => setFilter("due7")} label="Due in 7d" />
          <FilterChip active={filter === "due30"} onClick={() => setFilter("due30")} label="Due in 30d" />
          <FilterChip active={filter === "overdue"} onClick={() => setFilter("overdue")} label="Overdue" tone="red" />
          <FilterChip active={filter === "closed"} onClick={() => setFilter("closed")} label="Closed" tone="gray" />
        </div>
        <VehicleAutocomplete
          vehicles={vehicles}
          value={vehicleId}
          onChange={setVehicleId}
          placeholder="All vehicles"
          allLabel="All vehicles"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading EMI plans…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={openCreate} hasAnyPlans={(hub?.rows.length ?? 0) > 0} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50/80 dark:bg-gray-800/50">
                <tr>
                  <FilterableTh label="Vehicle" active={colFilters.vehicle.trim() !== ""}>
                    {(close) => (
                      <TextFilter
                        value={colFilters.vehicle}
                        placeholder="Reg no, owner, make…"
                        onChange={(v) => setColFilters((p) => ({ ...p, vehicle: v }))}
                        onClear={() => setColFilters((p) => ({ ...p, vehicle: "" }))}
                        onClose={close}
                      />
                    )}
                  </FilterableTh>
                  <FilterableTh label="Lender" active={colFilters.lender.trim() !== ""}>
                    {(close) => (
                      <TextFilter
                        value={colFilters.lender}
                        placeholder="Lender, bank, A/c…"
                        onChange={(v) => setColFilters((p) => ({ ...p, lender: v }))}
                        onClear={() => setColFilters((p) => ({ ...p, lender: "" }))}
                        onClose={close}
                      />
                    )}
                  </FilterableTh>
                  <FilterableTh label="EMI / month" align="right" active={sortBy?.col === "emi"}>
                    {(close) => (
                      <SortFilter
                        current={sortBy?.col === "emi" ? sortBy.dir : null}
                        onPick={(dir) => { setSortBy(dir ? { col: "emi", dir } : null); close(); }}
                      />
                    )}
                  </FilterableTh>
                  <FilterableTh label="Outstanding" align="right" active={sortBy?.col === "outstanding"}>
                    {(close) => (
                      <SortFilter
                        current={sortBy?.col === "outstanding" ? sortBy.dir : null}
                        onPick={(dir) => { setSortBy(dir ? { col: "outstanding", dir } : null); close(); }}
                      />
                    )}
                  </FilterableTh>
                  <FilterableTh label="Progress" align="center" active={sortBy?.col === "progress"}>
                    {(close) => (
                      <SortFilter
                        current={sortBy?.col === "progress" ? sortBy.dir : null}
                        onPick={(dir) => { setSortBy(dir ? { col: "progress", dir } : null); close(); }}
                      />
                    )}
                  </FilterableTh>
                  <FilterableTh label="Next due" active={colFilters.nextDueFrom !== "" || colFilters.nextDueTo !== "" || sortBy?.col === "nextDue"}>
                    {(close) => (
                      <DateRangeFilter
                        from={colFilters.nextDueFrom}
                        to={colFilters.nextDueTo}
                        sortDir={sortBy?.col === "nextDue" ? sortBy.dir : null}
                        onChange={(from, to) => setColFilters((p) => ({ ...p, nextDueFrom: from, nextDueTo: to }))}
                        onSort={(dir) => setSortBy(dir ? { col: "nextDue", dir } : null)}
                        onClear={() => {
                          setColFilters((p) => ({ ...p, nextDueFrom: "", nextDueTo: "" }));
                          if (sortBy?.col === "nextDue") setSortBy(null);
                        }}
                        onClose={close}
                      />
                    )}
                  </FilterableTh>
                  <FilterableTh label="Status" align="center" active={colFilters.statuses.length > 0}>
                    {(close) => (
                      <StatusFilter
                        selected={colFilters.statuses}
                        onChange={(statuses) => setColFilters((p) => ({ ...p, statuses }))}
                        onClose={close}
                      />
                    )}
                  </FilterableTh>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                {filtered.map((r, i) => (
                  <Row key={r.id ? String(r.id) : `row-${i}`} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}

      {emiView === "calendar" && (
      <>
      {/* EMI Calendar */}
      <div className="rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">EMI Calendar</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {calendarData.monthCount} EMI{calendarData.monthCount === 1 ? "" : "s"} this month · Total {formatINR(calendarData.monthTotal)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => stepMonth(-1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Previous month">
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="min-w-[150px] text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {MONTH_NAMES[calMonth.month]} {calMonth.year}
              </p>
            </div>
            <button type="button" onClick={() => stepMonth(1)} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Next month">
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button type="button" onClick={goToday} className="ml-1 px-3 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Today
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {WEEKDAY_NAMES.map((d) => (
              <div key={d} className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: calendarData.firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[88px]" />
            ))}
            {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
              const day = i + 1;
              const rows = calendarData.byDay.get(day) ?? [];
              const dayTotal = rows.reduce((s, r) => s + r.emiAmount, 0);
              const isToday = isTodayInMonth && today.getDate() === day;
              const hasEmi = rows.length > 0;
              const visibleRegs = rows.slice(0, 2);
              const remainder = rows.length - visibleRegs.length;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => hasEmi && setCalSelectedDay(day)}
                  disabled={!hasEmi}
                  className={`min-h-[88px] rounded-lg border p-1.5 flex flex-col items-start text-left transition-all ${
                    hasEmi
                      ? "border-yellow-300/70 bg-yellow-50/60 hover:bg-yellow-100 dark:border-yellow-500/30 dark:bg-yellow-500/5 dark:hover:bg-yellow-500/10 cursor-pointer"
                      : "border-gray-100 dark:border-gray-800 cursor-default"
                  } ${isToday ? "ring-2 ring-brand-400" : ""}`}
                >
                  <span className={`text-[11px] font-bold ${isToday ? "text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"}`}>
                    {day}
                  </span>
                  {hasEmi && (
                    <div className="w-full mt-1 space-y-0.5">
                      <p className="text-[10px] font-black text-yellow-700 dark:text-yellow-400 truncate">
                        {formatINR(dayTotal)}
                      </p>
                      {visibleRegs.map((r) => (
                        <p key={r.id} className="text-[9px] font-mono font-semibold text-gray-700 dark:text-gray-300 truncate" title={r.vehicle?.registrationNumber ?? ""}>
                          {r.vehicle?.registrationNumber ?? "—"}
                        </p>
                      ))}
                      {remainder > 0 && (
                        <p className="text-[9px] text-gray-500 dark:text-gray-400 font-semibold">+{remainder} more</p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}

      {/* EMI calendar — day details modal */}
      <Modal
        isOpen={calSelectedDay != null}
        onClose={() => setCalSelectedDay(null)}
        className="w-[92%] max-w-[680px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex flex-col max-h-[85vh]">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                EMIs due on {calSelectedDay} {MONTH_NAMES[calMonth.month]} {calMonth.year}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {selectedDayPlans.length} EMI{selectedDayPlans.length === 1 ? "" : "s"} · Total {formatINR(selectedDayTotal)}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {selectedDayPlans.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No EMIs scheduled for this day.</p>
            ) : (
              selectedDayPlans.map((p) => (
                <Link
                  key={p.id}
                  href={p.vehicle ? `/vehicles/${p.vehicle.id}/emi` : "#"}
                  onClick={() => setCalSelectedDay(null)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-800/30 hover:bg-yellow-50 dark:hover:bg-yellow-500/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                        {p.vehicle?.registrationNumber ?? "—"}
                      </p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${STATUS_TINT[p.status]}`}>{p.status}</span>
                    </div>
                    {p.vehicle?.ownerName && (
                      <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate" title={p.vehicle.ownerName}>{p.vehicle.ownerName}</p>
                    )}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{p.lenderName}</span>
                      <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
                      <span>{p.lenderType}</span>
                      {p.debitBankName && (
                        <>
                          <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
                          <span>{p.debitBankName}{p.debitAccountMasked ? ` ${p.debitAccountMasked}` : ""}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-yellow-700 dark:text-yellow-400">{formatINR(p.emiAmount)}</p>
                    <p className="text-[10px] text-gray-400">
                      {p.paidInstallments}/{p.totalInstallments} paid
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button type="button" onClick={() => setCalSelectedDay(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors">Close</button>
          </div>
        </div>
      </Modal>

      {/* Vehicle picker modal (step 1 of create) */}
      {openCreatePicker && (
        <VehiclePickerModal
          vehicles={vehicles}
          loading={vehiclesLoading}
          error={vehiclesError}
          onRetry={loadVehicles}
          selectedId={createPickerSelection}
          onSelect={setCreatePickerSelection}
          onContinue={proceedToCreate}
          onClose={() => setOpenCreatePicker(false)}
        />
      )}

      {/* Create form modal */}
      {creatingFor && (
        <CreateEmiModal
          vehicle={creatingFor}
          onClose={() => setCreatingFor(null)}
          onCreated={async () => {
            setCreatingFor(null);
            toast.success("EMI plan created", "Schedule generated successfully");
            await load();
          }}
        />
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px] ${className || "text-left"}`}
    >
      {children}
    </th>
  );
}

// Single uniform "Filter" icon on every column. Click opens a popover whose
// contents vary by column type (text search / multi-select / date range / sort).
// `active` highlights the icon when this column is contributing to the filtered
// result so users can see at a glance which columns are narrowing the list.
function FilterableTh({
  label,
  align = "left",
  active,
  children,
}: {
  label: string;
  align?: "left" | "right" | "center";
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th className={`px-5 py-3.5 font-bold text-gray-500 uppercase tracking-wider text-[10px] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}>
      <div ref={wrapRef} className={`relative inline-flex items-center gap-1.5 ${justify}`}>
        <span>{label}</span>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={`inline-flex items-center justify-center w-5 h-5 rounded transition-colors ${active ? "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/15" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          title={`Filter ${label}`}
          aria-label={`Filter ${label}`}
        >
          <Filter className="w-3 h-3" strokeWidth={2.2} />
        </button>
        {open && (
          <div className={`absolute top-full mt-1 z-30 ${align === "right" ? "right-0" : "left-0"} min-w-[220px] rounded-xl border border-gray-200 bg-white shadow-xl p-3 dark:border-gray-700 dark:bg-gray-900`}>
            {children(() => setOpen(false))}
          </div>
        )}
      </div>
    </th>
  );
}

function TextFilter({
  value, placeholder, onChange, onClear, onClose,
}: { value: string; placeholder: string; onChange: (v: string) => void; onClear: () => void; onClose: () => void }) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onClose(); }}
        className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClear} className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">Clear</button>
        <button type="button" onClick={onClose} className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 hover:underline">Done</button>
      </div>
    </div>
  );
}

function SortFilter({
  current, onPick,
}: { current: "asc" | "desc" | null; onPick: (dir: "asc" | "desc" | null) => void }) {
  return (
    <div className="space-y-1">
      <SortRow icon={<ArrowUp className="w-3.5 h-3.5" />} label="Ascending" active={current === "asc"} onClick={() => onPick(current === "asc" ? null : "asc")} />
      <SortRow icon={<ArrowDown className="w-3.5 h-3.5" />} label="Descending" active={current === "desc"} onClick={() => onPick(current === "desc" ? null : "desc")} />
      <SortRow icon={<ArrowUpDown className="w-3.5 h-3.5" />} label="No sort" active={current === null} onClick={() => onPick(null)} />
    </div>
  );
}

function SortRow({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold normal-case transition-colors ${active ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusFilter({
  selected, onChange, onClose,
}: { selected: EmiPlanRow["status"][]; onChange: (s: EmiPlanRow["status"][]) => void; onClose: () => void }) {
  // "DEFAULTED" intentionally excluded from the UI — the workspace doesn't
  // surface defaulters as a public status; rows can still carry that status
  // internally if set elsewhere, they just don't appear in the filter list.
  const ALL: EmiPlanRow["status"][] = ["ACTIVE", "PAUSED", "CLOSED"];
  const toggle = (s: EmiPlanRow["status"]) => {
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  };
  return (
    <div className="space-y-1">
      {ALL.map((s) => {
        const on = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold normal-case transition-colors ${on ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
          >
            <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border ${on ? "border-yellow-500 bg-yellow-500" : "border-gray-300 dark:border-gray-600"}`}>
              {on && <CheckCircle2 className="w-3 h-3 text-white" />}
            </span>
            {s}
          </button>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => onChange([])} className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">Clear</button>
        <button type="button" onClick={onClose} className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 hover:underline">Done</button>
      </div>
    </div>
  );
}

function DateRangeFilter({
  from, to, sortDir, onChange, onSort, onClear, onClose,
}: {
  from: string;
  to: string;
  sortDir: "asc" | "desc" | null;
  onChange: (from: string, to: string) => void;
  onSort: (dir: "asc" | "desc" | null) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-2 min-w-[240px]">
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">From</p>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="w-full h-9 px-2.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">To</p>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="w-full h-9 px-2.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <div className="pt-1 border-t border-gray-100 dark:border-gray-800 space-y-1">
        <SortRow icon={<ArrowUp className="w-3.5 h-3.5" />} label="Earliest first" active={sortDir === "asc"} onClick={() => onSort(sortDir === "asc" ? null : "asc")} />
        <SortRow icon={<ArrowDown className="w-3.5 h-3.5" />} label="Latest first" active={sortDir === "desc"} onClick={() => onSort(sortDir === "desc" ? null : "desc")} />
      </div>
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onClear} className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">Clear</button>
        <button type="button" onClick={onClose} className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 hover:underline">Done</button>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tint,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint: "emerald" | "yellow" | "blue" | "red" | "amber";
  hint?: string;
}) {
  const TINTS: Record<typeof tint, string> = {
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    yellow: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  };
  return (
    <div className="rounded-lg border border-gray-200/80 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${TINTS[tint]} flex-shrink-0`}>
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
          {label}
        </p>
      </div>
      <p className="text-lg font-black text-gray-900 dark:text-white leading-none mt-1">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate">
          {hint}
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tone = "yellow",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "yellow" | "red" | "gray";
}) {
  const activeCls =
    tone === "red"
      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
      : tone === "gray"
        ? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ${
        active
          ? activeCls
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({
  onCreate,
  hasAnyPlans,
}: {
  onCreate: () => void;
  hasAnyPlans: boolean;
}) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-center mb-4">
        <CreditCard className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">
        {hasAnyPlans ? "No matching plans" : "No vehicles under EMI yet"}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
        {hasAnyPlans
          ? "Try a different filter or clear the vehicle selection."
          : "Add an EMI plan to track installments, due dates, and lender details for vehicles under loan."}
      </p>
      {!hasAnyPlans && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2 text-xs font-semibold text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add first EMI plan
        </button>
      )}
    </div>
  );
}

function Row({ row }: { row: EmiPlanRow }) {
  const due = daysUntil(row.nextDueDate);
  const dueChip = (() => {
    if (row.status !== "ACTIVE" || !row.nextDueDate) return "—";
    if (due === null) return "—";
    if (due < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
          Overdue · {-due}d
        </span>
      );
    }
    if (due === 0)
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Due today
        </span>
      );
    const tone = due <= 7 ? "amber" : "gray";
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
          tone === "amber"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        In {due}d
      </span>
    );
  })();

  const pct = row.totalInstallments
    ? Math.round((row.paidInstallments / row.totalInstallments) * 100)
    : 0;

  const pendingCount = Math.max(
    0,
    row.totalInstallments - row.paidInstallments,
  );
  const totalAmount =
    row.principalAmount && row.principalAmount > 0
      ? row.principalAmount
      : row.emiAmount * row.totalInstallments;
  const pendingAmount = row.emiAmount * pendingCount;

  return (
    <tr className="hover:bg-white/50 dark:hover:bg-gray-800/30 transition-colors">
      <td className="px-5 py-3.5">
        {row.vehicle ? (
          <Link
            href={`/vehicles/${row.vehicleId}/emi`}
            className="font-semibold text-gray-900 dark:text-white font-mono text-[11px] hover:text-yellow-700 dark:hover:text-yellow-400"
            title="Open EMI details for this vehicle"
          >
            {row.vehicle.registrationNumber}
          </Link>
        ) : (
          <span className="text-gray-400">—</span>
        )}
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
          {row.vehicle ? `${row.vehicle.make} ${row.vehicle.model}` : ""}
        </div>
        {row.vehicle?.ownerName && (
          <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[160px] mt-0.5" title={row.vehicle.ownerName}>
            {row.vehicle.ownerName}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 font-medium">
          <Building2 className="w-3 h-3 text-gray-400" />
          {row.lenderName}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">
          {row.lenderType}
        </div>
        {(row.debitBankName || row.debitAccountMasked) && (
          <div
            className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[180px]"
            title={[row.debitBankName, row.debitAccountMasked].filter(Boolean).join(" · ")}
          >
            <CreditCard className="w-3 h-3 text-gray-400" />
            {row.debitBankName && <span className="truncate">{row.debitBankName}</span>}
            {row.debitAccountMasked && (
              <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                {row.debitAccountMasked}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5 text-right font-black text-gray-900 dark:text-white whitespace-nowrap">
        {formatINR(row.emiAmount)}
      </td>
      <td className="px-5 py-3.5 text-right whitespace-nowrap">
        <div
          className={`text-sm font-black ${pendingAmount > 0 ? "text-amber-700 dark:text-amber-400" : "text-gray-400"}`}
        >
          {formatINR(pendingAmount)}
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400">
          {pendingCount} of {row.totalInstallments} left · total {formatINR(totalAmount)}
        </div>
      </td>
      <td className="px-5 py-3.5 min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
            {row.paidInstallments}/{row.totalInstallments}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5">{dueChip}</td>
      <td className="px-5 py-3.5 text-center">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${STATUS_TINT[row.status]}`}
        >
          {row.status === "ACTIVE" && <CheckCircle2 className="w-3 h-3" />}
          {row.status === "PAUSED" && <Pause className="w-3 h-3" />}
          {row.status === "DEFAULTED" && <Ban className="w-3 h-3" />}
          {row.status}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link
          href={`/vehicles/${row.vehicleId}#emi`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-700 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Schedule
        </Link>
      </td>
    </tr>
  );
}

// ── Vehicle picker (step 1) ─────────────────────────────────────────────────

function VehiclePickerModal({
  vehicles,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onContinue,
  onClose,
}: {
  vehicles: VehicleBasic[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles.slice(0, 200);
    return vehicles
      .filter((v) =>
        `${v.registrationNumber} ${v.make ?? ""} ${v.model ?? ""}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 200);
  }, [vehicles, query]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">Add EMI plan</h3>
            <p className="text-white/80 text-[11px] mt-0.5">
              Pick the vehicle this EMI applies to.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by registration, make or model…"
            className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/15 dark:border-gray-700 dark:bg-gray-800 dark:text-white placeholder:text-gray-400"
          />

          <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200/70 dark:border-gray-800">
            {loading ? (
              <div className="px-3 py-10 text-center text-xs text-gray-400">
                <span className="inline-block w-4 h-4 mr-2 align-middle rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin" />
                Loading vehicles…
              </div>
            ) : error ? (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-white border border-red-200 text-red-700 text-[11px] font-semibold hover:bg-red-50 dark:bg-transparent dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-10 text-center text-xs text-gray-400">
                {vehicles.length === 0
                  ? "No vehicles in your fleet yet."
                  : `No vehicles match "${query}"`}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100/70 dark:divide-gray-800">
                {filtered.map((v) => {
                  const active = v.id === selectedId;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(v.id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-3 ${
                          active
                            ? "bg-yellow-50 dark:bg-yellow-500/10"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            active ? "bg-yellow-500" : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold text-[12px] text-gray-900 dark:text-white">
                            {v.registrationNumber}
                          </div>
                          {(v.make || v.model) && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              {[v.make, v.model].filter(Boolean).join(" ")}
                            </div>
                          )}
                        </div>
                        {active && (
                          <CheckCircle2 className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            {filtered.length} of {vehicles.length} vehicles
            {filtered.length === 200 ? " · narrow your search to see more" : ""}
          </p>
        </div>
        <div className="flex gap-2.5 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex-shrink-0">
          <button
            onClick={onContinue}
            disabled={!selectedId}
            className="flex-1 h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            Continue
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create modal ────────────────────────────────────────────────────────────

function CreateEmiModal({
  vehicle,
  onClose,
  onCreated,
}: {
  vehicle: VehicleBasic;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    lenderName: "",
    lenderType: "BANK" as "BANK" | "NBFC" | "PARTNER",
    lenderContactPhone: "",
    lenderBranch: "",
    debitBankName: "",
    debitAccountMasked: "",
    debitAccountHolder: "",
    principalAmount: "",
    emiAmount: "",
    totalInstallments: "12",
    startDate: new Date().toISOString().slice(0, 10),
    dueDayOfMonth: "5",
    reminderChannels: ["EMAIL", "IN_APP"] as Array<"EMAIL" | "WHATSAPP" | "IN_APP">,
    notes: "",
  });
  // Schedule documents — one or many PDFs/images of the amortization sheet.
  // Files accumulate as the user picks them; each can be removed individually.
  const [scheduleFiles, setScheduleFiles] = useState<File[]>([]);
  // Saved debit accounts dropdown — fetched once when the modal opens.
  type SavedDebitAccount = {
    id?: string;
    _id?: string;
    bankName: string;
    accountMasked: string;
    accountHolder?: string | null;
  };
  const [savedDebits, setSavedDebits] = useState<SavedDebitAccount[]>([]);
  const [debitMode, setDebitMode] = useState<"saved" | "new">("saved");
  const [selectedDebitId, setSelectedDebitId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    debitAccountAPI
      .list()
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data?.data ?? []) as Array<SavedDebitAccount & { _id?: string }>;
        const normalized = rows.map((row) => ({
          ...row,
          id: String(row.id ?? row._id ?? ""),
        }));
        setSavedDebits(normalized);
        // Default to "saved" when at least one exists; otherwise jump straight
        // to the "new" form so the user isn't staring at an empty dropdown.
        // Also auto-select the most-recently-used account so the user doesn't
        // have to click the dropdown when only one card is on file.
        if (normalized.length > 0) {
          setDebitMode("saved");
          setSelectedDebitId(normalized[0].id ?? "");
        } else {
          setDebitMode("new");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedDebits([]);
          setDebitMode("new");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When the user picks a saved account, mirror its fields into the form so
  // submit (and the auto-upsert on save) still sees a consistent payload.
  useEffect(() => {
    if (debitMode !== "saved") return;
    const found = savedDebits.find((a) => a.id === selectedDebitId);
    if (!found) {
      setForm((p) => ({ ...p, debitBankName: "", debitAccountMasked: "", debitAccountHolder: "" }));
      return;
    }
    setForm((p) => ({
      ...p,
      debitBankName: found.bankName,
      debitAccountMasked: found.accountMasked,
      debitAccountHolder: found.accountHolder ?? "",
    }));
  }, [debitMode, selectedDebitId, savedDebits]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleChannel = (ch: "EMAIL" | "WHATSAPP" | "IN_APP") => {
    setForm((p) => ({
      ...p,
      reminderChannels: p.reminderChannels.includes(ch)
        ? p.reminderChannels.filter((c) => c !== ch)
        : [...p.reminderChannels, ch],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await emiAPI.create(vehicle.id, {
        lenderName: form.lenderName.trim(),
        lenderType: form.lenderType,
        lenderContactPhone: form.lenderContactPhone.trim() || null,
        lenderBranch: form.lenderBranch.trim() || null,
        debitBankName: form.debitBankName.trim() || null,
        debitAccountMasked: form.debitAccountMasked.trim() || null,
        debitAccountHolder: form.debitAccountHolder.trim() || null,
        principalAmount: form.principalAmount ? Number(form.principalAmount) : null,
        emiAmount: Number(form.emiAmount),
        totalInstallments: Number(form.totalInstallments),
        startDate: form.startDate,
        dueDayOfMonth: Number(form.dueDayOfMonth),
        reminderChannels: form.reminderChannels,
        notes: form.notes.trim() || null,
        scheduleDocuments: scheduleFiles,
      });
      await onCreated();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to create EMI plan";
      setError(msg);
      toast.error("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const totalCost =
    (Number(form.emiAmount) || 0) * (Number(form.totalInstallments) || 0);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">New EMI plan</h2>
            <p className="text-white/80 text-[11px] mt-0.5">
              {vehicle.registrationNumber} · {vehicle.make} {vehicle.model}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={submit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <Section title="Loan details">
              <Grid2>
                <Field label="Lender / Bank name" required>
                  <input
                    className="input"
                    value={form.lenderName}
                    onChange={(e) => set("lenderName", e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    required
                  />
                </Field>
                <Field label="Type">
                  <select
                    className="input"
                    value={form.lenderType}
                    onChange={(e) =>
                      set("lenderType", e.target.value as typeof form.lenderType)
                    }
                  >
                    <option value="BANK">Bank</option>
                    <option value="NBFC">NBFC</option>
                    <option value="PARTNER">EMI Partner</option>
                  </select>
                </Field>
                <Field label="Branch / IFSC">
                  <input
                    className="input"
                    value={form.lenderBranch}
                    onChange={(e) => set("lenderBranch", e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Lender contact">
                  <input
                    className="input"
                    value={form.lenderContactPhone}
                    onChange={(e) => set("lenderContactPhone", e.target.value)}
                    placeholder="Phone (optional)"
                  />
                </Field>
              </Grid2>
            </Section>

            <Section title="Schedule">
              <Grid2>
                <Field label="EMI amount (₹)" required>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" />
                    <input
                      className="input !pl-10"
                      type="number"
                      min="0"
                      value={form.emiAmount}
                      onChange={(e) => set("emiAmount", e.target.value)}
                      required
                    />
                  </div>
                </Field>
                <Field label="Total installments" required>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="600"
                    value={form.totalInstallments}
                    onChange={(e) => set("totalInstallments", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Principal amount (₹)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.principalAmount}
                    onChange={(e) => set("principalAmount", e.target.value)}
                    placeholder="Optional total loan"
                  />
                </Field>
                <Field label="Start date" required>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      className="input pl-8"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => set("startDate", e.target.value)}
                      required
                    />
                  </div>
                </Field>
                <Field label="Due day of month" required>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="31"
                    value={form.dueDayOfMonth}
                    onChange={(e) => set("dueDayOfMonth", e.target.value)}
                    required
                  />
                </Field>
                <div className="h-9 flex items-center px-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200/70 dark:border-yellow-500/20 self-end">
                  <span className="text-[9px] font-semibold text-yellow-700/80 dark:text-yellow-400/80 uppercase tracking-wider mr-1.5">
                    Total cost
                  </span>
                  <span className="text-xs font-black text-yellow-700 dark:text-yellow-400 font-mono">
                    {formatINR(totalCost)}
                  </span>
                </div>
              </Grid2>
            </Section>

            <Section title="Debit source">
              {savedDebits.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setDebitMode("saved")}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ${
                      debitMode === "saved"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                  >
                    Saved account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDebitMode("new");
                      setSelectedDebitId("");
                      set("debitBankName", "");
                      set("debitAccountMasked", "");
                      set("debitAccountHolder", "");
                    }}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ${
                      debitMode === "new"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    }`}
                  >
                    + New account
                  </button>
                </div>
              )}

              {debitMode === "saved" && savedDebits.length > 0 ? (
                <Field label="Choose a saved account">
                  <select
                    className="input"
                    value={selectedDebitId}
                    onChange={(e) => setSelectedDebitId(e.target.value)}
                  >
                    <option value="">— Select —</option>
                    {savedDebits.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} · {a.accountMasked}
                        {a.accountHolder ? ` · ${a.accountHolder}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Grid2>
                  <Field label="Bank">
                    <input
                      className="input"
                      value={form.debitBankName}
                      onChange={(e) => set("debitBankName", e.target.value)}
                      placeholder="e.g. ICICI Bank"
                    />
                  </Field>
                  <Field label="Account holder">
                    <input
                      className="input"
                      value={form.debitAccountHolder}
                      onChange={(e) => set("debitAccountHolder", e.target.value)}
                    />
                  </Field>
                  <Field label="Account number (masked)">
                    <input
                      className="input"
                      value={form.debitAccountMasked}
                      onChange={(e) => set("debitAccountMasked", e.target.value)}
                      placeholder="e.g. XXXX1234"
                    />
                  </Field>
                </Grid2>
              )}
              {debitMode === "new" && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                  Saved automatically after this plan is created — next time it&apos;ll appear in
                  the dropdown above.
                </p>
              )}
            </Section>

            <Section title="EMI schedule documents">
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400 flex-shrink-0">
                    <Wallet className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {scheduleFiles.length > 0
                        ? `${scheduleFiles.length} file${scheduleFiles.length === 1 ? "" : "s"} attached`
                        : "Optional — upload the amortization sheet(s) from your bank"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">PDF / JPG / PNG — pick one or more</p>
                  </div>
                  <label className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                    {scheduleFiles.length > 0 ? "Add more" : "Browse"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => {
                        const picked = Array.from(e.target.files ?? []);
                        if (picked.length === 0) return;
                        // De-dup by (name + size) so the same file added twice
                        // collapses to one chip.
                        setScheduleFiles((prev) => {
                          const seen = new Set(
                            prev.map((f) => `${f.name}::${f.size}`),
                          );
                          const merged = [...prev];
                          for (const f of picked) {
                            const k = `${f.name}::${f.size}`;
                            if (!seen.has(k)) {
                              merged.push(f);
                              seen.add(k);
                            }
                          }
                          return merged;
                        });
                        // Reset the input so re-selecting the same file fires onChange.
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                {scheduleFiles.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {scheduleFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 max-w-full"
                      >
                        <span className="truncate max-w-[180px]" title={f.name}>
                          {f.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setScheduleFiles((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="text-gray-400 hover:text-red-600"
                          title="Remove this file"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>

            <Section title="Reminders">
              <div className="flex flex-wrap gap-2">
                {(["EMAIL", "WHATSAPP", "IN_APP"] as const).map((ch) => {
                  const on = form.reminderChannels.includes(ch);
                  const label =
                    ch === "IN_APP" ? "In-app" : ch.charAt(0) + ch.slice(1).toLowerCase();
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ${
                        on
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                Reminders fire 7d, 3d, and 1d before each due date.
              </p>
            </Section>

            <Field label="Notes">
              <textarea
                className="input min-h-[64px] py-2"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional"
                maxLength={500}
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
          <div className="flex gap-2.5 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex-shrink-0">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {saving ? "Creating…" : "Create EMI plan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>

          <style jsx>{`
            :global(.input) {
              width: 100%;
              height: 2.25rem;
              border-radius: 0.5rem;
              border: 1px solid rgb(229 231 235);
              background-color: white;
              padding: 0 0.75rem;
              font-size: 0.75rem;
              color: rgb(31 41 55);
            }
            :global(.dark .input) {
              border-color: rgb(55 65 81);
              background-color: rgb(31 41 55);
              color: white;
            }
            :global(.input:focus) {
              outline: none;
              border-color: rgb(234 179 8);
              box-shadow: 0 0 0 3px rgb(234 179 8 / 0.1);
            }
            :global(textarea.input) {
              height: auto;
            }
          `}</style>
        </form>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
