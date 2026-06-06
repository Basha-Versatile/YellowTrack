import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/**
 * Superadmin-defined subscription plan — per-vehicle pricing with fleet-size
 * tiering (e.g. Silver 0-20, Gold 21-50, Platinum 51-100, Diamond 100+).
 *
 *  - `fleetSizeMin` / `fleetSizeMax` describe the band this tier covers.
 *    `fleetSizeMax: null` means the upper bound is unlimited (the "+" tier).
 *  - `perVehiclePerMonth` / `perVehiclePerYear` are the headline rates billed
 *    per vehicle. The tenant chooses MONTHLY or YEARLY at the tenant level.
 *  - `perDriverPerMonth` is the per-driver add-on; defaults to 0 if the plan
 *    doesn't charge for drivers.
 *  - `gstPercent` is the tax that's added on top of the subtotal (18 = 18%).
 *
 * Inactive plans (isActive=false) stay in the DB so existing tenants on them
 * keep working, but they don't appear in the auto-tier resolver for new fleet
 * sizes.
 */
const planSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
    },
    description: { type: String, trim: true, maxlength: 240 },
    currency: { type: String, default: "INR", maxlength: 3, uppercase: true },
    isActive: { type: Boolean, default: true, index: true },

    // Fleet-size band. `fleetSizeMax: null` = unlimited upper bound.
    fleetSizeMin: { type: Number, required: true, min: 0, default: 0 },
    fleetSizeMax: { type: Number, min: 1, default: null },

    // Per-vehicle pricing.
    perVehiclePerMonth: { type: Number, required: true, min: 0, default: 0 },
    perVehiclePerYear: { type: Number, required: true, min: 0, default: 0 },

    // Driver add-on.
    perDriverPerMonth: { type: Number, min: 0, default: 0 },

    // Custom Compliance — the "documents bank" outside the per-vehicle
    // tracker (company-level GST / licences / agreements grouped by entity).
    // Billed per group per month (e.g. ₹30/group/month). Each group can
    // hold at most `customComplianceDocsPerGroupLimit` documents.
    customComplianceGroupPerMonth: { type: Number, min: 0, default: 30 },
    customComplianceDocsPerGroupLimit: { type: Number, min: 1, max: 1000, default: 10 },

    // GST applied on the subtotal (percentage points, e.g. 18 = 18%).
    gstPercent: { type: Number, min: 0, max: 100, default: 18 },
  },
  { timestamps: true },
);

export type PlanAttrs = InferSchemaType<typeof planSchema>;

if (process.env.NODE_ENV !== "production" && models.Plan) {
  delete models.Plan;
}

export const Plan: Model<PlanAttrs> =
  (models.Plan as Model<PlanAttrs>) ?? model<PlanAttrs>("Plan", planSchema);
