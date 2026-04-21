import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const FASTAG_TXN_TYPES = ["TOLL", "RECHARGE", "REFUND"] as const;

const fastagTransactionSchema = new Schema(
  {
    fastagId: { type: Schema.Types.ObjectId, ref: "Fastag", required: true, index: true },
    type: { type: String, enum: FASTAG_TXN_TYPES, required: true },
    amount: { type: Number, required: true },
    balance: { type: Number, required: true },
    description: { type: String },
    tollPlaza: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type FastagTransactionAttrs = InferSchemaType<typeof fastagTransactionSchema>;

export const FastagTransaction: Model<FastagTransactionAttrs> =
  (models.FastagTransaction as Model<FastagTransactionAttrs>) ??
  model<FastagTransactionAttrs>("FastagTransaction", fastagTransactionSchema);
