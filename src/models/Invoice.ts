import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const INVOICE_STATUSES = ["PAID", "UNPAID", "VOID"] as const;

/**
 * Snapshot of a single charge against a tenant — generated when the
 * billing orchestrator computes the monthly bill from the active plan +
 * fleet/driver/group counts. The Invoice is immutable once written; the
 * matching WalletTransaction id (paidFromWalletTxnId) closes the loop
 * between "what was billed" and "how it was paid".
 *
 * Why a separate collection from WalletTransaction:
 *   - the wallet log records cash movement (recharge / debit / refund)
 *   - the invoice records WHAT was billed (line items, GST, plan
 *     snapshot, billing period). The two are 1:1 for monthly bills but
 *     the wallet log also covers signup bonuses, manual recharges, and
 *     refunds that don't have an invoice.
 *
 * invoiceNumber is per-tenant sequential: "INV-2026-000001". The combo
 * (tenantId, invoiceNumber) is unique. Issued on PDF download / list.
 */
const invoiceLineItemSchema = new Schema(
  {
    label: { type: String, required: true },
    unitCount: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true, index: true },

    // Plan snapshot — captured at issuance so renaming / re-pricing the
    // plan later doesn't rewrite history.
    planId: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, default: null },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "YEARLY"],
      default: "MONTHLY",
    },

    // The calendar period this bill covers (inclusive). For a monthly
    // run on 2026-06-06, periodStart = 2026-06-01 and periodEnd =
    // 2026-06-30. Surfaced on the PDF as "Billing period".
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    issuedAt: { type: Date, required: true, default: () => new Date() },

    lineItems: { type: [invoiceLineItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: "PAID",
      index: true,
    },
    paidAt: { type: Date, default: null },
    // Link to the WalletTransaction that paid this invoice. Null only
    // when status = UNPAID (wallet debit failed / pre-payment state).
    paidFromWalletTxnId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },
  },
  { timestamps: true },
);

// Per-tenant uniqueness on the invoice number — the sequence generator
// looks up the highest existing number for the tenant before issuing.
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ tenantId: 1, issuedAt: -1 });

export type InvoiceAttrs = InferSchemaType<typeof invoiceSchema>;

if (process.env.NODE_ENV !== "production" && models.Invoice) {
  delete models.Invoice;
}

export const Invoice: Model<InvoiceAttrs> =
  (models.Invoice as Model<InvoiceAttrs>) ??
  model<InvoiceAttrs>("Invoice", invoiceSchema);
