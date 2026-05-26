import "server-only";
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";

export const TENANT_STATUS = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export const SUBSCRIPTION_STATUS = [
  "TRIAL", // free trial period (no paid plan attached)
  "ACTIVE", // paid plan, within validity
  "EXPIRED", // subscription end date passed
  "CANCELLED", // superadmin manually cancelled
] as const;

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

    // Subscription — defined by the superadmin via the Plan model. Plans are
    // time-based only; no quota / limit fields.
    planId: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    subscriptionStart: { type: Date },
    subscriptionEnd: { type: Date, index: true },
    subscriptionStatus: {
      type: String,
      enum: SUBSCRIPTION_STATUS,
      default: "TRIAL",
      index: true,
    },

    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    billingEmail: { type: String, lowercase: true, trim: true },
    // Tenant logo URL — shown in the sidebar bottom card. Collected when the
    // superadmin creates the tenant. Optional (no logo → fall back to initials).
    logoUrl: { type: String, default: null },
    // IANA timezone (e.g. "Asia/Kolkata"). Per-tenant cron schedulers use this
    // to compute "today" in tenant-local time for EMI reminders, etc.
    timezone: { type: String, default: "Asia/Kolkata", trim: true },
    suspendedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

export type TenantAttrs = InferSchemaType<typeof tenantSchema>;

export const Tenant: Model<TenantAttrs> =
  (models.Tenant as Model<TenantAttrs>) ??
  model<TenantAttrs>("Tenant", tenantSchema);
