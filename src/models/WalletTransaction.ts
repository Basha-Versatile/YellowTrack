import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const WALLET_TXN_TYPES = ["CREDIT", "DEBIT"] as const;
export const WALLET_TXN_REASONS = [
  "signup_bonus",
  "monthly_bill",
  "recharge",
  "refund",
  "adjustment",
] as const;

/**
 * Append-only log of every change to Tenant.walletBalance. The collection
 * is the audit trail — never updated after insert — so reconstructing a
 * tenant's balance from `sum(credits) - sum(debits)` should always equal
 * the cached `Tenant.walletBalance`.
 *
 * `balanceAfter` is denormalised at write time so transaction lists render
 * without rolling-summing on the client.
 */
const walletTransactionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    type: { type: String, enum: WALLET_TXN_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: WALLET_TXN_REASONS, required: true },
    // Free-form context (planSnapshot, vehicle/driver/group counts, payment
    // gateway ref, etc). Surfaces in the transaction-detail row.
    metadata: { type: Schema.Types.Mixed, default: null },
    // Null when the system / cron initiated the change.
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

walletTransactionSchema.index({ tenantId: 1, createdAt: -1 });

export type WalletTransactionAttrs = InferSchemaType<typeof walletTransactionSchema>;

if (process.env.NODE_ENV !== "production" && models.WalletTransaction) {
  delete models.WalletTransaction;
}

export const WalletTransaction: Model<WalletTransactionAttrs> =
  (models.WalletTransaction as Model<WalletTransactionAttrs>) ??
  model<WalletTransactionAttrs>("WalletTransaction", walletTransactionSchema);
