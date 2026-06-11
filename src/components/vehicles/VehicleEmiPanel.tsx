"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { emiAPI } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/modal";
import DatePicker from "@/components/ui/DatePicker";
import {
  Banknote,
  Plus,
  Pencil,
  Building2,
  CalendarClock,
  CreditCard,
  CheckCircle2,
  Pause,
  Ban,
  ExternalLink,
  FileText,
  Upload,
  X,
  IndianRupee,
  Calendar,
} from "lucide-react";

type EmiPlan = {
  id: string;
  vehicleId: string;
  lenderName: string;
  lenderType: "BANK" | "NBFC" | "PARTNER";
  lenderContactPhone: string | null;
  lenderBranch: string | null;
  loanAccountNumber: string | null;
  debitBankName: string | null;
  debitAccountMasked: string | null;
  debitAccountHolder: string | null;
  principalAmount: number | null;
  emiAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  startDate: string;
  endDate: string;
  dueDayOfMonth: number;
  status: "ACTIVE" | "PAUSED" | "DEFAULTED" | "CLOSED";
  nextDueDate: string | null;
  reminderChannels: Array<"EMAIL" | "WHATSAPP" | "IN_APP">;
  notes: string | null;
  scheduleDocumentUrl?: string | null;
  scheduleDocumentUrls?: string[];
};

type EmiPayment = {
  id: string;
  installmentNumber: number;
  scheduledDate: string;
  amount: number;
  paidDate: string | null;
  paidAmount: number | null;
  lateFee: number;
  status: "SCHEDULED" | "PAID" | "OVERDUE" | "PARTIAL" | "SKIPPED" | "BOUNCED";
  transactionRef: string | null;
  proofUrl: string | null;
  notes: string | null;
};

