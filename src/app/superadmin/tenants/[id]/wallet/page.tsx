"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { superadminAPI } from "@/lib/api";
import {
  ArrowLeft,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Filter,
  X,
  Calendar,
  IndianRupee,
} from "lucide-react";

type BillingStatus = "ACTIVE" | "PAYMENT_DUE" | "SUSPENDED";
type WalletReason =
  | "signup_bonus"
  | "monthly_bill"
  | "recharge"
  | "refund"
  | "adjustment";

type Overview = {
  tenant: { id: string; name: string; slug: string };
  wallet: {
    balance: number;
    billingStatus: BillingStatus;
    paymentDueSince: string | null;
    lastBilledAt: string | null;
    totalCredits: number;
    totalDebits: number;
    totalTransactions: number;
  };
};

type Txn = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceAfter: number;
  reason: WalletReason;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
};

const REASON_LABELS: Record<WalletReason, string> = {
  signup_bonus: "Signup bonus",
  monthly_bill: "Monthly bill",
  recharge: "Recharge",
  refund: "Refund",
  adjustment: "Adjustment",
};

const STATUS_THEME: Record<
  BillingStatus,
  { label: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  ACTIVE: {
    label: "Active",
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  PAYMENT_DUE: {
    label: "Payment due",
    bg: "bg-amber-100 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  SUSPENDED: {
    label: "Suspended",
    bg: "bg-red-100 dark:bg-red-500/15",
    text: "text-red-700 dark:text-red-300",
    Icon: Ban,
  },
};

const fmtINR = (n: number) =>
  `₹${Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}`;

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SuperadminTenantWalletPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = String(params?.id ?? "");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [txns, setTxns] = useState<Txn[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterReason, setFilterReason] = useState<WalletReason | "">("");
  const [filterType, setFilterType] = useState<"CREDIT" | "DEBIT" | "">("");

  const [action, setAction] = useState<"credit" | "debit" | null>(null);

  const loadOverview = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!tenantId) return;
      if (mode === "refresh") setRefreshing(true);
      try {
        const res = await superadminAPI.getTenantWallet(tenantId);
        setOverview(res.data.data as Overview);
      } catch (err) {
        console.error("[superadmin wallet] overview failed:", err);
      } finally {
        if (mode === "initial") setLoadingOverview(false);
        else setRefreshing(false);
      }
    },
    [tenantId],
  );

  const loadTxns = useCallback(async () => {
    if (!tenantId) return;
    setLoadingTxns(true);
    try {
      const res = await superadminAPI.listTenantWalletTransactions(tenantId, {
        limit: 100,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        reason: filterReason || undefined,
        type: filterType || undefined,
      });
      setTxns(res.data.data as Txn[]);
    } catch (err) {
      console.error("[superadmin wallet] transactions failed:", err);
      setTxns([]);
    } finally {
      setLoadingTxns(false);
    }
  }, [tenantId, filterFrom, filterTo, filterReason, filterType]);

  useEffect(() => {
    void loadOverview("initial");
  }, [loadOverview]);

  useEffect(() => {
    void loadTxns();
  }, [loadTxns]);

  const onActionDone = useCallback(() => {
    setAction(null);
    // Refresh both panels so the new txn + new balance + new totals appear.
    void loadOverview("refresh");
    void loadTxns();
  }, [loadOverview, loadTxns]);

  const clearFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setFilterReason("");
    setFilterType("");
  };

  const filtersActive =
    Boolean(filterFrom) ||
    Boolean(filterTo) ||
    Boolean(filterReason) ||
    Boolean(filterType);

  const status = overview?.wallet.billingStatus ?? "ACTIVE";
  const theme = STATUS_THEME[status];

  if (loadingOverview) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-7 w-40 animate-pulse rounded bg-gray-200/70 dark:bg-gray-700/40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb / header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/superadmin/tenants/${tenantId}`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            aria-label="Back to tenant"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-yellow-500" />
              <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                Wallet
              </h1>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Link
                href={`/superadmin/tenants/${tenantId}`}
                className="font-semibold text-gray-700 dark:text-gray-300 hover:underline"
              >
                {overview?.tenant.name ?? "Tenant"}
              </Link>{" "}
              · {overview?.tenant.slug ?? ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadOverview("refresh")}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setAction("debit")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-300 dark:hover:bg-red-500/15"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            Debit
          </button>
          <button
            type="button"
            onClick={() => setAction("credit")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-xs font-bold text-white shadow shadow-emerald-500/20 hover:shadow-emerald-500/40"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Credit
          </button>
        </div>
      </div>

      {/* Tile row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <BalanceTile balance={overview?.wallet.balance ?? 0} />
        <StatusTile
          status={status}
          theme={theme}
          lastBilledAt={overview?.wallet.lastBilledAt ?? null}
          paymentDueSince={overview?.wallet.paymentDueSince ?? null}
        />
        <Tile
          label="Total credits"
          value={fmtINR(overview?.wallet.totalCredits ?? 0)}
          sub={`across ${overview?.wallet.totalTransactions ?? 0} transactions`}
          tone="emerald"
        />
        <Tile
          label="Total debits"
          value={fmtINR(overview?.wallet.totalDebits ?? 0)}
          sub="lifetime"
          tone="red"
        />
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02]">
        <div className="flex flex-col gap-3 border-b border-gray-100 dark:border-gray-800 p-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            Transaction history
            <span className="ml-1.5 text-xs font-medium text-gray-400">
              ({txns.length})
            </span>
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="From">
              <input
                type="date"
                value={filterFrom}
                max={filterTo || undefined}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={filterTo}
                min={filterFrom || undefined}
                onChange={(e) => setFilterTo(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </Field>
            <Field label="Type">
              <select
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "" | "CREDIT" | "DEBIT")
                }
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All</option>
                <option value="CREDIT">Credits</option>
                <option value="DEBIT">Debits</option>
              </select>
            </Field>
            <Field label="Reason">
              <select
                value={filterReason}
                onChange={(e) =>
                  setFilterReason(e.target.value as WalletReason | "")
                }
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All</option>
                {(Object.keys(REASON_LABELS) as WalletReason[]).map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 h-8"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {loadingTxns ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading…</div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400">
            {filtersActive
              ? "No transactions match the selected filters."
              : "This tenant has no wallet transactions yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance after</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Initiated by</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {txns.map((t) => {
                  const isCredit = t.type === "CREDIT";
                  const actor = (t.metadata?.actor as string | undefined) ?? null;
                  const note = (t.metadata?.note as string | undefined) ?? null;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                        {fmtDateTime(t.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isCredit
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownToLine className="w-3 h-3" />
                          ) : (
                            <ArrowUpFromLine className="w-3 h-3" />
                          )}
                          {t.type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-bold ${
                          isCredit
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isCredit ? "+" : "-"}
                        {fmtINR(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        {fmtINR(t.balanceAfter)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                        {REASON_LABELS[t.reason]}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {actor === "superadmin" ? (
                          <span className="inline-flex items-center gap-1 text-yellow-700 dark:text-yellow-400">
                            Super admin
                          </span>
                        ) : t.createdBy ? (
                          <span className="font-mono text-[10px]">
                            {t.createdBy.slice(-8)}
                          </span>
                        ) : (
                          <span className="italic">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[280px]">
                        {note ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action modal */}
      {action && overview && (
        <WalletActionModal
          mode={action}
          tenantId={tenantId}
          tenantName={overview.tenant.name}
          currentBalance={overview.wallet.balance}
          onClose={() => setAction(null)}
          onDone={onActionDone}
        />
      )}
    </div>
  );
}

// ── Tiles ──────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "red" | "neutral";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className={`mt-2 text-xl font-black ${toneClass}`}>{value}</p>
      {sub && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          {sub}
        </p>
      )}
    </div>
  );
}

function BalanceTile({ balance }: { balance: number }) {
  const isNeg = balance < 0;
  return (
    <div
      className={`rounded-xl border p-4 ${
        isNeg
          ? "border-red-200/80 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10"
          : "border-yellow-200/80 bg-gradient-to-br from-yellow-50 to-amber-50 dark:border-yellow-500/30 dark:from-yellow-500/10 dark:to-amber-500/10"
      }`}
    >
      <div className="flex items-start justify-between">
        <p
          className={`text-[10px] font-bold uppercase tracking-wider ${
            isNeg
              ? "text-red-700 dark:text-red-300"
              : "text-yellow-700 dark:text-yellow-300"
          }`}
        >
          Wallet balance
        </p>
        <IndianRupee
          className={`w-4 h-4 ${
            isNeg
              ? "text-red-500"
              : "text-yellow-500"
          }`}
        />
      </div>
      <p
        className={`mt-2 text-2xl font-black ${
          isNeg
            ? "text-red-700 dark:text-red-300"
            : "text-gray-900 dark:text-white"
        }`}
      >
        {fmtINR(balance)}
      </p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        Cached on Tenant.walletBalance
      </p>
    </div>
  );
}

function StatusTile({
  status,
  theme,
  lastBilledAt,
  paymentDueSince,
}: {
  status: BillingStatus;
  theme: (typeof STATUS_THEME)[BillingStatus];
  lastBilledAt: string | null;
  paymentDueSince: string | null;
}) {
  const { Icon } = theme;
  return (
    <div className="rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-white/[0.02] p-4">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Billing status
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${theme.bg} ${theme.text}`}
        >
          <Icon className="w-3 h-3" />
          {theme.label}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
        <p className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          Last billed: {fmtDateTime(lastBilledAt)}
        </p>
        {status !== "ACTIVE" && (
          <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            Payment due since: {fmtDateTime(paymentDueSince)}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <Filter className="w-3 h-3" />
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Modal ──────────────────────────────────────────────────────

function WalletActionModal({
  mode,
  tenantId,
  tenantName,
  currentBalance,
  onClose,
  onDone,
}: {
  mode: "credit" | "debit";
  tenantId: string;
  tenantName: string;
  currentBalance: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const isCredit = mode === "credit";
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"adjustment" | "refund" | "recharge">(
    isCredit ? "adjustment" : "adjustment",
  );
  const [notes, setNotes] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= 10_000_000;
  const wouldGoNegative = !isCredit && parsedAmount > currentBalance;
  const debitBlocked = wouldGoNegative && !allowNegative;

  const projected = isCredit
    ? currentBalance + (parsedAmount || 0)
    : currentBalance - (parsedAmount || 0);

  const onSubmit = async () => {
    if (submitting) return;
    if (!amountValid) {
      setError("Enter a positive amount up to ₹1 Cr.");
      return;
    }
    if (debitBlocked) {
      setError(
        "This debit would push the balance below zero. Tick 'Allow negative' if intentional.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isCredit) {
        await superadminAPI.creditTenantWallet(tenantId, {
          amount: parsedAmount,
          reason,
          notes: notes.trim() || undefined,
        });
      } else {
        await superadminAPI.debitTenantWallet(tenantId, {
          amount: parsedAmount,
          reason: "adjustment",
          notes: notes.trim() || undefined,
          allowNegative,
        });
      }
      onDone();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        `Could not ${isCredit ? "credit" : "debit"} the wallet`;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between rounded-t-2xl px-5 py-4 ${
            isCredit
              ? "bg-gradient-to-r from-emerald-500 to-green-600"
              : "bg-gradient-to-r from-red-500 to-rose-600"
          } text-white`}
        >
          <div className="flex items-center gap-2">
            {isCredit ? (
              <ArrowDownToLine className="w-4 h-4" />
            ) : (
              <ArrowUpFromLine className="w-4 h-4" />
            )}
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {isCredit ? "Credit wallet" : "Debit wallet"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tenant
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              {tenantName}
            </p>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Current balance:{" "}
              <span className="font-mono font-bold">{fmtINR(currentBalance)}</span>
            </p>
          </div>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Amount (₹) <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder="e.g. 5000"
              className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {amountValid && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Projected balance:{" "}
                <span
                  className={`font-mono font-bold ${
                    projected < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-800 dark:text-white"
                  }`}
                >
                  {fmtINR(projected)}
                </span>
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Reason <span className="text-red-500">*</span>
            </span>
            <select
              value={reason}
              onChange={(e) =>
                setReason(
                  e.target.value as "adjustment" | "refund" | "recharge",
                )
              }
              disabled={!isCredit}
              className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-yellow-400 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="adjustment">Adjustment</option>
              {isCredit && <option value="refund">Refund</option>}
              {isCredit && <option value="recharge">Recharge</option>}
            </select>
            {!isCredit && (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                Debits are recorded as Adjustment. Monthly billing is owned by
                the cron.
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Visible to the tenant admin in their wallet history. Optional."
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-1 text-right text-[10px] text-gray-400">
              {notes.length}/500
            </p>
          </label>

          {!isCredit && wouldGoNegative && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <input
                type="checkbox"
                checked={allowNegative}
                onChange={(e) => setAllowNegative(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-bold">Allow negative balance.</span> This
                debit will push the wallet below zero. The tenant will move to
                PAYMENT_DUE and may be SUSPENDED after 30 days.
              </span>
            </label>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting || !amountValid || debitBlocked}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow disabled:opacity-50 disabled:cursor-not-allowed ${
              isCredit
                ? "bg-gradient-to-r from-emerald-500 to-green-600 shadow-emerald-500/20 hover:shadow-emerald-500/40"
                : "bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/20 hover:shadow-red-500/40"
            }`}
          >
            {submitting
              ? "Working…"
              : isCredit
                ? "Credit wallet"
                : "Debit wallet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Local copy of fmtINR for the modal scope (the page-level one is hoisted
// above the components but TS prefers the explicit alias inside the modal
// function).
function fmtINRLocal(n: number) {
  return fmtINR(n);
}
void fmtINRLocal; // satisfy "declared but never used" if treeshake misreads it
