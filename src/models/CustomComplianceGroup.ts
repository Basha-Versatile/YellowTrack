import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * A user-defined bucket for arbitrary compliance documents that don't belong
 * to a specific vehicle or driver — e.g. a sister company ("Blue Drive
 * Mobility") whose GST, Labour Licence, Partnership Deed need tracking, or a
 * category like "Company Agreements".
 *
 * Documents inside a group each carry their own expiry, so the same dashboard
 * mechanics that surface vehicle compliance drift also work here.
 */
const customComplianceGroupSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: null, maxlength: 500 },
    // Display tint used by the group card / chip; falls back to a neutral
    // palette in the UI when null.
    color: { type: String, trim: true, default: null, maxlength: 40 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Soft delete — keeps documents queryable for audit if needed, but the
    // group disappears from list/detail screens.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

// Tenant-scoped uniqueness on name; partial filter so soft-deleted rows don't
// block re-creating a group with the same label.
customComplianceGroupSchema.index(
  { tenantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

type GroupQuery = {
  getOptions: () => { includeDeleted?: boolean };
  getFilter: () => Record<string, unknown>;
  where: (cond: Record<string, unknown>) => unknown;
};
function excludeDeleted(this: GroupQuery): void {
  if (this.getOptions().includeDeleted) return;
  const filter = this.getFilter();
  if (Object.prototype.hasOwnProperty.call(filter, "deletedAt")) return;
  this.where({ deletedAt: null });
}
customComplianceGroupSchema.pre(/^find/, excludeDeleted as never);
customComplianceGroupSchema.pre("countDocuments", excludeDeleted as never);

export type CustomComplianceGroupAttrs = InferSchemaType<
  typeof customComplianceGroupSchema
>;

if (process.env.NODE_ENV !== "production" && models.CustomComplianceGroup) {
  delete models.CustomComplianceGroup;
}

export const CustomComplianceGroup: Model<CustomComplianceGroupAttrs> =
  (models.CustomComplianceGroup as Model<CustomComplianceGroupAttrs>) ??
  model<CustomComplianceGroupAttrs>(
    "CustomComplianceGroup",
    customComplianceGroupSchema,
  );
