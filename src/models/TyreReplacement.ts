import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const tyreReplacementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    expenseId: { type: Schema.Types.ObjectId, ref: "Expense", index: true, default: null },
    date: { type: Date, required: true },
    odometerKm: { type: Number, required: true, min: 0 },
    brand: { type: String, required: true, trim: true, maxlength: 80 },
    tyreCount: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, default: null, maxlength: 300 },
  },
  { timestamps: true },
);

tyreReplacementSchema.index({ tenantId: 1, vehicleId: 1, date: -1 });

export type TyreReplacementAttrs = InferSchemaType<typeof tyreReplacementSchema>;

export const TyreReplacement: Model<TyreReplacementAttrs> =
  (models.TyreReplacement as Model<TyreReplacementAttrs>) ??
  model<TyreReplacementAttrs>("TyreReplacement", tyreReplacementSchema);
