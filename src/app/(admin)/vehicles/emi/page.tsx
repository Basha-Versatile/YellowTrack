"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { emiAPI, vehicleAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { VehicleAutocomplete } from "@/components/vehicles/VehicleAutocomplete";
import {
  Plus,
  Wallet,
  CalendarClock,
  AlertOctagon,
  CheckCircle2,
  Pause,
  Ban,
  Building2,
  CreditCard,
  IndianRupee,
  Calendar,
  X,
  FileSpreadsheet,
} from "lucide-react";

type VehicleBasic = {
  id: string;
  registrationNumber: string;
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

type FilterKey = "all" | "due7" | "due30" | "overdue" | "bounced" | "closed";

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
    if (vehicleId) rows = rows.filter((r) => String(r.vehicleId) === vehicleId);
    if (filter === "all") return rows;
    if (filter === "closed") return rows.filter((r) => r.status === "CLOSED");
    if (filter === "bounced") return rows.filter((r) => r.status === "DEFAULTED");
    if (filter === "overdue") {
      return rows.filter((r) => {
        if (r.status !== "ACTIVE") return false;
        const d = daysUntil(r.nextDueDate);
        return d !== null && d < 0;
      });
    }
    const horizon = filter === "due7" ? 7 : 30;
    return rows.filter((r) => {
      if (r.status !== "ACTIVE") return false;
      const d = daysUntil(r.nextDueDate);
      return d !== null && d >= 0 && d <= horizon;
    });
  }, [hub, filter, vehicleId]);

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
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:border-gray-800 dark:from-yellow-500/[0.04] dark:via-gray-900 dark:to-amber-500/[0.04] p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl dark:bg-yellow-400/10"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-700/70 dark:text-yellow-400">
              Fleet · EMI tracker
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Vehicles under EMI
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track loan installments, upcoming dues, and defaulters across your fleet.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-yellow-500/30 hover:from-yellow-500 hover:to-yellow-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            New EMI plan
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
        <KpiCard
          icon={<AlertOctagon className="w-4 h-4" />}
          label="Defaulters"
          value={hub?.summary.defaulters ?? 0}
          tint="red"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center flex-wrap gap-2.5 justify-between">
        <div className="flex items-center flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          <FilterChip active={filter === "due7"} onClick={() => setFilter("due7")} label="Due in 7d" />
          <FilterChip active={filter === "due30"} onClick={() => setFilter("due30")} label="Due in 30d" />
          <FilterChip active={filter === "overdue"} onClick={() => setFilter("overdue")} label="Overdue" tone="red" />
          <FilterChip active={filter === "bounced"} onClick={() => setFilter("bounced")} label="Defaulted" tone="red" />
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
                  <Th>Vehicle</Th>
                  <Th>Lender</Th>
                  <Th className="text-right">EMI / month</Th>
                  <Th className="text-right">Outstanding</Th>
                  <Th className="text-center">Progress</Th>
                  <Th>Next due</Th>
                  <Th className="text-center">Status</Th>
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
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${TINTS[tint]} mb-2`}>
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
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
            href={`/vehicles/${row.vehicleId}`}
            className="font-semibold text-gray-900 dark:text-white font-mono text-[11px] hover:text-yellow-700 dark:hover:text-yellow-400"
          >
            {row.vehicle.registrationNumber}
          </Link>
        ) : (
          <span className="text-gray-400">—</span>
        )}
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
          {row.vehicle ? `${row.vehicle.make} ${row.vehicle.model}` : ""}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 font-medium">
          <Building2 className="w-3 h-3 text-gray-400" />
          {row.lenderName}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">
          {row.lenderType}
        </div>
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
