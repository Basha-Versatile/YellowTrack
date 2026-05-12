import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

export const TENANT_STATUS = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export const TENANT_PLANS = ["FREE", "PRO", "ENTERPRISE"] as const;

const tenantLimitsSchema = new Schema(
  {
    maxVehicles: { type: Number, default: 50 },
    maxDrivers: { type: Number, default: 50 },
    maxUsers: { type: Number, default: 5 },
  },
  { _id: false },
);

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: /^[a-z0-9-]+$/,
    },
    status: {
      type: String,
      enum: TENANT_STATUS,
      default: "ACTIVE",
      index: true,
    },
    plan: { type: String, enum: TENANT_PLANS, default: "FREE" },
    limits: { type: tenantLimitsSchema, default: () => ({}) },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    billingEmail: { type: String, lowercase: true, trim: true },
    suspendedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

export type TenantAttrs = InferSchemaType<typeof tenantSchema>;

export const Tenant: Model<TenantAttrs> =
  (models.Tenant as Model<TenantAttrs>) ??
  model<TenantAttrs>("Tenant", tenantSchema);
