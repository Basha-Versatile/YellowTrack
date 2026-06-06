"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  Crown,
  TrendingUp,
  Receipt,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Download,
  FileText,
} from "lucide-react";
import { useBilling } from "@/context/BillingContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { billingAPI, getAccessToken } from "@/lib/api";
import { RechargeWalletModal } from "@/components/billing/RechargeWalletModal";

type Txn = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceAfter: number;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  planName: string | null;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  total: number;
  status: "PAID" | "UNPAID" | "VOID";
};

const REASON_LABEL: Record<string, string> = {
  signup_bonus: "Signup bonus",
  monthly_bill: "Monthly bill",
  recharge: "Recharge",
  refund: "Refund",
  adjustment: "Adjustment",
};

function rupees(n: number, opts?: { signed?: boolean }): string {
  const sign = opts?.signed ? (n >= 0 ? "+" : "−") : "";
  const abs = Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}₹${abs}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BillingPage() {
  const { overview, loading, refresh } = useBilling();
  const { user } = useAuth();
  const toast = useToast();
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<"APPROVE" | "REJECT" | null>(null);

  const loadTxns = useCallback(async () => {
    setTxnsLoading(true);
    try {
      const res = await billingAPI.listTransactions({ limit: 30 });
      setTxns((res.data?.data ?? []) as Txn[]);
    } catch {
      toast.error("Failed to load", "Could not load transaction history");
    } finally {
      setTxnsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await billingAPI.listInvoices({ limit: 30 });
      setInvoices((res.data?.data ?? []) as InvoiceRow[]);
    } catch {
      toast.error("Failed to load", "Could not load invoices");
    } finally {
      setInvoicesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bearer-authenticated PDF download — the route is gated by withRoute
  // so a plain <a href> won't carry the token. Fetch as blob and trigger
  // a synthetic download.
  const handleDownloadInvoice = useCallback(
    async (row: InvoiceRow) => {
      setDownloadingId(row.id);
      try {
        const token = getAccessToken();
        const res = await fetch(billingAPI.invoicePdfUrl(row.id), {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${row.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast.error(
          "Download failed",
          err instanceof Error ? err.message : "Could not download invoice",
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (overview) {
      loadTxns();
      loadInvoices();
    }
  }, [overview, loadTxns, loadInvoices]);

  if (loading && !overview) {
    return <p className="text-sm text-gray-400 text-center py-10">Loading…</p>;
  }
  if (!overview) {
    return (
      <p className="text-sm text-gray-400 text-center py-10">
        Billing isn&apos;t available for this account.
      </p>
    );
  }

  const { tenant, plan, projection, pendingUpgrade } = overview;
  const isAdmin = user?.role === "ADMIN";
  const balance = tenant.walletBalance;

  const handleDecide = async (decision: "APPROVED" | "REJECTED") => {
    if (!pendingUpgrade) return;
    setDeciding(decision === "APPROVED" ? "APPROVE" : "REJECT");
    try {
      await billingAPI.decideUpgrade(pendingUpgrade.id, decision);
      toast.success(
        decision === "APPROVED" ? "Plan upgraded" : "Upgrade rejected",
        decision === "APPROVED"
          ? `Now on the ${pendingUpgrade.toPlan.name} plan`
          : "Keeping current plan",
      );
      await refresh();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Decision failed";
      toast.error("Could not record decision", msg);
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-yellow-500" />
            Billing &amp; Wallet
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your plan, top up the wallet, and review monthly debits.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Pending upgrade callout */}
      {pendingUpgrade && (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50/70 dark:border-yellow-500/30 dark:bg-yellow-500/10 p-5">
          <div className="flex items-start gap-3">
            <Crown className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-yellow-900 dark:text-yellow-300">
                Plan upgrade pending — {pendingUpgrade.toPlan.name}
              </p>
              <p className="mt-1 text-xs text-yellow-900/80 dark:text-yellow-200/80">
                Your fleet has grown to{" "}
                <strong>{pendingUpgrade.vehicleCountAtTrigger} vehicles</strong>.
                Confirm the upgrade to {pendingUpgrade.toPlan.name} (currently
                on {pendingUpgrade.fromPlan?.name ?? "no plan"}) before{" "}
                {formatDate(pendingUpgrade.expiresAt)}.
              </p>
              {isAdmin && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecide("APPROVED")}
                    disabled={Boolean(deciding)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {deciding === "APPROVE" ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Confirm upgrade
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecide("REJECTED")}
                    disabled={Boolean(deciding)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-red-700 dark:text-red-400 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
              {!isAdmin && (
                <p className="mt-2 text-[11px] italic text-yellow-800/80 dark:text-yellow-300/80">
                  Only workspace admins can decide plan upgrades.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Wallet card */}
        <div className="lg:col-span-1 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-yellow-500" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Wallet balance
            </p>
          </div>
          <p
            className={`text-3xl font-black ${
              balance < 0
                ? "text-red-600 dark:text-red-400"
                : balance < 100
                  ? "text-red-600 dark:text-red-400"
                  : balance < 500
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-gray-900 dark:text-white"
            }`}
          >
            {rupees(balance)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Status:{" "}
            <span
              className={
                tenant.billingStatus === "SUSPENDED"
                  ? "font-semibold text-red-700 dark:text-red-400"
                  : tenant.billingStatus === "PAYMENT_DUE"
                    ? "font-semibold text-amber-700 dark:text-amber-400"
                    : "font-semibold text-emerald-700 dark:text-emerald-400"
              }
            >
              {tenant.billingStatus.replace("_", " ").toLowerCase()}
            </span>
            {tenant.lastBilledAt && (
              <> · Last billed {formatDate(tenant.lastBilledAt)}</>
            )}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setRechargeOpen(true)}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-2.5 text-sm font-bold text-white shadow shadow-yellow-500/25 hover:shadow-yellow-500/40"
            >
              <Plus className="w-3.5 h-3.5" /> Add credits
            </button>
          )}
        </div>

        {/* Current plan card */}
        <div className="lg:col-span-1 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-yellow-500" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Current plan
            </p>
          </div>
          {plan ? (
            <>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {plan.name}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                Fleet band:{" "}
                {plan.fleetSizeMin}
                {plan.fleetSizeMax !== null ? `–${plan.fleetSizeMax}` : "+"}{" "}
                vehicles · {tenant.billingCycle.toLowerCase()} billing
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <Rate label="Per vehicle / month" value={rupees(plan.perVehiclePerMonth)} />
                <Rate label="Per vehicle / year" value={rupees(plan.perVehiclePerYear)} />
                <Rate label="Per driver / month" value={rupees(plan.perDriverPerMonth)} />
                <Rate label="Per group / month" value={rupees(plan.customComplianceGroupPerMonth)} />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No plan assigned yet. Auto-assignment runs daily based on fleet size.
              </p>
            </div>
          )}
        </div>

        {/* Next bill projection */}
        <div className="lg:col-span-1 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-yellow-500" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Next month estimate
            </p>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">
            {rupees(projection.total)}
          </p>
          {projection.lineItems.length > 0 ? (
            <div className="mt-3 space-y-1.5 text-[11px]">
              {projection.lineItems.map((li, idx) => (
                <div
                  key={`${li.label}-${idx}`}
                  className="flex justify-between items-baseline"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    {li.label} ({li.unitCount} × {rupees(li.unitPrice)})
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rupees(li.amount)}
                  </span>
                </div>
              ))}
              {projection.gstAmount > 0 && (
                <div className="flex justify-between items-baseline pt-1 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    GST ({projection.gstPercent}%)
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {rupees(projection.gstAmount)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-gray-400">
              Nothing to bill — no plan or no usage yet.
            </p>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Invoices
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              Auto-generated each month from your plan and usage, settled from wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInvoices}
            className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 hover:underline"
          >
            Reload
          </button>
        </div>
        {invoicesLoading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
        ) : invoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FileText className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No invoices yet — your first one will appear after the next monthly billing run.
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50/40 dark:bg-gray-800/30 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Invoice #</th>
                <th className="px-4 py-2 text-left">Plan</th>
                <th className="px-4 py-2 text-left">Period</th>
                <th className="px-4 py-2 text-left">Issued</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-mono text-gray-900 dark:text-white whitespace-nowrap">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {inv.planName ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(inv.periodStart).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    –{" "}
                    {new Date(inv.periodEnd).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(inv.issuedAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {rupees(inv.total)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : inv.status === "VOID"
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(inv)}
                      disabled={downloadingId === inv.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-[11px] font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className={`w-3.5 h-3.5 ${downloadingId === inv.id ? "animate-pulse" : ""}`} />
                      {downloadingId === inv.id ? "Preparing…" : "PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Transactions */}
      <div className="rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Recent transactions
          </p>
          <button
            type="button"
            onClick={loadTxns}
            className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-400 hover:underline"
          >
            Reload
          </button>
        </div>
        {txnsLoading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
        ) : txns.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Clock className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No transactions yet.
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50/40 dark:bg-gray-800/30 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Reason</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {txns.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(t.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                    {REASON_LABEL[t.reason] ?? t.reason}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${
                      t.type === "CREDIT"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {rupees(t.type === "CREDIT" ? t.amount : -t.amount, { signed: true })}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${
                      t.balanceAfter < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {rupees(t.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {tenant.billingStatus !== "ACTIVE" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Your wallet is in <strong>{tenant.billingStatus.replace("_", " ").toLowerCase()}</strong> state.
            {tenant.billingStatus === "SUSPENDED"
              ? " Writes are blocked across the app until you top up. Read-only access stays open."
              : " Top up to avoid suspension after 30 days of being overdrawn."}
          </span>
        </div>
      )}

      <RechargeWalletModal
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
      />
    </div>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50/60 dark:bg-gray-800/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
