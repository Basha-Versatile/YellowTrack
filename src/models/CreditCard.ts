import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/**
 * A manually-tracked credit card bill. No bank API is involved — the operator
 * types in the statement amount each cycle. `billDayOfMonth` / `dueDayOfMonth`
 * are fixed day-of-month integers set once at create time; they recur every
 * month automatically (a card with bill=5, due=25 always generates on the 5th
 * and is due on the 25th).
 *
 * `currentBillAmount` is the only thing that changes per cycle. `currentBillMonth`
 * (YYYY-MM) records which statement that amount belongs to, so the UI can tell
 * the operator when this month's amount hasn't been entered yet, and so `paid`
 * can be scoped to a single cycle. See src/lib/credit-card.ts for the cycle math.
 *
 * Gated behind the per-tenant `creditCardTracking` feature flag.
 */

const creditCardSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    bankName: { type: String, required: true, trim: true },
    // Last 4 digits only — we never store the full PAN. Shown masked as **** 1234.
    last4: { type: String, required: true, trim: true, match: /^\d{4}$/ },
    cardholderName: { type: String, required: true, trim: true },
    // Day-of-month (1-31) the statement is generated. Clamped to month length
    // at read time (e.g. 31 → 28/29/30 in shorter months).
    billDayOfMonth: { type: Number, required: true, min: 1, max: 31 },
    // Day-of-month (1-31) payment is due.
    dueDayOfMonth: { type: Number, required: true, min: 1, max: 31 },
    // Manually entered each cycle by the operator. No bank integration.
    currentBillAmount: { type: Number, default: 0, min: 0 },
    // YYYY-MM of the statement the current amount belongs to. Null until the
    // operator enters the first amount.
    currentBillMonth: { type: String, default: null },
    // Whether the current statement (currentBillMonth) has been marked paid.
    paid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    // Soft-delete flag — kept so bill history stays attributable.
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

creditCardSchema.index({ tenantId: 1, isActive: 1 });

export type CreditCardAttrs = InferSchemaType<typeof creditCardSchema>;

export const CreditCard: Model<CreditCardAttrs> =
  (models.CreditCard as Model<CreditCardAttrs>) ??
  model<CreditCardAttrs>("CreditCard", creditCardSchema);
