"use client";

import Link from "next/link";
import { useBilling } from "@/context/BillingContext";
import { Wallet, Plus, AlertTriangle } from "lucide-react";

/**
 * Header pill rendered in AppHeader — wallet-only.
 *
 * The current plan name moved into the user dropdown (UserDropdown.tsx)
 * to keep the header chrome compact; this pill focuses on the wallet
 * because that's the value users want at-a-glance and act on (recharge).
 *
 * Hidden for SUPERADMIN sessions or before the overview lands. Click
 * routes to /billing where the recharge modal can be opened.
 */
export function WalletPlanBadge() {
  const { overview, loading } = useBilling();

  if (loading && !overview) {
    return (
      <div className="hidden sm:flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 px-3 py-1.5">
        <span className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }
  if (!overview) return null;

  const balance = overview.tenant.walletBalance;
  const status = overview.tenant.billingStatus;

  // Colour ladder: green > 500, amber 100–500, red 0–100, dark red < 0.
  const walletTint =
    balance < 0
      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
      : balance < 100
        ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
        : balance < 500
          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";

  return (
    <Link
      href="/billing"
      className={`hidden sm:flex items-center gap-2 rounded-xl px-3 py-1.5 border border-transparent hover:border-current/20 transition-colors ${walletTint}`}
      title="Open billing"
    >
      <Wallet className="w-3.5 h-3.5" />
      <div className="leading-tight">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          Wallet
        </p>
        <p className="text-xs font-bold">
          ₹
          {balance.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
      {status === "SUSPENDED" || balance < 0 ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <Plus className="w-3.5 h-3.5 opacity-70" />
      )}
    </Link>
  );
}

/**
 * Slim banner shown under the header when billing health needs attention.
 * Persistent until resolved (recharge, decide pending upgrade, etc.).
 */
export function BillingStatusBanner() {
  const { overview } = useBilling();
  if (!overview) return null;

  const { tenant, pendingUpgrade } = overview;

  if (tenant.billingStatus === "SUSPENDED") {
    return (
      <div className="bg-red-50 border-b border-red-200 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-2 text-center text-xs font-semibold text-red-800 dark:text-red-300">
        Workspace suspended — wallet has been overdrawn for 30+ days.
        Writes are blocked until you{" "}
        <Link href="/billing" className="underline hover:no-underline">
          recharge the wallet
        </Link>
        .
      </div>
    );
  }
  if (tenant.billingStatus === "PAYMENT_DUE") {
    return (
      <div className="bg-amber-50 border-b border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">
        Payment due — wallet is overdrawn. Top up to avoid suspension after
        30 days.{" "}
        <Link href="/billing" className="underline hover:no-underline">
          Recharge now
        </Link>
        .
      </div>
    );
  }
  if (pendingUpgrade) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/30 px-4 py-2 text-center text-xs font-semibold text-yellow-900 dark:text-yellow-300">
        Plan upgrade pending — your fleet has grown to{" "}
        {pendingUpgrade.vehicleCountAtTrigger} vehicles.{" "}
        <Link href="/billing" className="underline hover:no-underline">
          Review & confirm
        </Link>{" "}
        before{" "}
        {new Date(pendingUpgrade.expiresAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })}
        .
      </div>
    );
  }
  return null;
}
