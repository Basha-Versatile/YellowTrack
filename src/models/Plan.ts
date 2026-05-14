import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

/**
 * Superadmin-defined subscription plan. Time-based — a plan grants access for
 * `durationDays` from the start of a tenant's subscription.
 *
 * Optional quotas (maxVehicles, maxDrivers, maxUsers, maxRoles): when a field
 * is null/unset, that resource is unlimited under this plan. When set, the
 * tenant cannot create more than that many of the resource.
 *
 * Inactive plans (isActive=false) stay in the DB so existing tenants on them
 * keep working, but they don't appear in the picker for new tenants.
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
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", maxlength: 3, uppercase: true },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    isActive: { type: Boolean, default: true, index: true },
    maxVehicles: { type: Number, min: 0, default: null },
    maxDrivers: { type: Number, min: 0, default: null },
    maxUsers: { type: Number, min: 0, default: null },
    maxRoles: { type: Number, min: 0, default: null },
  },
  { timestamps: true },
);

export type PlanAttrs = InferSchemaType<typeof planSchema>;

export const Plan: Model<PlanAttrs> =
  (models.Plan as Model<PlanAttrs>) ?? model<PlanAttrs>("Plan", planSchema);
