import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/**
 * Append-only audit of paid credit-card statements. One row is written each
 * time a card's current bill is marked paid, capturing the month + amount.
 * Lets the section build a real monthly-expense record over time (and power
 * "average over last N months" later) without a bank feed.
 */

const creditCardBillHistorySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    cardId: {
      type: Schema.Types.ObjectId,
      ref: "CreditCard",
      required: true,
      index: true,
    },
    // YYYY-MM statement month this payment settled.
    billMonth: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

creditCardBillHistorySchema.index({ tenantId: 1, cardId: 1, billMonth: 1 });

export type CreditCardBillHistoryAttrs = InferSchemaType<
  typeof creditCardBillHistorySchema
>;

export const CreditCardBillHistory: Model<CreditCardBillHistoryAttrs> =
  (models.CreditCardBillHistory as Model<CreditCardBillHistoryAttrs>) ??
  model<CreditCardBillHistoryAttrs>(
    "CreditCardBillHistory",
    creditCardBillHistorySchema,
  );
