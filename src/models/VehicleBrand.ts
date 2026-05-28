import "server-only";
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const VEHICLE_BRAND_STATUS = ["APPROVED", "PENDING", "REJECTED"] as const;
export type VehicleBrandStatus = (typeof VEHICLE_BRAND_STATUS)[number];

/**
 * Platform-wide vehicle brand master. Brands live in one global list managed
 * by the superadmin — tenants pick from APPROVED brands when assigning a
 * brand to a vehicle, and can request a new brand if theirs is missing.
 *
 *  - `slug` is the canonical de-duplication key (lowercased name).
 *  - `logoUrl` is an uploaded image (preferred).
 *  - `iconKey` is an optional react-icons/si key (e.g. "SiToyota") shown when
 *    no logoUrl is present.
 *  - PENDING rows are only visible to the requesting tenant + superadmin
 *    until approved. After APPROVED, every tenant sees the brand.
 */
const vehicleBrandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    logoUrl: { type: String, default: null },
    iconKey: { type: String, default: null },
    description: { type: String, default: null, maxlength: 240 },

    status: {
      type: String,
      enum: VEHICLE_BRAND_STATUS,
      default: "APPROVED",
      index: true,
    },

    // Provenance — set when a tenant submits a PENDING request.
    requestedByTenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    requestedAt: { type: Date, default: null },

    // Approval/rejection trail (for the audit).
    approvedAt: { type: Date, default: null },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 240 },
  },
  { timestamps: true },
);

vehicleBrandSchema.index({ status: 1, name: 1 });

export type VehicleBrandAttrs = InferSchemaType<typeof vehicleBrandSchema>;

// Dev-mode model re-registration so schema edits propagate without server
// restart (same guard pattern used for ActivityLog).
if (process.env.NODE_ENV !== "production" && models.VehicleBrand) {
  delete models.VehicleBrand;
}

export const VehicleBrand: Model<VehicleBrandAttrs> =
  (models.VehicleBrand as Model<VehicleBrandAttrs>) ??
  model<VehicleBrandAttrs>("VehicleBrand", vehicleBrandSchema);
