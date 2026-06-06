"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/context/ToastContext";
import { useBilling } from "@/context/BillingContext";
import { billingAPI } from "@/lib/api";
import { Wallet, X, CreditCard, Smartphone, Building2 } from "lucide-react";

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

/**
 * Wallet top-up dialog. The UI shows UPI / Card / Net-banking options as a
 * deliberate preview, but only the test-credit button actually writes to
 * the wallet in v1 — the gateway integrations are stubbed. When Razorpay /
 * Stripe lands, the same `creditWallet` server helper will accept a real
 * payment ref via the gateway branch in /api/billing/wallet/credit.
 */
export function RechargeWalletModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { overview, refresh } = useBilling();
  const [amount, setAmount] = useState<string>("1000");
  const [submitting, setSubmitting] = useState(false);

  const balance = overview?.tenant.walletBalance ?? 0;
  const numericAmount = Number(amount) || 0;
  const valid = numericAmount > 0 && numericAmount <= 1_000_000;

  const handleTestCredit = async () => {
    if (!valid) {
      toast.error("Invalid amount", "Enter an amount between ₹1 and ₹10,00,000");
      return;
    }
    setSubmitting(true);
    try {
      await billingAPI.rechargeTest(numericAmount);
      toast.success("Wallet topped up", `₹${numericAmount.toLocaleString("en-IN")} added`);
      await refresh();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Recharge failed";
      toast.error("Could not recharge", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      className="w-[92%] max-w-[480px] rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
    >
      <div className="flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Recharge wallet
            </h3>
            <p className="text-[11px] text-gray-400">
              Current balance: ₹
              {balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <label className="block">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
              Amount (₹)
            </span>
            <input
              type="number"
              min={1}
              max={1_000_000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="w-full h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-lg font-bold text-gray-800 dark:text-gray-200 focus:border-yellow-400 focus:outline-none focus:ring-3 focus:ring-yellow-400/10 disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((qa) => (
              <button
                key={qa}
                type="button"
                onClick={() => setAmount(String(qa))}
                disabled={submitting}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  Number(amount) === qa
                    ? "border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                ₹{qa.toLocaleString("en-IN")}
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Pay via
            </p>
            <div className="space-y-1.5">
              <GatewayOption icon={<Smartphone className="w-4 h-4" />} label="UPI" />
              <GatewayOption icon={<CreditCard className="w-4 h-4" />} label="Card" />
              <GatewayOption icon={<Building2 className="w-4 h-4" />} label="Net banking" />
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10 px-3 py-2 text-[11px] text-blue-800 dark:text-blue-300">
            Payment gateway integration is pending. Use the test credit button
            below to add funds — when a gateway is wired, the buttons above
            will activate.
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTestCredit}
            disabled={submitting || !valid}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 shadow-sm transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : null}
            Add test credit
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GatewayOption({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60">
      <input type="radio" disabled className="opacity-50" />
      <span className="flex items-center gap-2 flex-1">
        {icon}
        {label}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Coming soon
      </span>
    </label>
  );
}
