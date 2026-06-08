import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

export const EMI_PAYMENT_STATUSES = [
  "SCHEDULED",
  "PAID",
  "OVERDUE",
  "PARTIAL",
  "SKIPPED",
  "BOUNCED",
] as const;

const emiPaymentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    emiPlanId: {
      type: Schema.Types.ObjectId,
      ref: "EMIPlan",
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },

    // 0 = downpayment (settled or scheduled at plan creation), 1..N = the
    // regular EMI installments.
    installmentNumber: { type: Number, required: true, min: 0 },
    scheduledDate: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },

    paidDate: { type: Date, default: null },
    paidAmount: { type: Number, min: 0, default: null },
    lateFee: { type: Number, min: 0, default: 0 },

    status: {
      type: String,
      enum: EMI_PAYMENT_STATUSES,
      default: "SCHEDULED",
      index: true,
    },

    transactionRef: { type: String, trim: true, default: null },
    proofUrl: { type: String, trim: true, default: null },
    notes: { type: String, trim: true, default: null, maxlength: 300 },

    expenseId: {
      type: Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },

    markedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

emiPaymentSchema.index({ tenantId: 1, vehicleId: 1, scheduledDate: 1 });
emiPaymentSchema.index(
  { emiPlanId: 1, installmentNumber: 1 },
  { unique: true },
);
emiPaymentSchema.index({ tenantId: 1, status: 1, scheduledDate: 1 });

export type EMIPaymentAttrs = InferSchemaType<typeof emiPaymentSchema>;

export const EMIPayment: Model<EMIPaymentAttrs> =
  (models.EMIPayment as Model<EMIPaymentAttrs>) ??
  model<EMIPaymentAttrs>("EMIPayment", emiPaymentSchema);
