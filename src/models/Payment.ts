import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const PAYMENT_METHODS = ["UPI", "CARD", "CASH", "NETBANKING"] as const;
export const PAYMENT_STATUS = ["SUCCESS", "FAILED", "PENDING"] as const;

const paymentSchema = new Schema(
  {
    totalAmount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionId: { type: String },
    status: { type: String, enum: PAYMENT_STATUS, default: "SUCCESS" },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type PaymentAttrs = InferSchemaType<typeof paymentSchema>;

export const Payment: Model<PaymentAttrs> =
  (models.Payment as Model<PaymentAttrs>) ??
  model<PaymentAttrs>("Payment", paymentSchema);
