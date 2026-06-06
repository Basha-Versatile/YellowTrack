"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/context/ToastContext";
import { useBilling } from "@/context/BillingContext";
import { useAuth } from "@/context/AuthContext";
import { billingAPI } from "@/lib/api";
import { Crown, X, AlertTriangle } from "lucide-react";

const DISMISS_STORAGE_PREFIX = "billing.upgrade.dismiss.";

/**
 * Mounted once in the admin shell. Pops automatically when an open upgrade
 * request lands in BillingContext, and persists across nav until the admin
 * confirms / rejects (or hits "Review later" — which dismisses for THIS
 * request id only). The persistent header banner still nags them after
 * dismissal so it can't be missed indefinitely.
 *
 * Non-ADMIN users never see the modal (they can't decide anyway) — they
 * see the banner pointing them at /billing.
 */
export function UpgradeConfirmationModal() {
  const toast = useToast();
  const { overview, refresh } = useBilling();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"APPROVE" | "REJECT" | null>(null);

  const pending = overview?.pendingUpgrade ?? null;
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!pending || !isAdmin) {
      setOpen(false);
      return;
    }
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(
      `${DISMISS_STORAGE_PREFIX}${pending.id}`,
    );
    if (dismissed) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [pending, isAdmin]);

  if (!pending || !isAdmin) return null;

  const closeForNow = () => {
    setOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`${DISMISS_STORAGE_PREFIX}${pending.id}`, "1");
    }
  };

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setSubmitting(decision === "APPROVED" ? "APPROVE" : "REJECT");
    try {
      await billingAPI.decideUpgrade(pending.id, decision);
      toast.success(
        decision === "APPROVED" ? "Plan upgraded" : "Upgrade rejected",
        decision === "APPROVED"
          ? `Now on the ${pending.toPlan.name} plan`
          : "You'll keep your current plan",
      );
      // Once decided the request leaves the overview — clear the dismiss
      // marker so future requests pop fresh.
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${DISMISS_STORAGE_PREFIX}${pending.id}`);
      }
      await refresh();
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Decision failed";
      toast.error("Could not record decision", msg);
    } finally {
      setSubmitting(null);
    }
  };

  const expires = new Date(pending.expiresAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Modal
      isOpen={open}
      onClose={submitting ? () => {} : closeForNow}
      className="w-[92%] max-w-[480px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
    >
      <div className="flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
            <Crown className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Plan upgrade required
            </h3>
            <p className="text-[11px] text-gray-400">
              Decide before {expires} or the request expires
            </p>
          </div>
          <button
            type="button"
            onClick={closeForNow}
            disabled={Boolean(submitting)}
            title="Close (request stays pending)"
            className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Your fleet has grown to{" "}
              <strong>{pending.vehicleCountAtTrigger} vehicles</strong>, which puts
              you on a higher plan tier.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PlanCard
              tone="muted"
              label="Current plan"
              name={pending.fromPlan?.name ?? "(none)"}
            />
            <PlanCard
              tone="active"
              label="Suggested plan"
              name={pending.toPlan.name}
            />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Next month&apos;s bill picks up the new rate. You can review the
            full plan breakdown on the billing page.
          </p>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => decide("REJECTED")}
            disabled={Boolean(submitting)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {submitting === "REJECT" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={closeForNow}
            disabled={Boolean(submitting)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Review later
          </button>
          <button
            type="button"
            onClick={() => decide("APPROVED")}
            disabled={Boolean(submitting)}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2 justify-center"
          >
            {submitting === "APPROVE" ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : null}
            Confirm upgrade
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PlanCard({
  tone,
  label,
  name,
}: {
  tone: "muted" | "active";
  label: string;
  name: string;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        tone === "active"
          ? "border-yellow-300 bg-yellow-50/60 dark:border-yellow-500/30 dark:bg-yellow-500/10"
          : "border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold ${
          tone === "active"
            ? "text-yellow-800 dark:text-yellow-300"
            : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {name}
      </p>
    </div>
  );
}
