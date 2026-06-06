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
export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
// Wallet/billing health. Drives header banners + suspension middleware:
//   ACTIVE      — wallet positive OR recently became negative
//   PAYMENT_DUE — wallet negative; still allowed to use the app
//   SUSPENDED   — negative > 30 days; reads still work, writes blocked
export const BILLING_STATUSES = ["ACTIVE", "PAYMENT_DUE", "SUSPENDED"] as const;
export type BillingHealthStatus = (typeof BILLING_STATUSES)[number];

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
    // Billing cycle the tenant is on. Combined with the resolved plan's
    // per-vehicle rate (MONTHLY → perVehiclePerMonth, YEARLY → perVehiclePerYear)
    // to compute invoices. Default MONTHLY.
    billingCycle: {
      type: String,
      enum: BILLING_CYCLES,
      default: "MONTHLY",
    },

    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    billingEmail: { type: String, lowercase: true, trim: true },
    // Tenant logo URL — shown in the sidebar bottom card. Collected when the
    // superadmin creates the tenant. Optional (no logo → fall back to initials).
    logoUrl: { type: String, default: null },
    // Indian tax identifiers — all uppercase, optional but format-validated when
    // present. Stored as plain strings; the schema enforces the shape only.
    gstNumber: { type: String, uppercase: true, trim: true, default: null },
    panNumber: { type: String, uppercase: true, trim: true, default: null },
    // Registered address — optional, used on invoices and reports.
    addressLine: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    pinCode: { type: String, trim: true, default: null },
    // IANA timezone (e.g. "Asia/Kolkata"). Per-tenant cron schedulers use this
    // to compute "today" in tenant-local time for EMI reminders, etc.
    timezone: { type: String, default: "Asia/Kolkata", trim: true },
    suspendedAt: { type: Date },
    deletedAt: { type: Date },

    // ── Wallet + billing health ────────────────────────────────────────
    // walletBalance is the source of truth for how much credit the tenant
    // has left. Stored in rupees with 2-decimal precision (Mongo Double).
    // New tenants are seeded with ₹1000 via wallet.service.creditWallet.
    walletBalance: { type: Number, default: 0 },
    // Updated on every successful monthly debit so the cron can skip
    // already-billed-this-month tenants on re-runs.
    lastBilledAt: { type: Date, default: null },
    // Driven by the billing orchestrator. PAYMENT_DUE = wallet negative,
    // SUSPENDED = negative for 30+ days (writes blocked by middleware).
    billingStatus: {
      type: String,
      enum: BILLING_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    // When the wallet first went negative this cycle. Cleared on positive
    // balance. The orchestrator escalates to SUSPENDED once this is > 30d.
    paymentDueSince: { type: Date, default: null },
  },
  { timestamps: true },
);

export type TenantAttrs = InferSchemaType<typeof tenantSchema>;

if (process.env.NODE_ENV !== "production" && models.Tenant) {
  delete models.Tenant;
}

export const Tenant: Model<TenantAttrs> =
  (models.Tenant as Model<TenantAttrs>) ??
  model<TenantAttrs>("Tenant", tenantSchema);
