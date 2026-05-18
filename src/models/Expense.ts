import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const EXPENSE_CATEGORIES = [
  "CHALLAN",
  "SERVICE",
  "COMPLIANCE",
  "FASTAG",
  "EMI",
  "INVOICE",
] as const;

const expenseSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    handlingCharges: { type: Number, min: 0, default: 0 },
    expenseDate: { type: Date, required: true, index: true },
    description: { type: String },
    proofUrls: { type: [String], default: [] },
    referenceId: { type: String },
  },
  { timestamps: true },
);

export type ExpenseAttrs = InferSchemaType<typeof expenseSchema>;

export const Expense: Model<ExpenseAttrs> =
  (models.Expense as Model<ExpenseAttrs>) ??
  model<ExpenseAttrs>("Expense", expenseSchema);
