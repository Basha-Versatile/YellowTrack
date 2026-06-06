import "server-only";
import { Tenant, WalletTransaction } from "@/models";
import { BadRequestError, NotFoundError } from "@/lib/errors";

export const SIGNUP_BONUS_AMOUNT = 1000;

type WalletReason =
  | "signup_bonus"
  | "monthly_bill"
  | "recharge"
  | "refund"
  | "adjustment";

type WalletWriteInput = {
  tenantId: string;
  amount: number;
  reason: WalletReason;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

type WalletTxnRow = {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceAfter: number;
  reason: WalletReason;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
};

/**
 * Atomic credit. Bumps Tenant.walletBalance and writes an immutable
 * WalletTransaction row keyed to the new balance. Callers shouldn't write
 * to the balance directly — every change goes through this path so the
 * transaction log stays the source of truth.
 *
 * Side-effect: a positive balance clears any PAYMENT_DUE state and resets
 * the suspension timer. The orchestrator owns the inverse (debit-side)
 * health updates.
 */
export async function creditWallet(input: WalletWriteInput): Promise<{
  balance: number;
  txnId: string;
}> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new BadRequestError("Credit amount must be a positive number");
  }
  const updated = await Tenant.findByIdAndUpdate(
    input.tenantId,
    { $inc: { walletBalance: input.amount } },
    { new: true, select: "walletBalance billingStatus paymentDueSince" },
  ).lean();
  if (!updated) throw new NotFoundError("Tenant not found");

  // Clear payment-due state once the balance lands back in the black.
  const balance = (updated as { walletBalance: number }).walletBalance;
  if (
    balance >= 0 &&
    ((updated as { billingStatus?: string }).billingStatus ?? "ACTIVE") !== "ACTIVE"
  ) {
    await Tenant.updateOne(
      { _id: input.tenantId },
      {
        $set: {
          billingStatus: "ACTIVE",
          paymentDueSince: null,
        },
      },
    );
  }

  const txn = await WalletTransaction.create({
    tenantId: input.tenantId,
    type: "CREDIT",
    amount: input.amount,
    balanceAfter: balance,
    reason: input.reason,
    metadata: input.metadata ?? null,
    createdBy: input.createdBy ?? null,
  });

  return { balance, txnId: String((txn as { _id: unknown })._id) };
}

/**
 * Atomic debit. Always succeeds at the persistence layer — the wallet is
 * allowed to go negative (that's how PAYMENT_DUE → SUSPENDED escalation
 * is triggered, owned by the billing orchestrator). Returns the new
 * balance so the caller can decide whether to short-circuit.
 */
export async function debitWallet(input: WalletWriteInput): Promise<{
  balance: number;
  txnId: string;
}> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new BadRequestError("Debit amount must be a positive number");
  }
  const updated = await Tenant.findByIdAndUpdate(
    input.tenantId,
    { $inc: { walletBalance: -input.amount } },
    { new: true, select: "walletBalance" },
  ).lean();
  if (!updated) throw new NotFoundError("Tenant not found");
  const balance = (updated as { walletBalance: number }).walletBalance;

  const txn = await WalletTransaction.create({
    tenantId: input.tenantId,
    type: "DEBIT",
    amount: input.amount,
    balanceAfter: balance,
    reason: input.reason,
    metadata: input.metadata ?? null,
    createdBy: input.createdBy ?? null,
  });

  return { balance, txnId: String((txn as { _id: unknown })._id) };
}

export async function getWalletBalance(tenantId: string): Promise<number> {
  const t = await Tenant.findById(tenantId).select("walletBalance").lean();
  return (t as { walletBalance?: number } | null)?.walletBalance ?? 0;
}

export async function listTransactions(
  tenantId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<WalletTxnRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const filter: Record<string, unknown> = { tenantId };
  if (opts.before) filter.createdAt = { $lt: opts.before };
  const rows = await WalletTransaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => {
    const row = r as unknown as {
      _id: { toString(): string };
      type: "CREDIT" | "DEBIT";
      amount: number;
      balanceAfter: number;
      reason: WalletReason;
      metadata: Record<string, unknown> | null;
      createdBy?: { toString(): string } | null;
      createdAt: Date;
    };
    return {
      id: String(row._id),
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      reason: row.reason,
      metadata: row.metadata ?? null,
      createdBy: row.createdBy ? String(row.createdBy) : null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/**
 * One-shot helper for tenant onboarding. Idempotent — if the tenant
 * already has a signup_bonus row, this is a no-op. Safe to call from
 * createTenant even on retries.
 */
export async function grantSignupBonus(tenantId: string): Promise<void> {
  const already = await WalletTransaction.exists({
    tenantId,
    reason: "signup_bonus",
  });
  if (already) return;
  await creditWallet({
    tenantId,
    amount: SIGNUP_BONUS_AMOUNT,
    reason: "signup_bonus",
    metadata: { note: "Welcome credit from Yellow Track" },
  });
}
