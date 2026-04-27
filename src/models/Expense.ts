import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const EXPENSE_CATEGORIES = [
  "CHALLAN",
  "SERVICE",
  "COMPLIANCE",
  "FASTAG",
] as const;

const expenseSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    expenseDate: { type: Date, required: true, index: true },
    description: { type: String },
    proofUrl: { type: String },
    referenceId: { type: String },
  },
  { timestamps: true },
);

export type ExpenseAttrs = InferSchemaType<typeof expenseSchema>;

export const Expense: Model<ExpenseAttrs> =
  (models.Expense as Model<ExpenseAttrs>) ??
  model<ExpenseAttrs>("Expense", expenseSchema);