const STATUS_TINT: Record<EmiPayment["status"], string> = {
  PAID: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  SCHEDULED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  OVERDUE: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  BOUNCED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  PARTIAL: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  SKIPPED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

const PLAN_STATUS_TINT: Record<EmiPlan["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  PAUSED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  DEFAULTED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatINR(n: number | null | undefined): string {
  return `₹${(n ?? 0).toLocaleString("en-IN")}`;
}
function formatDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}
function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export default function VehicleEmiPanel({
  vehicleId,
  vehicleRegistration,
  vehicleMake,
  vehicleModel,
}: {
  vehicleId: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
}) {
  const toast = useToast();
  const [plans, setPlans] = useState<EmiPlan[]>([]);
  const [activePlan, setActivePlan] = useState<EmiPlan | null>(null);
  const [payments, setPayments] = useState<EmiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Open the same modal in edit mode for the active plan.
  const [editingPlan, setEditingPlan] = useState<EmiPlan | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [pendingUnpaid, setPendingUnpaid] = useState<EmiPayment | null>(null);
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [pendingBulkPaid, setPendingBulkPaid] = useState(false);
  const [bulkPaidLoading, setBulkPaidLoading] = useState(false);
  // Edit-a-paid-installment modal. Lets the user correct the paid date,
  // amount, or late fee after marking paid — previously the only option was
  // to revert ("Mark unpaid") and re-pay, which always reset to today.
  const [editingPaid, setEditingPaid] = useState<EmiPayment | null>(null);
  const [editPaidForm, setEditPaidForm] = useState({ paidDate: "", paidAmount: "", lateFee: "" });
  const [savingPaidEdit, setSavingPaidEdit] = useState(false);
  // Close-plan two-step gate. Step 1 is a warning + "Send code" button;
  // step 2 is the OTP entry. Mirrors the doc-type / vehicle deletion flows.
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const [closeStep, setCloseStep] = useState<"warn" | "otp">("warn");
  const [closeOtpInput, setCloseOtpInput] = useState("");
  const [closeOtpRequesting, setCloseOtpRequesting] = useState(false);
  const [closeOtpExpiresAt, setCloseOtpExpiresAt] = useState<Date | null>(null);
  const [closing, setClosing] = useState(false);
  // Installments table renders every row inside a scroll container so it
  // doesn't dominate the page on long plans. The row in the same month/year
  // as today gets highlighted and scrolled into view on mount.
  const installmentsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const currentRowRef = React.useRef<HTMLTableRowElement | null>(null);

  // Note: `toast` is intentionally NOT a dep. useToast() returns a new ref on
  // every render — including it would re-fire the effect → re-render → loop.
  const loadPlans = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await emiAPI.getForVehicle(vehicleId);
      const list = (res.data.data as EmiPlan[]) ?? [];
      setPlans(list);
      const active = list.find((p) => p.status === "ACTIVE") ?? list[0] ?? null;
      setActivePlan(active);
      if (active) {
        const detail = await emiAPI.getPlan(active.id);
        setPayments(
          ((detail.data.data as { payments: EmiPayment[] }).payments ?? []),
        );
      } else {
        setPayments([]);
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg =
        status === 403
          ? "You don't have permission to view EMI data."
          : "Couldn't load EMI for this vehicle.";
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const due = activePlan ? daysUntil(activePlan.nextDueDate) : null;
  const pct = activePlan && activePlan.totalInstallments
    ? Math.round((activePlan.paidInstallments / activePlan.totalInstallments) * 100)
    : 0;

  // Loan summary — everything in EMI-cash terms so paid + pending = total
  // always reconciles. Earlier we mixed principalAmount (borrowed cash,
  // no interest) with EMI cash (includes interest), which produced a
  // "% remaining" > 100% whenever the principal was recorded. Principal
  // is surfaced separately as a hint, not the running total.
  const summary = useMemo(() => {
    if (!activePlan)
      return { totalAmount: 0, paidAmount: 0, pendingAmount: 0, pendingCount: 0 };
    const totalAmount = activePlan.emiAmount * activePlan.totalInstallments;
    if (payments.length > 0) {
      const pendingRows = payments.filter(
        (p) => p.status !== "PAID" && p.status !== "SKIPPED",
      );
      const pendingAmount = pendingRows.reduce(
        (s, p) => s + p.amount + (p.lateFee ?? 0),
        0,
      );
      const paidAmount = payments
        .filter((p) => p.status === "PAID")
        .reduce((s, p) => s + (p.paidAmount ?? p.amount) + (p.lateFee ?? 0), 0);
      return {
        totalAmount,
        paidAmount,
        pendingAmount,
        pendingCount: pendingRows.length,
      };
    }
    // Fallback (payments not loaded yet) — counter-based
    const pendingCount =
      activePlan.totalInstallments - activePlan.paidInstallments;
    return {
      totalAmount,
      paidAmount: activePlan.emiAmount * activePlan.paidInstallments,
      pendingAmount: activePlan.emiAmount * pendingCount,
      pendingCount,
    };
  }, [activePlan, payments]);

  // Render every installment — no slicing — inside a scroll container so the
  // current-month row can be highlighted and scrolled into view.
  const upcomingPayments = payments;

  // Index of the row whose scheduledDate falls inside the current calendar
  // month. -1 if none (the plan's already finished or started in the future).
  const currentMonthIndex = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return payments.findIndex((p) => {
      const d = new Date(p.scheduledDate as unknown as string | Date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [payments]);

  // Auto-scroll the current row into view once the table mounts / data loads.
  useEffect(() => {
    if (currentMonthIndex < 0) return;
    const row = currentRowRef.current;
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "auto" });
  }, [currentMonthIndex, payments.length]);

  const handleMarkPaid = async (payment: EmiPayment) => {
    if (!activePlan) return;
    setMarkingId(payment.id);
    try {
      await emiAPI.markPaid(activePlan.id, payment.id, {
        paidDate: new Date().toISOString(),
        paidAmount: payment.amount,
      });
      toast.success("Marked paid", `Installment #${payment.installmentNumber} paid`);
      await loadPlans();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to mark paid";
      toast.error("Could not mark paid", msg);
    } finally {
      setMarkingId(null);
    }
  };

  // How many SCHEDULED/OVERDUE/BOUNCED installments have a due date on or
  // before today — surface this in the bulk-confirm dialog so the user
  // knows what they're about to do.
  const dueTillTodayCount = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return payments.filter(
      (p) =>
        p.status !== "PAID" &&
        p.status !== "SKIPPED" &&
        new Date(p.scheduledDate).getTime() <= now.getTime(),
    ).length;
  }, [payments]);

  const runMarkAllPaidTillToday = async () => {
    if (!activePlan) return;
    setBulkPaidLoading(true);
    try {
      const res = await emiAPI.markAllPaidUntil(activePlan.id);
      const updated = (res?.data as { data?: { updated?: number } })?.data?.updated ?? 0;
      toast.success(
        "Marked paid",
        updated === 0
          ? "Nothing was due before today"
          : `${updated} installment${updated === 1 ? "" : "s"} marked paid`,
      );
      setPendingBulkPaid(false);
      await loadPlans();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to mark all paid";
      toast.error("Bulk mark failed", msg);
    } finally {
      setBulkPaidLoading(false);
    }
  };

  const runMarkUnpaid = async () => {
    if (!activePlan || !pendingUnpaid) return;
    setUnpaidLoading(true);
    try {
      await emiAPI.markUnpaid(activePlan.id, pendingUnpaid.id);
      toast.success(
        "Reverted to scheduled",
        `Installment #${pendingUnpaid.installmentNumber} marked unpaid`,
      );
      setPendingUnpaid(null);
      await loadPlans();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to revert payment";
      toast.error("Could not revert", msg);
    } finally {
      setUnpaidLoading(false);
    }
  };

  const openEditPaid = (payment: EmiPayment) => {
    setEditPaidForm({
      paidDate: payment.paidDate
        ? new Date(payment.paidDate).toISOString().slice(0, 10)
        : "",
      paidAmount: String(payment.paidAmount ?? payment.amount),
      lateFee: String(payment.lateFee ?? 0),
    });
    setEditingPaid(payment);
  };

  const runUpdatePaid = async () => {
    if (!activePlan || !editingPaid) return;
    const amount = Number(editPaidForm.paidAmount);
    const fee = Number(editPaidForm.lateFee || 0);
    if (!editPaidForm.paidDate) {
      toast.error("Date required", "Pick the date this installment was paid");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Invalid amount", "Paid amount must be zero or positive");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      toast.error("Invalid late fee", "Late fee must be zero or positive");
      return;
    }
    setSavingPaidEdit(true);
    try {
      await emiAPI.updatePaidPayment(activePlan.id, editingPaid.id, {
        paidDate: new Date(editPaidForm.paidDate).toISOString(),
        paidAmount: amount,
        lateFee: fee,
      });
      toast.success(
        "Installment updated",
        `Installment #${editingPaid.installmentNumber} saved`,
      );
      setEditingPaid(null);
      await loadPlans();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update installment";
      toast.error("Could not update", msg);
    } finally {
      setSavingPaidEdit(false);
    }
  };

  const handleStatusChange = async (
    status: "DEFAULTED" | "CLOSED" | "ACTIVE",
  ) => {
    if (!activePlan) return;
    try {
      await emiAPI.updatePlan(activePlan.id, { status });
      toast.success("Plan updated", `Status set to ${status}`);
      await loadPlans();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Update failed";
      toast.error("Could not update", msg);
    }
  };

  return (
    <div
      id="emi"
      className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Banknote className="w-4 h-4 text-yellow-500" strokeWidth={2} />
          EMI Tracker
          {activePlan && (
            <span
              className={`ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${PLAN_STATUS_TINT[activePlan.status]}`}
            >
              {activePlan.status === "ACTIVE" && <CheckCircle2 className="w-3 h-3" />}
              {activePlan.status === "PAUSED" && <Pause className="w-3 h-3" />}
              {activePlan.status === "DEFAULTED" && <Ban className="w-3 h-3" />}
              {activePlan.status}
            </span>
          )}
        </h3>
        {!activePlan && !loading && plans.length === 0 && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add EMI plan
          </button>
        )}
        {activePlan && activePlan.status === "ACTIVE" && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditingPlan(activePlan)}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-semibold transition-colors dark:bg-yellow-500/10 dark:text-yellow-400 dark:hover:bg-yellow-500/20"
              title="Edit this EMI plan"
            >
              <Pencil className="w-3 h-3" /> Edit plan
            </button>
            <button
              onClick={() => {
                setCloseStep("warn");
                setCloseOtpInput("");
                setCloseOtpExpiresAt(null);
                setClosePromptOpen(true);
              }}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Close this EMI plan"
            >
              Close plan
            </button>
          </div>
        )}
        {activePlan &&
          (activePlan.status === "CLOSED" || activePlan.status === "DEFAULTED") && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Start new EMI plan
            </button>
          )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
          Loading EMI…
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200/60 bg-red-50/40 dark:border-red-500/20 dark:bg-red-500/[0.05] p-5 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            {loadError}
          </p>
          <button
            onClick={loadPlans}
            className="mt-3 inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 dark:bg-transparent dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      ) : !activePlan ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <CreditCard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            This vehicle isn&apos;t under EMI
          </p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Add a plan to track lender, monthly installments, due dates and reminders.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 h-9 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add EMI plan
          </button>
        </div>
      ) : (
        <>
          {(activePlan.status === "CLOSED" || activePlan.status === "DEFAULTED") && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-gray-600 dark:text-gray-400">
                This plan is{" "}
                <span className="font-bold uppercase tracking-wider">
                  {activePlan.status.toLowerCase()}
                </span>
                . Schedule below is read-only history. Start a new EMI plan when you&apos;re ready.
              </p>
            </div>
          )}

          {/* Summary strip */}
          <div className="grid grid-cols-1 2xsm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat
              icon={<Building2 className="w-3.5 h-3.5" />}
              label="Lender"
              value={activePlan.lenderName}
              hint={activePlan.lenderType}
            />
            <Stat
              icon={<IndianRupee className="w-3.5 h-3.5" />}
              label="EMI / month"
              value={formatINR(activePlan.emiAmount)}
              hint={`Due on ${activePlan.dueDayOfMonth}${suffix(activePlan.dueDayOfMonth)} of each month`}
            />
            <Stat
              icon={<CalendarClock className="w-3.5 h-3.5" />}
              label="Next due"
              value={
                activePlan.nextDueDate
                  ? due === 0
                    ? "Today"
                    : due! < 0
                      ? `${-due!}d overdue`
                      : `In ${due}d`
                  : "—"
              }
              hint={formatDate(activePlan.nextDueDate)}
              tone={due !== null && due < 0 ? "red" : due !== null && due <= 7 ? "amber" : "default"}
            />
            <Stat
              icon={<CreditCard className="w-3.5 h-3.5" />}
              label="Progress"
              value={`${activePlan.paidInstallments} / ${activePlan.totalInstallments}`}
              hint={`${pct}% complete`}
              progress={pct}
            />
          </div>

          {/* Loan summary — total / pending / count */}
          <div className="grid grid-cols-1 2xsm:grid-cols-3 gap-3 mb-5">
            <SummaryTile
              label="Total payable"
              value={formatINR(summary.totalAmount)}
              hint={
                activePlan.principalAmount && activePlan.principalAmount > 0
                  ? `Principal ${formatINR(activePlan.principalAmount)} · ${activePlan.totalInstallments} × ${formatINR(activePlan.emiAmount)}`
                  : `${activePlan.totalInstallments} × ${formatINR(activePlan.emiAmount)}`
              }
              tone="default"
            />
            <SummaryTile
              label="Pending amount"
              value={formatINR(summary.pendingAmount)}
              hint={
                summary.totalAmount > 0
                  ? `${Math.round((summary.pendingAmount / summary.totalAmount) * 100)}% remaining · paid ${formatINR(summary.paidAmount)}`
                  : "—"
              }
              tone={summary.pendingAmount > 0 ? "amber" : "default"}
            />
            <SummaryTile
              label="Pending EMIs"
              value={`${summary.pendingCount}`}
              hint={
                summary.pendingCount === 0
                  ? "All cleared"
                  : `of ${activePlan.totalInstallments} installments`
              }
              tone={summary.pendingCount === 0 ? "default" : "amber"}
            />
          </div>

          {/* Lender / debit detail strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5 text-[11px]">
            <DetailLine
              label="Branch / IFSC"
              value={activePlan.lenderBranch || "—"}
            />
            <DetailLine
              label="Lender contact"
              value={activePlan.lenderContactPhone || "—"}
            />
            <DetailLine
              label="Loan account number"
              value={activePlan.loanAccountNumber || "—"}
            />
            <DetailLine
              label="Debit from"
              value={
                activePlan.debitBankName || activePlan.debitAccountMasked
                  ? `${activePlan.debitBankName ?? ""} ${activePlan.debitAccountMasked ? `· ${activePlan.debitAccountMasked}` : ""}`.trim()
                  : "—"
              }
            />
          </div>

          {/* Schedule table */}
          <div className="rounded-xl border border-gray-200/70 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/40 px-4 py-2 gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Installments
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPendingBulkPaid(true)}
                  disabled={dueTillTodayCount === 0}
                  className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline disabled:text-gray-400 disabled:hover:no-underline disabled:cursor-not-allowed inline-flex items-center gap-1"
                  title={
                    dueTillTodayCount === 0
                      ? "No installments due on or before today"
                      : `Mark ${dueTillTodayCount} installment${dueTillTodayCount === 1 ? "" : "s"} paid in bulk`
                  }
                >
                  ✓ Mark all paid till date
                  {dueTillTodayCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      {dueTillTodayCount}
                    </span>
                  )}
                </button>
                <Link
                  href="/vehicles/emi"
                  className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 hover:underline"
                >
                  Full hub →
                </Link>
              </div>
            </div>
            <div
              ref={installmentsScrollRef}
              className="overflow-y-auto max-h-[28rem] overflow-x-auto"
            >
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50/40 dark:bg-gray-800/20 sticky top-0 z-10 backdrop-blur">
                  <tr>
                    <th className="text-left px-4 py-2 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      #
                    </th>
                    <th className="text-left px-4 py-2 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      Scheduled
                    </th>
                    <th className="text-right px-4 py-2 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      Amount
                    </th>
                    <th className="text-left px-4 py-2 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      Paid on
                    </th>
                    <th className="text-center px-4 py-2 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      Status
                    </th>
                    <th className="text-right px-4 py-2 font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                  {upcomingPayments.map((p, idx) => {
                    const isCurrentMonth = idx === currentMonthIndex;
                    return (
                    <tr
                      key={p.id}
                      ref={isCurrentMonth ? currentRowRef : undefined}
                      className={
                        isCurrentMonth
                          ? "bg-yellow-50/80 dark:bg-yellow-500/[0.08] outline outline-1 outline-yellow-300/70 dark:outline-yellow-500/30"
                          : undefined
                      }
                    >
                      <td className="px-4 py-2 font-mono font-semibold text-gray-700 dark:text-gray-300">
                        {p.installmentNumber}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1.5">
                          {formatDate(p.scheduledDate)}
                          {isCurrentMonth && (
                            <span className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400 text-gray-900">
                              This month
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-black text-gray-900 dark:text-white">
                        {formatINR(p.amount)}
                        {p.lateFee > 0 && (
                          <span className="block text-[9px] text-red-500 font-normal">
                            + ₹{p.lateFee} late
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {formatDate(p.paidDate)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${STATUS_TINT[p.status]}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {p.status === "PAID" ? (
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openEditPaid(p)}
                              className="text-[10px] font-semibold text-gray-500 hover:text-yellow-700 dark:text-gray-400 dark:hover:text-yellow-400 inline-flex items-center gap-1 transition-colors"
                              title="Edit the paid date, amount, or late fee"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingUnpaid(p)}
                              className="text-[10px] font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 inline-flex items-center gap-1 transition-colors"
                              title="Revert this installment back to scheduled"
                            >
                              <span className="text-emerald-500">✓</span> Mark unpaid
                            </button>
                          </div>
                        ) : p.status === "SKIPPED" ? (
                          <span className="text-[10px] text-gray-400">—</span>
                        ) : activePlan.status !== "ACTIVE" ? (
                          <span className="text-[10px] text-gray-400">—</span>
                        ) : (
                          <button
                            onClick={() => handleMarkPaid(p)}
                            disabled={markingId === p.id}
                            className="text-[10px] font-semibold text-yellow-700 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 disabled:opacity-50"
                          >
                            {markingId === p.id ? "Saving…" : "Mark paid"}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {payments.length > 0 && (
              <div className="bg-gray-50/40 dark:bg-gray-800/20 px-4 py-2 text-center text-[10px] text-gray-500 dark:text-gray-400">
                Showing all {payments.length} installments
                {currentMonthIndex >= 0 && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() =>
                        currentRowRef.current?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        })
                      }
                      className="font-semibold text-yellow-700 dark:text-yellow-400 hover:underline"
                    >
                      Jump to current month
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {activePlan.notes && (
            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 italic">
              Note: {activePlan.notes}
            </p>
          )}
        </>
      )}

      {creating && (
        <InlineCreateEmiModal
          vehicleId={vehicleId}
          vehicleLabel={`${vehicleRegistration} · ${vehicleMake} ${vehicleModel}`}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            toast.success("EMI plan created", "Schedule generated");
            await loadPlans();
          }}
        />
      )}

      {editingPlan && (
        <InlineCreateEmiModal
          vehicleId={vehicleId}
          vehicleLabel={`${vehicleRegistration} · ${vehicleMake} ${vehicleModel}`}
          editPlan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onCreated={async () => {
            setEditingPlan(null);
            toast.success("EMI plan updated", "Changes saved");
            await loadPlans();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingUnpaid !== null}
        title={
          pendingUnpaid
            ? `Revert installment #${pendingUnpaid.installmentNumber} to unpaid?`
            : "Revert this installment?"
        }
        message="The linked expense entry will be removed, and the installment will be returned to SCHEDULED. You can mark it paid again later."
        confirmLabel="Mark unpaid"
        cancelLabel="Keep paid"
        variant="warning"
        loading={unpaidLoading}
        onConfirm={runMarkUnpaid}
        onCancel={() => setPendingUnpaid(null)}
      />

      <ConfirmDialog
        isOpen={pendingBulkPaid}
        title={`Mark ${dueTillTodayCount} installment${dueTillTodayCount === 1 ? "" : "s"} as paid?`}
        message="Every installment scheduled on or before today (that isn't already paid or skipped) will be marked paid and an expense entry will be created for each. You can still revert individual rows later."
        confirmLabel="Mark all paid"
        cancelLabel="Cancel"
        variant="warning"
        loading={bulkPaidLoading}
        onConfirm={runMarkAllPaidTillToday}
        onCancel={() => setPendingBulkPaid(false)}
      />

      {/* Edit a paid installment — adjust date / amount / late fee in place.
          Keeps the row PAID and re-syncs the linked expense server-side. */}
      <Modal
        isOpen={editingPaid !== null}
        onClose={() => !savingPaidEdit && setEditingPaid(null)}
        className="max-w-md"
      >
        {editingPaid && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit installment #{editingPaid.installmentNumber}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Update the paid details. The linked expense entry is adjusted to match.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Paid on
                </label>
                <DatePicker
                  value={editPaidForm.paidDate}
                  onChange={(v) => setEditPaidForm((f) => ({ ...f, paidDate: v }))}
                  placeholder="Pick a date"
                  maxDate={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Paid amount (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editPaidForm.paidAmount}
                    onChange={(e) =>
                      setEditPaidForm((f) => ({
                        ...f,
                        paidAmount: e.target.value.replace(/[^\d.]/g, ""),
                      }))
                    }
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Late fee (₹)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editPaidForm.lateFee}
                    onChange={(e) =>
                      setEditPaidForm((f) => ({
                        ...f,
                        lateFee: e.target.value.replace(/[^\d.]/g, ""),
                      }))
                    }
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPaid(null)}
                disabled={savingPaidEdit}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runUpdatePaid}
                disabled={savingPaidEdit}
                className="rounded-xl px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 shadow shadow-yellow-500/25 hover:shadow-yellow-500/40 disabled:opacity-50 transition-all"
              >
                {savingPaidEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {closePromptOpen && activePlan && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !closing && !closeOtpRequesting && setClosePromptOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {closeStep === "warn" ? (
              <>
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 mb-4 mx-auto">
                    <Ban className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white text-center">
                    Close this EMI plan?
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    Closing the plan with{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {activePlan.lenderName}
                    </span>{" "}
                    will stop new reminders and mark it CLOSED. Existing
                    installments stay on file. This action is reversible from
                    the activity log.
                  </p>
                  <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400 text-center">
                    Continuing will email a one-time code to your registered
                    address — you&apos;ll need to enter it to authorize closure.
                  </p>
                </div>
                <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <button
                    type="button"
                    onClick={async () => {
                      setCloseOtpRequesting(true);
                      try {
                        const res = await emiAPI.requestClose(activePlan.id);
                        const expires = (
                          res.data?.data as { expiresAt?: string } | undefined
                        )?.expiresAt;
                        setCloseOtpExpiresAt(expires ? new Date(expires) : null);
                        setCloseStep("otp");
                        toast.success(
                          "Code sent",
                          "Check your email for the 6-digit code",
                        );
                      } catch (err) {
                        const msg =
                          (err as { response?: { data?: { message?: string } } })
                            ?.response?.data?.message ?? "Could not send code";
                        toast.error("Send failed", msg);
                      } finally {
                        setCloseOtpRequesting(false);
                      }
                    }}
                    disabled={closeOtpRequesting}
                    className="flex-1 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {closeOtpRequesting && (
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    Send authorization code
                  </button>
                  <button
                    type="button"
                    onClick={() => !closeOtpRequesting && setClosePromptOpen(false)}
                    disabled={closeOtpRequesting}
                    className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 mb-4 mx-auto">
                    <Ban className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white text-center">
                    Enter authorization code
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    We sent a 6-digit code to your registered email. Enter it
                    below to close the EMI plan with{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {activePlan.lenderName}
                    </span>
                    .
                  </p>
                  {closeOtpExpiresAt && (
                    <p className="mt-1 text-[10px] text-gray-400 text-center">
                      Code expires at{" "}
                      {closeOtpExpiresAt.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      .
                    </p>
                  )}
                  <div className="mt-5">
                    <label className="block">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                        6-digit code
                      </span>
                      <input
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={closeOtpInput}
                        onChange={(e) =>
                          setCloseOtpInput(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="••••••"
                        className="w-full h-12 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-center text-2xl font-mono tracking-[0.5em] text-gray-800 dark:text-gray-200 focus:border-red-400 focus:outline-none focus:ring-3 focus:ring-red-400/10"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        setCloseOtpRequesting(true);
                        try {
                          const res = await emiAPI.requestClose(activePlan.id);
                          const expires = (
                            res.data?.data as { expiresAt?: string } | undefined
                          )?.expiresAt;
                          setCloseOtpExpiresAt(expires ? new Date(expires) : null);
                          setCloseOtpInput("");
                          toast.success("New code sent", "Check your email");
                        } catch (err) {
                          const msg =
                            (err as { response?: { data?: { message?: string } } })
                              ?.response?.data?.message ?? "Could not resend";
                          toast.error("Resend failed", msg);
                        } finally {
                          setCloseOtpRequesting(false);
                        }
                      }}
                      disabled={closeOtpRequesting || closing}
                      className="mt-2 text-[11px] text-yellow-700 dark:text-yellow-400 hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  </div>
                </div>
                <div className="flex gap-2.5 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!/^\d{6}$/.test(closeOtpInput.trim())) {
                        toast.error("Invalid code", "Enter the 6-digit code");
                        return;
                      }
                      setClosing(true);
                      try {
                        await emiAPI.confirmClose(activePlan.id, closeOtpInput.trim());
                        toast.success("Plan closed", "EMI plan marked CLOSED");
                        setClosePromptOpen(false);
                        setCloseOtpInput("");
                        setCloseStep("warn");
                        await loadPlans();
                      } catch (err) {
                        const msg =
                          (err as { response?: { data?: { message?: string } } })
                            ?.response?.data?.message ?? "Close failed";
                        toast.error("Could not close", msg);
                      } finally {
                        setClosing(false);
                      }
                    }}
                    disabled={closing || !/^\d{6}$/.test(closeOtpInput.trim())}
                    className="flex-1 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {closing && (
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    Authorize & close
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      !closing && !closeOtpRequesting && setClosePromptOpen(false)
                    }
                    disabled={closing || closeOtpRequesting}
                    className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function suffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = "default",
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "amber" | "red";
  progress?: number;
}) {
  const valueCls =
    tone === "red"
      ? "text-red-700 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-400"
        : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-200/70 bg-gray-50/40 p-3 dark:border-gray-800 dark:bg-gray-800/20">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        {label}
      </div>
      <p className={`text-sm font-black tracking-tight truncate ${valueCls}`}>{value}</p>
      {hint && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{hint}</p>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "default" | "amber";
}) {
  const valueCls =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-400"
      : "text-gray-900 dark:text-white";
  const wrapCls =
    tone === "amber"
      ? "border-amber-200/70 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/[0.06]"
      : "border-gray-200/70 bg-gray-50/40 dark:border-gray-800 dark:bg-gray-800/20";
  return (
    <div className={`rounded-xl border p-3 ${wrapCls}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </p>
      <p className={`text-base font-black tracking-tight truncate ${valueCls}`}>
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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50/60 px-3 py-2 dark:bg-gray-800/30">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </p>
      <p className="text-gray-700 dark:text-gray-300 font-medium truncate">{value}</p>
    </div>
  );
}

// ── Inline create modal (mirror of the one on the hub page, simpler) ────────

function InlineCreateEmiModal({
  vehicleId,
  vehicleLabel,
  editPlan = null,
  onClose,
  onCreated,
}: {
  vehicleId: string;
  vehicleLabel: string;
  // When provided, the modal switches to edit mode — pre-fills from this
  // plan and sends a PATCH instead of POST. Schedule-affecting edits go
  // through the service which regenerates the unpaid installment tail.
  editPlan?: EmiPlan | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const toast = useToast();
  const isEdit = editPlan !== null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    lenderName: editPlan?.lenderName ?? "",
    lenderType: (editPlan?.lenderType ?? "BANK") as "BANK" | "NBFC" | "PARTNER",
    loanAccountNumber: editPlan?.loanAccountNumber ?? "",
    debitBankName: editPlan?.debitBankName ?? "",
    debitAccountMasked: editPlan?.debitAccountMasked ?? "",
    emiAmount: editPlan ? String(editPlan.emiAmount) : "",
    totalInstallments: editPlan ? String(editPlan.totalInstallments) : "12",
    startDate: editPlan
      ? new Date(editPlan.startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    dueDayOfMonth: editPlan ? String(editPlan.dueDayOfMonth) : "5",
    notes: editPlan?.notes ?? "",
    // Downpayment is create-time-only. Edit mode shows blank inputs and the
    // submit handler intentionally ignores them when isEdit (V1 scope —
    // retroactive downpayment edit is a follow-up).
    downpaymentAmount: "",
    downpaymentDate: "",
  }));

  // Amortization-sheet file management. In create mode `pendingFiles` is
  // sent up with POST /vehicles/[id]/emi (matches the existing
  // `scheduleDocuments` field on emiAPI.create). In edit mode `existingFiles`
  // mirrors the plan's stored URLs — the user can remove a URL (DELETE
  // /emi/[planId]/schedule-files) or upload more (POST same path) before
  // hitting Save. We persist file changes immediately so failures show up
  // discretely, then save the rest of the form last.
  const [existingFiles, setExistingFiles] = useState<string[]>(
    () =>
      (editPlan?.scheduleDocumentUrls && editPlan.scheduleDocumentUrls.length > 0
        ? editPlan.scheduleDocumentUrls
        : editPlan?.scheduleDocumentUrl
          ? [editPlan.scheduleDocumentUrl]
          : []) ?? [],
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);

  const addPendingFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    setPendingFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const merged = [...prev];
      for (const f of incoming) {
        const key = `${f.name}_${f.size}`;
        if (!seen.has(key)) {
          merged.push(f);
          seen.add(key);
        }
      }
      return merged;
    });
  };

  const dropPendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // In edit mode, remove an already-persisted file. We hit the server right
  // away so the change survives even if the user later hits Cancel — the
  // file is gone either way, and that matches the user's mental model.
  const removeExistingFile = async (url: string) => {
    if (!editPlan) return;
    setScheduleBusy(true);
    try {
      await emiAPI.removeScheduleFile(editPlan.id, url);
      setExistingFiles((prev) => prev.filter((u) => u !== url));
      toast.success("File removed", "Schedule document deleted");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not remove file";
      toast.error("Remove failed", msg);
    } finally {
      setScheduleBusy(false);
    }
  };

  // Live downpayment validation — date becomes required the moment a
  // positive amount is typed. Shown inline below the date field.
  const dpAmtNum = Number(form.downpaymentAmount);
  const dpAmtValid =
    !form.downpaymentAmount || (Number.isFinite(dpAmtNum) && dpAmtNum >= 0);
  const dpDateRequired = dpAmtNum > 0;
  const dpDateMissing = dpDateRequired && !form.downpaymentDate;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isEdit && !dpAmtValid) {
      setError("Downpayment amount must be zero or positive");
      return;
    }
    if (!isEdit && dpDateMissing) {
      setError("Downpayment date is required when an amount is provided");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && editPlan) {
        await emiAPI.updatePlan(editPlan.id, {
          lenderName: form.lenderName.trim(),
          lenderType: form.lenderType,
          loanAccountNumber: form.loanAccountNumber.trim() || null,
          debitBankName: form.debitBankName.trim() || null,
          debitAccountMasked: form.debitAccountMasked.trim() || null,
          emiAmount: Number(form.emiAmount),
          totalInstallments: Number(form.totalInstallments),
          startDate: form.startDate,
          dueDayOfMonth: Number(form.dueDayOfMonth),
          notes: form.notes.trim() || null,
        });
        // Append any newly-picked files to the existing plan.
        if (pendingFiles.length > 0) {
          await emiAPI.appendScheduleFiles(editPlan.id, pendingFiles);
        }
      } else {
        await emiAPI.create(vehicleId, {
          lenderName: form.lenderName.trim(),
          lenderType: form.lenderType,
          loanAccountNumber: form.loanAccountNumber.trim() || null,
          debitBankName: form.debitBankName.trim() || null,
          debitAccountMasked: form.debitAccountMasked.trim() || null,
          emiAmount: Number(form.emiAmount),
          totalInstallments: Number(form.totalInstallments),
          startDate: form.startDate,
          dueDayOfMonth: Number(form.dueDayOfMonth),
          notes: form.notes.trim() || null,
          scheduleDocuments: pendingFiles.length > 0 ? pendingFiles : null,
          downpaymentAmount: dpAmtNum > 0 ? dpAmtNum : undefined,
          downpaymentDate:
            dpAmtNum > 0 && form.downpaymentDate
              ? form.downpaymentDate
              : undefined,
        });
      }
      await onCreated();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (isEdit ? "Failed to update EMI plan" : "Failed to create EMI plan");
      setError(msg);
      toast.error("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  // Track whether schedule-affecting fields are being changed in edit mode
  // so the UI can warn the user that the unpaid installment tail will be
  // regenerated. Paid installments are never touched.
  const scheduleDirty = isEdit && editPlan && (
    Number(form.emiAmount) !== editPlan.emiAmount ||
    Number(form.totalInstallments) !== editPlan.totalInstallments ||
    Number(form.dueDayOfMonth) !== editPlan.dueDayOfMonth ||
    form.startDate !== new Date(editPlan.startDate).toISOString().slice(0, 10)
  );

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {isEdit ? "Edit EMI plan" : "New EMI plan"}
            </h2>
            <p className="text-white/80 text-[11px] mt-0.5">{vehicleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-3 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Lender" required>
                <input
                  className="input"
                  value={form.lenderName}
                  onChange={(e) => setForm({ ...form, lenderName: e.target.value })}
                  required
                  placeholder="e.g. HDFC Bank"
                />
              </Tile>
              <Tile label="Type">
                <select
                  className="input"
                  value={form.lenderType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lenderType: e.target.value as typeof form.lenderType,
                    })
                  }
                >
                  <option value="BANK">Bank</option>
                  <option value="NBFC">NBFC</option>
                  <option value="PARTNER">EMI Partner</option>
                </select>
              </Tile>
              <Tile label="EMI amount (₹)" required>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" />
                  <input
                    className="input !pl-10"
                    type="number"
                    min="0"
                    value={form.emiAmount}
                    onChange={(e) => setForm({ ...form, emiAmount: e.target.value })}
                    required
                  />
                </div>
              </Tile>
              <Tile label="Total installments" required>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="600"
                  value={form.totalInstallments}
                  onChange={(e) =>
                    setForm({ ...form, totalInstallments: e.target.value })
                  }
                  required
                />
              </Tile>
              <Tile label="Start date" required>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    className="input pl-8"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                  />
                </div>
              </Tile>
              <Tile label="Due day of month" required>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDayOfMonth}
                  onChange={(e) => setForm({ ...form, dueDayOfMonth: e.target.value })}
                  required
                />
              </Tile>
              <Tile label="Loan account number (LAN)">
                <input
                  className="input"
                  value={form.loanAccountNumber}
                  onChange={(e) =>
                    setForm({ ...form, loanAccountNumber: e.target.value })
                  }
                  placeholder="Optional · e.g. 50200000634900"
                  maxLength={60}
                />
              </Tile>
              <Tile label="Debit bank">
                <input
                  className="input"
                  value={form.debitBankName}
                  onChange={(e) => setForm({ ...form, debitBankName: e.target.value })}
                  placeholder="Optional"
                />
              </Tile>
              <Tile label="Account (masked)">
                <input
                  className="input"
                  value={form.debitAccountMasked}
                  onChange={(e) =>
                    setForm({ ...form, debitAccountMasked: e.target.value })
                  }
                  placeholder="XXXX1234"
                />
              </Tile>
            </div>
            {/* Downpayment — create-time only. Hidden on edit per V1 scope. */}
            {!isEdit && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Tile label="Downpayment paid (₹)">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="any"
                    className="input"
                    value={form.downpaymentAmount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        downpaymentAmount: e.target.value.replace(/[^\d.]/g, ""),
                      })
                    }
                    placeholder="0 (skip)"
                  />
                </Tile>
                <Tile label="Date of downpayment">
                  <input
                    type="date"
                    className={`input ${dpDateMissing ? "border-red-300 focus:border-red-400" : ""}`}
                    value={form.downpaymentDate}
                    onChange={(e) =>
                      setForm({ ...form, downpaymentDate: e.target.value })
                    }
                    disabled={!dpDateRequired}
                  />
                  <p
                    className={`mt-1 text-[10px] leading-snug ${
                      dpDateMissing
                        ? "text-red-500"
                        : "text-gray-400 dark:text-white/40"
                    }`}
                  >
                    {dpDateMissing
                      ? "Required when a downpayment amount is set"
                      : dpAmtNum > 0
                        ? new Date(form.downpaymentDate || Date.now()).getTime() >
                          Date.now()
                          ? "Future date — will be recorded as a scheduled downpayment."
                          : "Past/today date — will appear in Expenses for that month."
                        : "Leave both blank to skip the downpayment."}
                  </p>
                </Tile>
              </div>
            )}
            <Tile label="Notes">
              <textarea
                className="input min-h-[60px] py-2"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
                maxLength={500}
              />
            </Tile>

            {/* Amortization-sheet files — shown in both create and edit
                modes. In edit mode the current files are listed and can be
                removed inline; new files queue up and upload when Save is
                clicked. */}
            <Tile label="Schedule documents">
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-3 space-y-2">
                {existingFiles.length === 0 && pendingFiles.length === 0 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    No schedule documents on this plan yet.
                  </p>
                )}
                {existingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {existingFiles.map((url, idx) => {
                      const ext = (url.split("?")[0].split(".").pop() ?? "file").toUpperCase();
                      return (
                        <span
                          key={`${url}-${idx}`}
                          className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200"
                        >
                          <FileText className="w-3 h-3 text-gray-400" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold hover:text-yellow-700 dark:hover:text-yellow-400 inline-flex items-center gap-0.5"
                            title="Open file"
                          >
                            {ext}
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExistingFile(url)}
                            disabled={scheduleBusy || saving}
                            title="Remove file"
                            className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingFiles.map((f, idx) => (
                      <span
                        key={`pending-${f.name}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-md bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 text-[11px]"
                      >
                        <FileText className="w-3 h-3 opacity-70" />
                        <span className="truncate max-w-[160px]">{f.name}</span>
                        <span className="text-[9px] font-bold uppercase opacity-70">
                          Pending
                        </span>
                        <button
                          type="button"
                          onClick={() => dropPendingFile(idx)}
                          disabled={saving}
                          title="Drop from upload queue"
                          className="text-current opacity-60 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-1 truncate">
                    {pendingFiles.length === 0
                      ? "Add amortization sheets — PDF, JPG, PNG"
                      : `${pendingFiles.length} new file${pendingFiles.length === 1 ? "" : "s"} will upload on save`}
                  </span>
                  <label className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                    {existingFiles.length + pendingFiles.length === 0 ? "Browse" : "Add more"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      disabled={saving || scheduleBusy}
                      onChange={(e) => {
                        if (e.target.files) addPendingFiles(e.target.files);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </Tile>

            {scheduleDirty && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                You&apos;ve changed schedule fields. Paid installments stay as-is —
                only unpaid installments will be regenerated with the new values.
                {editPlan && editPlan.paidInstallments > 0 && (
                  <> {editPlan.paidInstallments} installment(s) already paid will not change.</>
                )}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
          <div className="flex gap-2.5 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-semibold text-sm shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving && (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {saving
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create EMI plan"}
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

function Tile({
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
