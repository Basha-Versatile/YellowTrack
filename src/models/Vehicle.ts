import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const vehicleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    registrationNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    ownerName: { type: String },
    brand: { type: String, default: null },
    make: { type: String, required: true },
    model: { type: String, required: true },
    fuelType: { type: String, required: true },
    chassisNumber: { type: String },
    engineNumber: { type: String },
    gvw: { type: Number },
    seatingCapacity: { type: Number },
    permitType: { type: String },
    vehicleUsage: { type: String, enum: ["PRIVATE", "COMMERCIAL"] },
    status: { type: String, enum: ["ACTIVE", "SOLD"], default: "ACTIVE", index: true },
    tyreCount: { type: Number, min: 2, max: 20 },
    registrationDate: { type: Date },
    qrCodeUrl: { type: String },
    invoiceUrl: { type: String },
    images: { type: [String], default: [] },
    profileImage: { type: String },
    groupId: { type: Schema.Types.ObjectId, ref: "VehicleGroup", index: true },

    // Surepass enrichment
    rcStatus: { type: String },
    blacklistStatus: { type: String },
    financed: { type: Boolean },
    financer: { type: String },
    ownerNumber: { type: Number },
    registeredAt: { type: String },
    manufacturingDate: { type: String },
    ownerPhone: { type: String },
    ownerAddress: { type: String },
    fatherName: { type: String },
    color: { type: String },
    bodyType: { type: String },
    vehicleCategory: { type: String },
    normsType: { type: String },
    cubicCapacity: { type: String },
    cylinders: { type: Number },
    wheelbase: { type: Number },
    unladenWeight: { type: Number },
    taxMode: { type: String },
    surepassRaw: { type: Schema.Types.Mixed },

    // Soft delete: when set, the vehicle is treated as deleted by all read
    // paths. Schema middleware below auto-filters it out of find/findOne/count
    // and aggregate queries. Callers that genuinely need to see deleted rows
    // (a future restore screen, audits) can opt in via `query.setOptions({ includeDeleted: true })`.
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

// Tenant-scoped uniqueness: two tenants may register the same vehicle number.
vehicleSchema.index({ tenantId: 1, registrationNumber: 1 }, { unique: true });

// Soft-delete middleware — runs for every find/count/aggregate unless the
// caller opts in to see deleted docs.
type DeletableQuery = {
  getOptions: () => { includeDeleted?: boolean };
  getFilter: () => Record<string, unknown>;
  where: (cond: Record<string, unknown>) => unknown;
};
function excludeDeleted(this: DeletableQuery): void {
  if (this.getOptions().includeDeleted) return;
  const filter = this.getFilter();
  if (Object.prototype.hasOwnProperty.call(filter, "deletedAt")) return;
  this.where({ deletedAt: null });
}
vehicleSchema.pre(/^find/, excludeDeleted as never);
vehicleSchema.pre("countDocuments", excludeDeleted as never);
vehicleSchema.pre("aggregate", function (next) {
  const pipeline = this.pipeline();
  // Skip if caller already filtered on deletedAt, or asked to include deleted.
  const opts = (this.options as { includeDeleted?: boolean }) || {};
  if (opts.includeDeleted) return next();
  pipeline.unshift({ $match: { deletedAt: null } });
  next();
});

export type VehicleAttrs = InferSchemaType<typeof vehicleSchema>;

export const Vehicle: Model<VehicleAttrs> =
  (models.Vehicle as Model<VehicleAttrs>) ??
  model<VehicleAttrs>("Vehicle", vehicleSchema);
